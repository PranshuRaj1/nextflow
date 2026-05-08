// src/lib/workflow/start-workflow.ts
//
// Drop-in replacement for wherever you previously called:
//   await runWorkflowTask.trigger({ runId, workflowId, waves, nodes, edges })
//
// This helper:
//   1. Writes the full graph to Redis (once, not per-wave)
//   2. Triggers wave 0 — the checkpoint chain takes it from there
//
// Usage in your /api/workflow/execute route:
//
//   import { startWorkflow } from '@/lib/workflow/start-workflow'
//
//   await startWorkflow({ runId, workflowId, waves, nodes, edges })

import { redis, graphKey, RUN_TTL } from '@/lib/redis'
import { runWaveTask } from '@/trigger/run-wave-task'
import type { AppNode, AppEdge } from '@/types/workflow'

interface StartWorkflowOptions {
  runId:      string
  workflowId: string
  waves:      string[][]
  nodes:      AppNode[]
  edges:      AppEdge[]
}

export async function startWorkflow({
  runId,
  waves,
  nodes,
  edges,
}: StartWorkflowOptions): Promise<{ id: string } | undefined> {
  if (waves.length === 0) {
    // Nothing to run — shouldn't normally happen, but guard defensively.
    return
  }

  // Store the full graph in Redis. Each wave task reads from here instead of
  // receiving it in its payload. Keeps per-wave trigger payloads tiny.
  await redis.set(
    graphKey(runId),
    JSON.stringify({ waves, nodes, edges }),
    { ex: RUN_TTL }
  )

  // Kick off wave 0. The task chain handles the rest.
  return await runWaveTask.trigger({ runId, waveIndex: 0 })
}
