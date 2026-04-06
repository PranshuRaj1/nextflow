import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { tasks, runs } from '@trigger.dev/sdk/v3'
import type { runLlmTask } from '@/trigger/run-llm-task'
import type { RunLlmResult } from '@/types/tasks'

// ── Request schema ──────────────────────────────────────────────────────────

const requestSchema = z.object({
  nodeId: z.string().min(1),
  model: z.string().min(1),
  systemPrompt: z.string().optional(),
  userMessage: z.string().min(1, 'userMessage is required'),
  imageUrls: z.array(z.string().url()).optional().default([]),
  runId: z.string().optional(),
})

type LlmExecuteRequest = z.infer<typeof requestSchema>

// ── Response types ──────────────────────────────────────────────────────────

interface LlmExecuteResponse {
  nodeId: string
  text: string
  model: string
}

interface LlmExecuteErrorResponse {
  error: string
}

// ── Route handler ───────────────────────────────────────────────────────────

/**
 * POST /api/nodes/llm/execute
 *
 * Triggers the `run-llm-task` Trigger.dev background task and waits for
 * completion before returning the result to the frontend orchestrator.
 *
 * Flow:
 * 1. Clerk auth check.
 * 2. Zod validates the request body.
 * 3. `tasks.triggerAndWait` dispatches the task and blocks until it resolves.
 * 4. Returns the generated text to `useWorkflowExecution`.
 *
 * Auth:    Clerk JWT required.
 * Timeout: Inherits the Trigger.dev task `maxDuration` (120s).
 */
export async function POST(
  req: Request,
): Promise<NextResponse<LlmExecuteResponse | LlmExecuteErrorResponse>> {
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

  const { nodeId, model, systemPrompt, userMessage, imageUrls }: LlmExecuteRequest = parsed.data

  // ── 3. Dispatch Trigger.dev task and wait for result ──────────────────────
  let result: RunLlmResult
  try {
    const handle = await tasks.trigger<typeof runLlmTask>('run-llm-task', {
      nodeId,
      runId: parsed.data.runId,
      model,
      systemPrompt,
      userMessage,
      imageUrls,
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
        { error: `LLM task failed with status: ${run.status}` },
        { status: 500 },
      )
    }

    result = run.output as RunLlmResult
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to dispatch LLM task'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // ── 4. Return result ──────────────────────────────────────────────────────
  return NextResponse.json({ nodeId, text: result.text, model: result.model })
}
