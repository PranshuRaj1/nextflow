import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { runs } from '@trigger.dev/sdk'

/**
 * GET /api/workflow/run-status/[id]
 *
 * Server-side proxy for Trigger.dev run status polling.
 * Keeps the Trigger secret key on the server — the client never
 * calls Trigger.dev's API directly.
 *
 * @param params.id - The Trigger.dev run ID returned by execute-node
 * @returns { status, output?, error? }
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Auth check
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Missing run ID' }, { status: 400 })
  }

  // 2. Fetch run status from Trigger.dev SDK
  const run = await runs.retrieve(id)

  const FAILURE_STATUSES = ['FAILED', 'CRASHED', 'TIMED_OUT', 'EXPIRED', 'SYSTEM_FAILURE'] as const
  type FailureStatus = typeof FAILURE_STATUSES[number]
  const isFailed = (FAILURE_STATUSES as ReadonlyArray<string>).includes(run.status)

  return NextResponse.json({
    status: run.status,
    output: run.status === 'COMPLETED' ? (run.output as { text: string; model: string }) : undefined,
    error: isFailed
      ? (run.error?.message ?? `Task ended with status: ${run.status as FailureStatus}`)
      : undefined,
  })
}
