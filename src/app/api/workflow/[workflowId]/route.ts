// src/app/api/workflow/[workflowId]/route.ts

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

/**
 * GET /api/workflow/:workflowId
 *
 * Returns the full workflow snapshot (name, nodes, edges) for a given ID.
 * Used by the "Run" and "Load & Run" buttons in the run history sidebar.
 *
 * Auth: Clerk JWT required. The workflow must belong to the authenticated user.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workflowId } = await params

  try {
    const appUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    })

    if (!appUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: {
        id: true,
        name: true,
        nodes: true,
        edges: true,
        updatedAt: true,
        userId: true,
      },
    })

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Ownership check — users can only load their own workflows
    if (workflow.userId !== appUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      id: workflow.id,
      name: workflow.name,
      nodes: workflow.nodes,
      edges: workflow.edges,
      updatedAt: workflow.updatedAt,
    })
  } catch (err) {
    console.error('[GET /api/workflow/:workflowId] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch workflow' }, { status: 500 })
  }
}
