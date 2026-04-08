import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { tasks, runs } from '@trigger.dev/sdk/v3'
import type { extractFrameTask } from '@/trigger/extract-frame-task'
import type { ExtractFrameResult } from '@/types/tasks'

// ── Request schema ──────────────────────────────────────────────────────────

/**
 * `timestamp` accepts three forms:
 * - A plain number: `30`  (seconds)
 * - A numeric string: `"30"` (seconds, stored as string in ExtractFrameNodeData)
 * - A percentage string: `"50%"` (resolved to seconds inside the task)
 *
 * We keep it as `z.union` to accept all three from the frontend without
 * requiring the orchestrator to pre-parse the node's string data.
 */
const timestampSchema = z.union([
  z.number().min(0),
  z.string().min(1),
])

const requestSchema = z.object({
  nodeId: z.string().min(1),
  videoUrl: z.string().url('videoUrl must be a valid URL'),
  timestamp: timestampSchema.default('0'),
})

// ── Response types ──────────────────────────────────────────────────────────

interface ExtractFrameExecuteResponse {
  nodeId: string
  cdnUrl: string
}

interface ExtractFrameExecuteErrorResponse {
  error: string
}

// ── Route handler ───────────────────────────────────────────────────────────

/**
 * POST /api/nodes/extract-frame/execute
 *
 * Triggers the `extract-frame-task` Trigger.dev background task and waits
 * for completion before returning the extracted frame CDN URL to the
 * frontend orchestrator.
 *
 * Flow:
 * 1. Clerk auth check.
 * 2. Zod validates the request body. `timestamp` is passed through as-is
 *    (seconds or "50%") — the task resolves the actual seek position.
 * 3. `tasks.triggerAndWait` dispatches the task and blocks until resolved.
 * 4. Returns `{ nodeId, cdnUrl }` to `useWorkflowExecution`.
 *
 * Auth:    Clerk JWT required.
 * Timeout: Inherits the Trigger.dev task `maxDuration` (60s).
 */
export async function POST(
  req: Request,
): Promise<NextResponse<ExtractFrameExecuteResponse | ExtractFrameExecuteErrorResponse>> {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse + validate ───────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    const firstError =
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? 'Invalid request body'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { nodeId, videoUrl, timestamp } = parsed.data

  // ── 3. Dispatch Trigger.dev task and wait for result ──────────────────────
  let result: ExtractFrameResult
  try {
    const handle = await tasks.trigger<typeof extractFrameTask>('extract-frame-task', {
      nodeId,
      videoUrl,
      timestamp,
    })

    // Poll for completion since triggerAndWait only works inside a task
    const terminalStatuses = ['COMPLETED', 'CANCELED', 'FAILED', 'CRASHED', 'SYSTEM_FAILURE', 'EXPIRED', 'TIMED_OUT']
    let run = await runs.retrieve(handle.id)
    while (!terminalStatuses.includes(run.status as string)) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      run = await runs.retrieve(handle.id)
    }

    if (run.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: `Extract frame task failed with status: ${run.status}. Details: ${JSON.stringify(run)}` },
        { status: 500 },
      )
    }

    result = run.output as ExtractFrameResult
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to dispatch extract-frame task'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // ── 4. Return result ──────────────────────────────────────────────────────
  return NextResponse.json({ nodeId, cdnUrl: result.cdnUrl })
}
