import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { tasks } from '@trigger.dev/sdk'
import type { RunLlmPayload } from '@/types/tasks'

/**
 * Zod schema for the execute-node request body.
 * Validates all fields before dispatching the Trigger.dev task.
 */
const executeNodeSchema = z.object({
  nodeId: z.string().min(1),
  model: z.string().min(1),
  systemPrompt: z.string().optional(),
  userMessage: z.string().min(1, 'User message is required'),
  imageUrls: z.array(z.string().url()).optional(),
})

/**
 * POST /api/workflow/execute-node
 *
 * Authenticates the request, validates the payload, then dispatches
 * a `run-llm-task` Trigger.dev background task.
 *
 * Returns the Trigger.dev run handle ID so the client can poll for status.
 */
export async function POST(req: Request) {
  // 1. Auth check
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse + validate body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = executeNodeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const payload: RunLlmPayload = parsed.data

  // 3. Dispatch Trigger.dev task
  const handle = await tasks.trigger<typeof import('@/trigger/run-llm-task').runLlmTask>(
    'run-llm-task',
    payload,
  )

  return NextResponse.json({ runId: handle.id })
}
