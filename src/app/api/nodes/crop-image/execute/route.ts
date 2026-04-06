import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { tasks, runs } from '@trigger.dev/sdk/v3'
import type { cropImageTask } from '@/trigger/crop-image-task'
import type { CropImageResult } from '@/types/tasks'

// ── Request schema ──────────────────────────────────────────────────────────

/**
 * Percentages are stored as strings in node data (CropImageNodeData) but
 * coerced to numbers here for the task payload.
 */
const requestSchema = z.object({
  nodeId: z.string().min(1),
  imageUrl: z.string().url('imageUrl must be a valid URL'),
  xPercent: z.coerce.number().min(0).max(100).default(0),
  yPercent: z.coerce.number().min(0).max(100).default(0),
  widthPercent: z.coerce.number().min(1).max(100).default(100),
  heightPercent: z.coerce.number().min(1).max(100).default(100),
})

// ── Response types ──────────────────────────────────────────────────────────

interface CropImageExecuteResponse {
  nodeId: string
  cdnUrl: string
}

interface CropImageExecuteErrorResponse {
  error: string
}

// ── Route handler ───────────────────────────────────────────────────────────

/**
 * POST /api/nodes/crop-image/execute
 *
 * Triggers the `crop-image-task` Trigger.dev background task and waits for
 * completion before returning the cropped image CDN URL to the frontend
 * orchestrator.
 *
 * Flow:
 * 1. Clerk auth check.
 * 2. Zod validates + coerces the request body (string → number for percents).
 * 3. `tasks.triggerAndWait` dispatches the task and blocks until resolved.
 * 4. Returns `{ nodeId, cdnUrl }` to `useWorkflowExecution`.
 *
 * Auth:    Clerk JWT required.
 * Timeout: Inherits the Trigger.dev task `maxDuration` (60s).
 */
export async function POST(
  req: Request,
): Promise<NextResponse<CropImageExecuteResponse | CropImageExecuteErrorResponse>> {
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

  const { nodeId, imageUrl, xPercent, yPercent, widthPercent, heightPercent } = parsed.data

  // ── 3. Dispatch Trigger.dev task and wait for result ──────────────────────
  let result: CropImageResult
  try {
    const handle = await tasks.trigger<typeof cropImageTask>('crop-image-task', {
      nodeId,
      imageUrl,
      xPercent,
      yPercent,
      widthPercent,
      heightPercent,
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
        { error: `Crop task failed with status: ${run.status}` },
        { status: 500 },
      )
    }

    result = run.output as CropImageResult
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to dispatch crop-image task'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // ── 4. Return result ──────────────────────────────────────────────────────
  return NextResponse.json({ nodeId, cdnUrl: result.cdnUrl })
}
