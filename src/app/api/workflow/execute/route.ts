// src/app/api/workflow/execute/route.ts

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildExecutionWaves } from '@/lib/workflow/topological-sort'
import { prisma } from '@/lib/db/prisma'
import { RunScope, RunStatus } from '@prisma/client'
import { ensureAppUser } from '@/lib/db/user'
import { currentUser } from '@clerk/nextjs/server'

// ── Request schema ──────────────────────────────────────────────────────────

/**
 * Minimal edge shape needed for DAG validation.
 * We only need source/target to build the adjacency graph.
 */
const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
})

/**
 * Minimal node shape. `type` drives which Trigger.dev task to dispatch.
 * `data` carries the node's current field values (text content, CDN URLs, etc.)
 */
const nodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.any()),
})

export const executeWorkflowSchema = z.object({
  /**
   * All nodes currently on the canvas.
   * Disconnected (isolated) nodes are included — the execution engine
   * will place them in Wave 0 and run them independently.
   */
  nodes: z.array(nodeSchema).min(1, 'Workflow must have at least one node'),

  /** All edges currently on the canvas. */
  edges: z.array(edgeSchema),

  /**
   * Subset of node IDs to execute.
   * When omitted the full workflow runs (scope: "full").
   * Pass a single-element array for scope: "single".
   */
  selectedNodeIds: z.array(z.string()).optional(),

  /**
   * The persistent ID of the workflow being executed.
   * If omitted, the engine will upsert a default "Untitled workflow" for the user.
   */
  workflowId: z.string().nullable().optional(),

  /**
   * Optional name from the frontend for auto-saving the workflow.
   * Defaults to "Untitled workflow" in the database.
   */
  workflowName: z.string().optional(),
})

export type ExecuteWorkflowRequest = z.infer<typeof executeWorkflowSchema>

// ── Response types ──────────────────────────────────────────────────────────

export interface ExecutionPlan {
  runId: string
  scope: 'full' | 'partial' | 'single'
  /** All node IDs that will be executed, in the order determined by the sort. */
  allNodeIds: string[]
  /**
   * Wave groups for the frontend orchestrator.
   * Each inner array can be dispatched concurrently via Promise.all.
   */
  waves: string[][]
}

export interface ExecuteWorkflowResponse {
  success: true
  plan: ExecutionPlan
}

export interface ExecuteWorkflowErrorResponse {
  success: false
  error: string
}

// ── Route handler ───────────────────────────────────────────────────────────

/**
 * POST /api/workflow/execute
 *
 * Validates the incoming DAG, builds a wave-based execution plan, and
 * creates a WorkflowRun stub record (full persistence wired in Phase 5).
 *
 * Auth: Clerk JWT required.
 * Returns: ExecuteWorkflowResponse with the execution plan the frontend
 *   orchestrator will walk through wave by wave.
 */
export async function POST(
  req: Request,
): Promise<NextResponse<ExecuteWorkflowResponse | ExecuteWorkflowErrorResponse>> {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse + validate body ──────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const parsed = executeWorkflowSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[POST /api/workflow/execute] Validation error:', parsed.error.flatten())
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const { nodes, edges, selectedNodeIds, workflowId, workflowName } = parsed.data

  // ── 3. Determine scope + node subset ─────────────────────────────────────
  const scope: 'full' | 'partial' | 'single' =
    selectedNodeIds === undefined
      ? 'full'
      : selectedNodeIds.length === 1
        ? 'single'
        : 'partial'

  const activeNodeIds =
    selectedNodeIds !== undefined && selectedNodeIds.length > 0
      ? nodes.filter((n) => selectedNodeIds.includes(n.id)).map((n) => n.id)
      : nodes.map((n) => n.id)

  // ── 4. DAG validation + wave building ────────────────────────────────────
  let waves: string[][]
  try {
    waves = buildExecutionWaves(activeNodeIds, edges)
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Cycle detected in workflow — please remove circular connections',
      },
      { status: 422 },
    )
  }

  // ── 5. Create WorkflowRun record ──────────────────────────────────────────
  try {
    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress ?? 'unknown'
    const appUser = await ensureAppUser(userId, email)

    // ── 5.1 Resolve Workflow ID ──────────────────────────────────────────────
    let finalWorkflowId = workflowId

    if (finalWorkflowId) {
      await prisma.workflow.update({
        where: { id: finalWorkflowId },
        data: {
          name: workflowName ?? 'Untitled workflow',
          nodes: nodes as any,
          edges: edges as any,
        },
      })
    } else {
      const defaultWorkflow = await prisma.workflow.upsert({
        where: { id: `default_${userId}` },
        create: {
          id: `default_${userId}`,
          userId: appUser.id,
          name: workflowName ?? 'Untitled workflow',
          nodes: nodes as any,
          edges: edges as any,
        },
        update: {
          name: workflowName ?? 'Untitled workflow',
          nodes: nodes as any,
          edges: edges as any,
        },
      })
      finalWorkflowId = defaultWorkflow.id
    }

    // ── 5.2 Create WorkflowRun record ─────────────────────────────────────────
    const run = await prisma.workflowRun.create({
      data: {
        userId: appUser.id,
        workflowId: finalWorkflowId!,
        name: workflowName ?? 'Untitled workflow',
        status: RunStatus.PENDING,
        scope:
          scope === 'full'
            ? RunScope.FULL
            : scope === 'single'
              ? RunScope.SINGLE
              : RunScope.PARTIAL,
        startedAt: new Date(),
      },
    })

    const runId = run.id

    // ── 6. Return execution plan ──────────────────────────────────────────────
    const plan: ExecutionPlan = {
      runId,
      scope,
      allNodeIds: activeNodeIds,
      waves,
    }

    return NextResponse.json({ success: true, plan })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database operation failed'
    console.error('[POST /api/workflow/execute] Error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}