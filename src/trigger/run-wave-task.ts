// src/trigger/run-wave-task.ts

// KEY IDEA
// ────────
// Instead of one long-lived task that holds a Trigger.dev slot for the entire
// workflow duration (across all waves), each wave is its own task that:
//   1. Reads the graph + previous outputs from Redis
//   2. Executes one wave (immediate nodes + parallel sub-tasks)
//   3. Writes its outputs back to Redis
//   4. Triggers the *next* wave task (or finalizes if done)
//   5. EXITS — slot is freed immediately
//
// Slot held per wave ≈ maxDuration of one wave (≤5 min) instead of the whole
// workflow (up to 1 hour). This unlocks ~10× higher concurrency at scale.
//
// REDIS KEYS (all scoped to runId, TTL = 2h)
// ──────────────────────────────────────────
//   run:{runId}:graph           → { waves, nodes, edges }
//   run:{runId}:output:{nodeId} → serialized node output value
//   run:{runId}:failed          → JSON array of failed node IDs
//

// See src/lib/workflow/start-workflow.ts for that helper.

import { task, batch } from "@trigger.dev/sdk/v3";
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

import { prisma } from "@/lib/db/prisma";
import { redis, graphKey, outputKey, failedKey, RUN_TTL } from "@/lib/redis";
import { collectInputs } from "@/lib/workflow/dispatch-node-task";
import type { AppNode, AppEdge } from "@/types/workflow";

import { runLlmTask } from "./run-llm-task";
import { cropImageTask } from "./crop-image-task";
import { extractFrameTask } from "./extract-frame-task";

import { NodeExecutionStatus, RunStatus } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RunWavePayload {
  runId: string;
  waveIndex: number;
}

// The graph is stored once in Redis at workflow start — not re-passed each wave.
interface StoredGraph {
  waves: string[][];
  nodes: AppNode[];
  edges: AppEdge[];
}

type PendingSubTask =
  | { type: 'llm';          nodeId: string; payload: Parameters<typeof runLlmTask.trigger>[0] }
  | { type: 'cropImage';    nodeId: string; payload: Parameters<typeof cropImageTask.trigger>[0] }
  | { type: 'extractFrame'; nodeId: string; payload: Parameters<typeof extractFrameTask.trigger>[0] };

// ── Redis helpers ─────────────────────────────────────────────────────────────

/** Write a single node output to Redis. */
async function writeOutput(runId: string, nodeId: string, value: unknown): Promise<void> {
  await redis.set(outputKey(runId, nodeId), JSON.stringify(value), { ex: RUN_TTL });
}

/** Read all previously-resolved outputs for a run into a Map. */
async function loadResolvedMap(runId: string, nodes: AppNode[]): Promise<Map<string, unknown>> {
  const map = new Map<string, unknown>();

  // Build all keys in one shot, then do a single mget — avoids N round-trips.
  const nodeIds = nodes.map((n) => n.id);
  if (nodeIds.length === 0) return map;

  const keys = nodeIds.map((id) => outputKey(runId, id));
  const values = await redis.mget<string[]>(...keys);

  for (let i = 0; i < nodeIds.length; i++) {
    const raw = values[i];
    if (raw != null) {
      try {
        map.set(nodeIds[i]!, typeof raw === 'string' ? JSON.parse(raw) : raw);
      } catch {
        map.set(nodeIds[i]!, raw); // fallback: store as-is if not valid JSON
      }
    }
  }

  return map;
}

/** Read the set of previously-failed node IDs. */
async function loadFailedSet(runId: string): Promise<Set<string>> {
  const raw = await redis.get<string>(failedKey(runId));
  if (!raw) return new Set();
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return new Set(parsed as string[]);
  } catch {
    return new Set();
  }
}

/** Persist the current failed set back to Redis. */
async function saveFailedSet(runId: string, failed: Set<string>): Promise<void> {
  await redis.set(failedKey(runId), JSON.stringify([...failed]), { ex: RUN_TTL });
}

// ── Task ──────────────────────────────────────────────────────────────────────

