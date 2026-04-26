import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { ensureAppUser } from '@/lib/db/user'
import { currentUser } from '@clerk/nextjs/server'
import { RunStatus } from '@prisma/client'

// ── Request schema ──────────────────────────────────────────────────────────

const finishSchema = z.object({
  runId: z.string().min(1),
  status: z.enum(['COMPLETED', 'PARTIAL', 'FAILED']),
  durationMs: z.number().int().nonnegative(),
})

// ── Route handler ───────────────────────────────────────────────────────────

/**
 * PATCH /api/workflow/finish
 *
 * Called by the frontend orchestrator after all execution waves complete.
 * Updates the WorkflowRun record with its final status, duration, and
 * completion timestamp.
 *
 * Auth:   Clerk JWT required.
 * Guard:  Ownership verified — the run must belong to the authenticated user.
 */
export async function PATCH(req: Request) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse + validate body ──────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = finishSchema.safeParse(body)
  if (!parsed.success) {
    const firstError =
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? 'Invalid request body'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { runId, status, durationMs } = parsed.data

  // ── 3. Resolve internal user id ───────────────────────────────────────────
  try {
    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress ?? 'unknown'
    const appUser = await ensureAppUser(userId, email)

    // ── 4. Update run — ownership enforced via where clause ──────────────────
    await prisma.workflowRun.update({
      where: {
        id: runId,
        userId: appUser.id, // prevents updating another user's run
      },
      data: {
        status: status as RunStatus,
        durationMs,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    // P2025 = record not found (wrong runId or ownership mismatch)
    const message = err instanceof Error ? err.message : 'Database update failed'
    console.error('[PATCH /api/workflow/finish] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
