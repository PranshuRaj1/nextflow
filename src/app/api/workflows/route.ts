import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { ensureAppUser } from '@/lib/db/user'
import { currentUser } from '@clerk/nextjs/server'

/**
 * GET /api/workflows
 *
 * Returns all non-deleted workflows for the authenticated user,
 * ordered by most-recently-updated first.
 * Includes a `nodeCount` field computed from the stored JSON array.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const appUser = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!appUser) return NextResponse.json({ workflows: [] })

    const workflows = await prisma.workflow.findMany({
      where: { userId: appUser.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, nodes: true, updatedAt: true },
    })

    return NextResponse.json({
      workflows: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        updatedAt: w.updatedAt,
        nodeCount: Array.isArray(w.nodes) ? w.nodes.length : 0,
      })),
    })
  } catch (err) {
    console.error('[GET /api/workflows] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 })
  }
}

/**
 * POST /api/workflows
 *
 * Creates a new blank workflow for the authenticated user.
 * Returns { id } so the client can immediately navigate to /workflow/[id].
 */
export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress ?? 'unknown'
    const appUser = await ensureAppUser(userId, email)

    const workflow = await prisma.workflow.create({
      data: {
        userId: appUser.id,
        name: 'Untitled workflow',
        nodes: [],
        edges: [],
      },
    })

    return NextResponse.json({ id: workflow.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/workflows] Error:', err)
    return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 })
  }
}
