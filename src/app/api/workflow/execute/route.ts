// src/app/api/workflow/execute/route.ts

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildExecutionWaves } from '@/lib/workflow/topological-sort'

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
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors.nodes?.[0] ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const { nodes, edges, selectedNodeIds } = parsed.data

  // ── 3. Determine scope + node subset ─────────────────────────────────────
  const scope: 'full' | 'partial' | 'single' =
    selectedNodeIds === undefined
      ? 'full'
      : selectedNodeIds.length === 1
        ? 'single'
        : 'partial'

  /**
   * When running a subset we still need to include all nodes in the DAG
   * so the wave algorithm can correctly resolve dependencies.
   * The frontend orchestrator will skip nodes not in `selectedNodeIds`
   * by treating them as already-resolved with their cached output.
   */
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

  // ── 5. Create WorkflowRun record (stub — Prisma wired in Phase 5) ─────────
  /**
   * TODO (Phase 5): replace this stub with a real Prisma upsert:
   *
   * const run = await prisma.workflowRun.create({
   *   data: {
   *     userId,
   *     workflowId: parsed.data.workflowId,
   *     status: 'running',
   *     scope,
   *     startedAt: new Date(),
   *   },
   * })
   * const runId = run.id
   */
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  // ── 6. Return execution plan ──────────────────────────────────────────────
  const plan: ExecutionPlan = {
    runId,
    scope,
    allNodeIds: activeNodeIds,
    waves,
  }

  return NextResponse.json({ success: true, plan })
}