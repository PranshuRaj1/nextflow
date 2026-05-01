import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { runId } = await params

  try {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        nodeExecutions: true,
      },
    })

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    // Ensure user has access to this run
    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user || run.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const nodesRecord: Record<string, { status: string; output: any; error: any }> = {}
    
    for (const execution of run.nodeExecutions) {
      nodesRecord[execution.nodeId] = {
        status: execution.status,
        output: execution.output,
        error: execution.error,
      }
    }

    return NextResponse.json({
      success: true,
      run: {
        status: run.status,
        lastHeartbeatAt: run.lastHeartbeatAt,
        completedAt: run.completedAt,
      },
      nodes: nodesRecord,
    })
  } catch (err) {
    console.error('[GET /api/workflow/runs/[runId]] Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
