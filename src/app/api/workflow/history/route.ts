import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

/**
 * GET /api/workflow/history
 *
 * Fetches the most recent workflow runs for the authenticated user.
 * Returns a list of runs with their status, duration, and associated workflow metadata.
 *
 * Auth: Clerk JWT required.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Fetch user from our DB to get internal ID
    const appUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    })

    if (!appUser) {
      return NextResponse.json({ runs: [] })
    }

    // 2. Fetch recent runs with basic node execution summaries
    const runs = await prisma.workflowRun.findMany({
      where: { userId: appUser.id },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        workflowId: true,
        status: true,
        scope: true,
        durationMs: true,
        startedAt: true,
        name: true,
        workflow: {
          select: {
            name: true,
            nodes: true,
            edges: true,
          },
        },
        _count: {
          select: { nodeExecutions: true }
        }
      },
    })

    return NextResponse.json({ runs })
  } catch (err) {
    console.error('[GET /api/workflow/history] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch run history' }, { status: 500 })
  }
}
