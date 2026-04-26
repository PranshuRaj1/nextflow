// src/app/api/workflow/[workflowId]/route.ts

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { ensureAppUser } from '@/lib/db/user'
import { currentUser } from '@clerk/nextjs/server'

/**
 * GET /api/workflow/:workflowId
 *
 * Returns the full workflow snapshot (name, nodes, edges) for a given ID.
 * Used by the editor page and "Load & Run" buttons in the run history sidebar.
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

// ── PATCH ─────────────────────────────────────────────────────────────────────

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  nodes: z.array(z.any()).optional(),
  edges: z.array(z.any()).optional(),
})

/**
 * PATCH /api/workflow/:workflowId
 *
 * Saves updated name, nodes, and/or edges for a workflow.
 * Only the fields present in the body are updated (partial update).
 * Ownership is enforced via the `where` clause.
 *
 * Auth: Clerk JWT required.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workflowId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    const firstError =
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? 'Invalid request body'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  try {
    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress ?? 'unknown'
    const appUser = await ensureAppUser(userId, email)

    await prisma.workflow.update({
      where: {
        id: workflowId,
        userId: appUser.id, // ownership guard
      },
      data: {
        ...(parsed.data.name  !== undefined && { name:  parsed.data.name  }),
        ...(parsed.data.nodes !== undefined && { nodes: parsed.data.nodes }),
        ...(parsed.data.edges !== undefined && { edges: parsed.data.edges }),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database update failed'
    console.error('[PATCH /api/workflow/:workflowId] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