export const runWaveTask = task({
  id: "run-wave-task",
  // Each wave holds the slot only for its own execution — not the entire workflow.
  // 5 minutes is generous even for a wave with slow LLM calls.
  maxDuration: 300,

  run: async ({ runId, waveIndex }: RunWavePayload) => {

    // ── 0. Load graph from Redis ─────────────────────────────────────────────
    const rawGraph = await redis.get<string>(graphKey(runId));
    if (!rawGraph) {
      // Graph missing — run was probably cancelled or Redis key expired.
      await prisma.workflowRun.update({
        where: { id: runId },
        data: { status: RunStatus.FAILED, completedAt: new Date() }
      });
      return;
    }

    const { waves, nodes, edges }: StoredGraph =
      typeof rawGraph === 'string' ? JSON.parse(rawGraph) : rawGraph;

    // Guard: invalid wave index (should never happen, but be defensive)
    if (waveIndex >= waves.length) {
      await finalizeRun(runId);
      return;
    }

    const wave = waves[waveIndex]!;

    // ── 1. Restore state from Redis ──────────────────────────────────────────
    const resolvedMap  = await loadResolvedMap(runId, nodes);
    const failedNodeIds = await loadFailedSet(runId);

    // Heartbeat so the frontend stale-run detector doesn't fire
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { lastHeartbeatAt: new Date() }
    });

    // ── 2. Classify nodes in this wave ───────────────────────────────────────
    const immediateNodeIds: string[] = [];
    const subTaskNodeIds: string[]   = [];

    for (const nodeId of wave) {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) { failedNodeIds.add(nodeId); continue; }

      // Skip if any direct upstream dep failed
      const incomingEdges = edges.filter((e) => e.target === nodeId);
      const hasFailedDep  = incomingEdges.some((e) => failedNodeIds.has(e.source));
      if (hasFailedDep) {
        await prisma.nodeExecution.create({
          data: { runId, nodeId, nodeType: node.type, status: NodeExecutionStatus.SKIPPED, inputs: {} }
        });
        failedNodeIds.add(nodeId);
        continue;
      }

      // Idempotency: if a previous attempt of this wave already completed this
      // node, reload its output and skip re-execution.
      const existing = await prisma.nodeExecution.findFirst({
        where: { runId, nodeId, status: { in: ['COMPLETED', 'FAILED', 'SKIPPED'] } }
      });
      if (existing) {
        if (existing.status === 'COMPLETED' && existing.output) {
          // Ensure it's also in Redis for downstream waves
          if (!resolvedMap.has(nodeId)) {
            await writeOutput(runId, nodeId, existing.output);
            resolvedMap.set(nodeId, existing.output);
          }
        } else if (existing.status === 'FAILED') {
          failedNodeIds.add(nodeId);
        }
        continue;
      }

      if (node.type === 'text' || node.type === 'uploadImage' || node.type === 'uploadVideo') {
        immediateNodeIds.push(nodeId);
      } else {
        subTaskNodeIds.push(nodeId);
      }
    }

    // ── 3. Resolve immediate nodes (no I/O) ──────────────────────────────────
    for (const nodeId of immediateNodeIds) {
      const node = nodes.find((n) => n.id === nodeId)!;
      try {
        let output: unknown;
        switch (node.type) {
          case 'text':
            output = (node.data as any).value ?? '';
            break;
          case 'uploadImage':
            output = (node.data as any).imageUrl;
            if (!output) throw new Error('Upload Image node has no uploaded image yet');
            break;
          case 'uploadVideo':
            output = (node.data as any).videoUrl;
            if (!output) throw new Error('Upload Video node has no uploaded video yet');
            break;
        }
        resolvedMap.set(nodeId, output);
        await writeOutput(runId, nodeId, output);
        await prisma.nodeExecution.create({
          data: {
            runId, nodeId, nodeType: node.type,
            status: NodeExecutionStatus.COMPLETED,
            inputs: {},
            output: output as any,
            executionMs: 0,
          }
        });
      } catch (err) {
        failedNodeIds.add(nodeId);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        await prisma.nodeExecution.create({
          data: { runId, nodeId, nodeType: node.type, status: NodeExecutionStatus.FAILED, inputs: {}, error: errorMessage as any }
        });
      }
    }

    // ── 4. Build + fire sub-tasks for this wave ───────────────────────────────
    if (subTaskNodeIds.length > 0) {
      const pendingTasks: PendingSubTask[] = [];

      for (const nodeId of subTaskNodeIds) {
        const node = nodes.find((n) => n.id === nodeId)!;
        const resolvedInputs = collectInputs(nodeId, edges, resolvedMap);

        try {
          switch (node.type) {
            case 'llm': {
              const data = node.data as any;
              const systemPrompt = (resolvedInputs['system_prompt'] as string | undefined) ?? data.systemPrompt;
              const userMessage  = (resolvedInputs['user_message']  as string | undefined) ?? data.userMessage;
              if (!userMessage?.trim()) throw new Error('LLM node requires a user message');
              const rawImages = resolvedInputs['images'];
              const imageUrls = rawImages
                ? (Array.isArray(rawImages) ? rawImages : [rawImages]).filter(
                    (url): url is string => typeof url === 'string' && url.startsWith('http')
                  )
                : [];
              pendingTasks.push({
                type: 'llm', nodeId,
                payload: { nodeId, runId, model: data.model, systemPrompt: systemPrompt || undefined, userMessage, imageUrls },
              });
              break;
            }
            case 'cropImage': {
              const data     = node.data as any;
              const imageUrl = resolvedInputs['image_url'] as string | undefined;
              if (!imageUrl) throw new Error('Crop Image node requires an image connected to the image_url handle');
              pendingTasks.push({
                type: 'cropImage', nodeId,
                payload: {
                  nodeId, runId, imageUrl,
                  xPercent:      (resolvedInputs['x_percent']      as number | string | undefined) ?? data.xPercent,
                  yPercent:      (resolvedInputs['y_percent']      as number | string | undefined) ?? data.yPercent,
                  widthPercent:  (resolvedInputs['width_percent']  as number | string | undefined) ?? data.widthPercent,
                  heightPercent: (resolvedInputs['height_percent'] as number | string | undefined) ?? data.heightPercent,
                },
              });
              break;
            }
            case 'extractFrame': {
              const data     = node.data as any;
              const videoUrl = resolvedInputs['video_url'] as string | undefined;
              if (!videoUrl) throw new Error('Extract Frame node requires a video connected to the video_url handle');
              pendingTasks.push({
                type: 'extractFrame', nodeId,
                payload: {
                  nodeId, runId, videoUrl,
                  timestamp: (resolvedInputs['timestamp'] as number | string | undefined) ?? data.timestamp,
                },
              });
              break;
            }
            default:
              throw new Error(`Unknown node type: ${node.type}`);
          }
        } catch (err) {
          failedNodeIds.add(nodeId);
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          await prisma.nodeExecution.create({
            data: { runId, nodeId, nodeType: node.type, status: NodeExecutionStatus.FAILED, inputs: {}, error: errorMessage as any }
          });
        }
      }

      if (pendingTasks.length > 0) {
        const batchItems = pendingTasks.map((pt) => {
          switch (pt.type) {
            case 'llm':          return { task: runLlmTask,       payload: pt.payload };
            case 'cropImage':    return { task: cropImageTask,    payload: pt.payload };
            case 'extractFrame': return { task: extractFrameTask, payload: pt.payload };
          }
        });

        const results = await batch.triggerByTaskAndWait(batchItems);

        for (let i = 0; i < pendingTasks.length; i++) {
          const pt     = pendingTasks[i]!;
          const result = results.runs[i]!;

          if (result.ok) {
            const safeOutput = result.output as { text?: string; cdnUrl?: string };
            let output: unknown;
            switch (pt.type) {
              case 'llm':          output = safeOutput.text;   break;
              case 'cropImage':    output = safeOutput.cdnUrl; break;
              case 'extractFrame': output = safeOutput.cdnUrl; break;
            }
            resolvedMap.set(pt.nodeId, output);
            await writeOutput(runId, pt.nodeId, output);
          } else {
            failedNodeIds.add(pt.nodeId);
          }
        }
      }
    }

    // ── 5. Persist updated failed set, then chain or finalize ────────────────
    await saveFailedSet(runId, failedNodeIds);

    const nextWaveIndex = waveIndex + 1;

    if (nextWaveIndex < waves.length) {
      // Trigger the next wave — this task's slot is freed as soon as we return.
      await runWaveTask.trigger({ runId, waveIndex: nextWaveIndex });
    } else {
      // All waves done — finalize the run.
      await finalizeRun(runId);
    }
  },
});

// ── Finalizer ─────────────────────────────────────────────────────────────────

/**
 * Reads NodeExecution records from the DB and marks the WorkflowRun terminal.
 * Called by the last wave, or by the graph-missing guard at the top.
 *
 * Idempotent: safe to call twice (e.g. on retry after a transient DB error).
 */
async function finalizeRun(runId: string): Promise<void> {
  const finalRun = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { nodeExecutions: true },
  });

  if (!finalRun) return;

  // If already finalized by a concurrent execution, bail out.
  if (['COMPLETED', 'FAILED', 'PARTIAL', 'CANCELLED'].includes(finalRun.status)) return;

  const failedCount  = finalRun.nodeExecutions.filter((n) => n.status === 'FAILED').length;
  const successCount = finalRun.nodeExecutions.filter((n) => n.status === 'COMPLETED').length;

  const dbStatus =
    failedCount === 0   ? RunStatus.COMPLETED :
    successCount === 0  ? RunStatus.FAILED    : RunStatus.PARTIAL;

  await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      status: dbStatus,
      completedAt:      new Date(),
      durationMs:       new Date().getTime() - finalRun.startedAt.getTime(),
      lastHeartbeatAt:  new Date(),
    },
  });

}
