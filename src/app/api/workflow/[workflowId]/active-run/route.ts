import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workflowId } = await params

  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const activeRun = await prisma.workflowRun.findFirst({
      where: {
        workflowId,
        userId: user.id,
        status: { in: ['PENDING', 'RUNNING'] }
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true, status: true, startedAt: true }
    })

    if (!activeRun) {
      return NextResponse.json({ success: true, run: null })
    }

    return NextResponse.json({
      success: true,
      run: activeRun
    })
  } catch (err) {
    console.error('[GET /api/workflow/[workflowId]/active-run] Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
