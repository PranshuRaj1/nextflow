import { task, batch } from "@trigger.dev/sdk/v3";
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

import { prisma } from "@/lib/db/prisma";

import { collectInputs } from "@/lib/workflow/dispatch-node-task";
import type { AppNode, AppEdge } from "@/types/workflow";

// Value imports needed for batch.triggerByTaskAndWait
import { runLlmTask } from "./run-llm-task";
import { cropImageTask } from "./crop-image-task";
import { extractFrameTask } from "./extract-frame-task";

import { NodeExecutionStatus, RunStatus } from "@prisma/client";

interface RunWorkflowPayload {
  runId: string;
  workflowId: string;
  waves: string[][];
  nodes: AppNode[];
  edges: AppEdge[];
}

// Describes one sub-task we want to fire in parallel within a wave
type PendingSubTask =
  | { type: 'llm';          nodeId: string; node: AppNode; payload: Parameters<typeof runLlmTask.trigger>[0] }
  | { type: 'cropImage';    nodeId: string; node: AppNode; payload: Parameters<typeof cropImageTask.trigger>[0] }
  | { type: 'extractFrame'; nodeId: string; node: AppNode; payload: Parameters<typeof extractFrameTask.trigger>[0] };

export const runWorkflowTask = task({
  id: "run-workflow-task",
  maxDuration: 3600, // 1 hour max duration for worst-case workflows
  run: async (payload: RunWorkflowPayload) => {
    const { runId, waves, nodes, edges } = payload;

    // Heartbeat helper
    const updateHeartbeat = async () => {
      await prisma.workflowRun.update({
        where: { id: runId },
        data: { lastHeartbeatAt: new Date() }
      });
    };

    await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: RunStatus.RUNNING }
    });

    const resolvedMap = new Map<string, unknown>();
    const failedNodeIds = new Set<string>();

    for (const wave of waves) {
      await updateHeartbeat();

      // ── Separate immediate nodes from sub-task nodes ────────────────────
      // Immediate: text, uploadImage, uploadVideo — resolve locally with no I/O
      // Sub-task:  llm, cropImage, extractFrame   — need Trigger.dev tasks
      const immediateNodeIds: string[] = [];
      const subTaskNodeIds: string[] = [];

      for (const nodeId of wave) {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) { failedNodeIds.add(nodeId); continue; }

        // Skip if upstream dep failed
        const incomingEdges = edges.filter((e) => e.target === nodeId);
        const hasFailedDep = incomingEdges.some((e) => failedNodeIds.has(e.source));
        if (hasFailedDep) {
          await prisma.nodeExecution.create({
            data: { runId, nodeId, nodeType: node.type, status: NodeExecutionStatus.SKIPPED, inputs: {} }
          });
          failedNodeIds.add(nodeId);
          continue;
        }

        // Idempotency: already finished in a previous attempt?
        const existing = await prisma.nodeExecution.findFirst({
          where: { runId, nodeId, status: { in: ['COMPLETED', 'FAILED', 'SKIPPED'] } }
        });
        if (existing) {
          if (existing.status === 'COMPLETED' && existing.output) {
            resolvedMap.set(nodeId, existing.output);
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

      // ── 1. Resolve immediate nodes sequentially (no I/O, very fast) ──────
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

      // ── 2. Build batch of sub-tasks (all independent, run in parallel) ───
      if (subTaskNodeIds.length === 0) continue;

      const pendingTasks: PendingSubTask[] = [];

      for (const nodeId of subTaskNodeIds) {
        const node = nodes.find((n) => n.id === nodeId)!;
        const resolvedInputs = collectInputs(nodeId, edges, resolvedMap);

        try {
          switch (node.type) {
            case 'llm': {
              const data = node.data as any;
              const systemPrompt = (resolvedInputs['system_prompt'] as string | undefined) ?? data.systemPrompt;
              const userMessage = (resolvedInputs['user_message'] as string | undefined) ?? data.userMessage;
              if (!userMessage?.trim()) throw new Error('LLM node requires a user message');
              const rawImages = resolvedInputs['images'];
              const imageUrls = rawImages
                ? (Array.isArray(rawImages) ? rawImages : [rawImages]).filter(
                    (url): url is string => typeof url === 'string' && url.startsWith('http')
                  )
                : [];
              pendingTasks.push({
                type: 'llm', nodeId, node,
                payload: { nodeId, runId, model: data.model, systemPrompt: systemPrompt || undefined, userMessage, imageUrls },
              });
              break;
            }

            case 'cropImage': {
              const data = node.data as any;
              const imageUrl = resolvedInputs['image_url'] as string | undefined;
              if (!imageUrl) throw new Error('Crop Image node requires an image connected to the image_url handle');
              const xPercent = (resolvedInputs['x_percent'] as number | string | undefined) ?? data.xPercent;
              const yPercent = (resolvedInputs['y_percent'] as number | string | undefined) ?? data.yPercent;
              const widthPercent = (resolvedInputs['width_percent'] as number | string | undefined) ?? data.widthPercent;
              const heightPercent = (resolvedInputs['height_percent'] as number | string | undefined) ?? data.heightPercent;
              pendingTasks.push({
                type: 'cropImage', nodeId, node,
                payload: { nodeId, runId, imageUrl, xPercent, yPercent, widthPercent, heightPercent },
              });
              break;
            }

            case 'extractFrame': {
              const data = node.data as any;
              const videoUrl = resolvedInputs['video_url'] as string | undefined;
              if (!videoUrl) throw new Error('Extract Frame node requires a video connected to the video_url handle');
              const timestamp = (resolvedInputs['timestamp'] as number | string | undefined) ?? data.timestamp;
              pendingTasks.push({
                type: 'extractFrame', nodeId, node,
                payload: { nodeId, runId, videoUrl, timestamp },
              });
              break;
            }

            default:
              throw new Error(`Unknown node type: ${node.type}`);
          }
        } catch (err) {
          // Payload-building failures (e.g. missing required input) — mark failed immediately
          failedNodeIds.add(nodeId);
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          await prisma.nodeExecution.create({
            data: { runId, nodeId, nodeType: node.type, status: NodeExecutionStatus.FAILED, inputs: {}, error: errorMessage as any }
          });
        }
      }

      if (pendingTasks.length === 0) continue;

      // ── 3. Fire all sub-tasks in parallel via batch.triggerByTaskAndWait ──
      //    Each sub-task manages its own NodeExecution DB record.
      //    We get back results indexed in the same order as pendingTasks.
      const batchItems = pendingTasks.map((pt) => {
        switch (pt.type) {
          case 'llm':          return { task: runLlmTask,      payload: pt.payload };
          case 'cropImage':    return { task: cropImageTask,   payload: pt.payload };
          case 'extractFrame': return { task: extractFrameTask, payload: pt.payload };
        }
      });

      const results = await batch.triggerByTaskAndWait(batchItems);

      // ── 4. Collect results and propagate failures ─────────────────────────
      for (let i = 0; i < pendingTasks.length; i++) {
        const pt = pendingTasks[i]!;
        const result = results.runs[i]!;

        if (result.ok) {
          const safeOutput = result.output as { text?: string; cdnUrl?: string };
          let output: unknown;
          switch (pt.type) {
            case 'llm':          output = safeOutput.text; break;
            case 'cropImage':    output = safeOutput.cdnUrl; break;
            case 'extractFrame': output = safeOutput.cdnUrl; break;
          }
          resolvedMap.set(pt.nodeId, output);
        } else {
          failedNodeIds.add(pt.nodeId);
          // The sub-task already wrote FAILED to the DB — nothing extra needed
        }
      }
    }

    // ── 5. Finalize WorkflowRun ────────────────────────────────────────────
    const finalRun = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: { nodeExecutions: true }
    });

    if (!finalRun) return;

    const failedCount = finalRun.nodeExecutions.filter(n => n.status === 'FAILED').length;
    const successCount = finalRun.nodeExecutions.filter(n => n.status === 'COMPLETED').length;

    const dbStatus = failedCount === 0 ? RunStatus.COMPLETED : successCount === 0 ? RunStatus.FAILED : RunStatus.PARTIAL;

    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: dbStatus,
        completedAt: new Date(),
        durationMs: new Date().getTime() - finalRun.startedAt.getTime(),
        lastHeartbeatAt: new Date()
      }
    });
  }
});
