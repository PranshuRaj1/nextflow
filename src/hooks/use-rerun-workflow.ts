'use client'

// src/hooks/use-rerun-workflow.ts

import { useCallback, useState } from 'react'
import { useExecutionStore } from '@/stores/execution-store'
import { useWorkflowStore } from '@/stores/workflow-store'
import { collectInputs, dispatchNodeTask } from '@/lib/workflow/dispatch-node-task'
import type { AppNode, AppEdge } from '@/types/workflow'
import type { ExecuteWorkflowResponse } from '@/app/api/workflow/execute/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strips React Flow internal runtime fields from nodes that were stored in the
 * database. When Prisma returns JSON nodes they may contain stale internals
 * (e.g. `measured`, `positionAbsolute`, `selected`, `dragging`, `draggable`)
 * that confuse React Flow when it tries to re-initialise them. We keep only
 * the fields that the canvas needs and guarantee `position` is a valid {x, y}.
 *
 * Without this, RF crashes with:
 *   "Cannot read properties of undefined (reading 'x')"
 * because it reads `node.positionAbsolute.x` on a node whose internal state
 * is inconsistent with a fresh mount.
 */
function sanitiseNodes(raw: AppNode[]): AppNode[] {
  return raw.map((n) => ({
    id: n.id,
    type: n.type,
    data: n.data,
    position: {
      x: typeof n.position?.x === 'number' ? n.position.x : 0,
      y: typeof n.position?.y === 'number' ? n.position.y : 0,
    },
    // Preserve optional layout hints if they exist, but drop all RF internals
    ...(n.width != null  ? { width:  n.width  } : {}),
    ...(n.height != null ? { height: n.height } : {}),
  })) as AppNode[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Walks the execution plan wave by wave, dispatching node tasks and
 * forwarding outputs.  Shared by both `rerunWorkflow` and `loadAndRunWorkflow`.
 */
async function executeWaves(
  nodes: AppNode[],
  edges: AppEdge[],
  plan: ExecuteWorkflowResponse['plan'],
  callbacks: {
    setNodeRunning: (id: string) => void
    setNodeSuccess: (id: string, output: unknown) => void
    setNodeFailed: (id: string, error: string) => void
    setNodeSkipped: (id: string) => void
  },
): Promise<void> {
  const resolvedMap = new Map<string, unknown>()
  const failedNodeIds = new Set<string>()
  const { setNodeRunning, setNodeSuccess, setNodeFailed, setNodeSkipped } = callbacks

  for (const wave of plan.waves) {
    await Promise.all(
      wave.map(async (nodeId) => {
        const node = nodes.find((n) => n.id === nodeId)
        if (!node) {
          failedNodeIds.add(nodeId)
          setNodeFailed(nodeId, 'Node not found in snapshot')
          return
        }

        // Skip if any direct upstream dependency failed
        const incomingEdges = edges.filter((e) => e.target === nodeId)
        const hasFailedDep = incomingEdges.some((e) => failedNodeIds.has(e.source))
        if (hasFailedDep) {
          setNodeSkipped(nodeId)
          return
        }

        const resolvedInputs = collectInputs(nodeId, edges, resolvedMap)
        setNodeRunning(nodeId)

        try {
          const output = await dispatchNodeTask(node, resolvedInputs, plan.runId)
          resolvedMap.set(nodeId, output)
          setNodeSuccess(nodeId, output)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error during node execution'
          console.error(`[useRerunWorkflow] node "${nodeId}" failed:`, message)
          failedNodeIds.add(nodeId)
          setNodeFailed(nodeId, message)
        }
      }),
    )
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * `useRerunWorkflow`
 *
 * Provides two actions for the Run History sidebar buttons:
 *
 * ### `rerunWorkflow(workflowId, workflowName)`
 * Silent re-run — fetches the saved snapshot and executes it entirely in the
 * background. The current canvas is left untouched.
 *
 * ### `loadAndRunWorkflow(workflowId, workflowName)`
 * Load & Run — loads the saved snapshot into the canvas (replacing current
 * nodes/edges and setting the workflow name/id), then executes it.
 *
 * Both methods:
 * - Guard against concurrent runs (`isRunning` from executionStore)
 * - Track a per-card loading state (`rerunningId`) so the UI can show a
 *   spinner on exactly the card being acted on
 * - Use the shared `dispatchNodeTask` — identical execution path as the
 *   live-canvas run
 */
export function useRerunWorkflow() {
  // The run-card ID currently being re-run (for per-card spinner)
  const [rerunningId, setRerunningId] = useState<string | null>(null)

  const {
    isRunning,
    startRun,
    setNodeRunning,
    setNodeSuccess,
    setNodeFailed,
    setNodeSkipped,
    finishRun,
  } = useExecutionStore()

  const setNodes       = useWorkflowStore((s) => s.setNodes)
  const setEdges       = useWorkflowStore((s) => s.setEdges)
  const setWorkflowId  = useWorkflowStore((s) => s.setWorkflowId)
  const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName)

  // ── Shared inner runner ───────────────────────────────────────────────────

  const run = useCallback(
    async (
      workflowId: string,
      workflowName: string,
      nodes: AppNode[],
      edges: AppEdge[],
      /** Unique key to track the spinner — typically the WorkflowRun.id */
      spinnerKey: string,
    ) => {
      if (isRunning || rerunningId !== null) return

      setRerunningId(spinnerKey)

      try {
        // 1. Ask the server to register a new run and return the execution plan
        const res = await fetch('/api/workflow/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodes, edges, workflowId, workflowName }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
          console.error('[useRerunWorkflow] execute API error:', err.error)
          return
        }

        const data = await res.json() as ExecuteWorkflowResponse
        const { plan } = data

        // 2. Mark all nodes pending in the store
        startRun(plan.runId, plan.allNodeIds)

        // 3. Walk waves sequentially, nodes within a wave run in parallel
        await executeWaves(nodes, edges, plan, {
          setNodeRunning,
          setNodeSuccess,
          setNodeFailed,
          setNodeSkipped,
        })
      } catch (err) {
        console.error('[useRerunWorkflow] network error:', err)
      } finally {
        finishRun()
        setRerunningId(null)
      }
    },
    [
      isRunning,
      rerunningId,
      startRun,
      setNodeRunning,
      setNodeSuccess,
      setNodeFailed,
      setNodeSkipped,
      finishRun,
    ],
  )

  // ── Public actions ────────────────────────────────────────────────────────

  /**
   * Silent re-run.
   * Uses the nodes/edges already embedded in the history response — no
   * extra fetch needed.  Canvas is not touched.
   *
   * @param workflowId   - The workflow's DB id.
   * @param workflowName - Display name shown in the new run record.
   * @param nodes        - Snapshot nodes from the history response.
   * @param edges        - Snapshot edges from the history response.
   * @param runCardId    - The run card's id (used for spinner tracking).
   */
  const rerunWorkflow = useCallback(
    (
      workflowId: string,
      workflowName: string,
      nodes: AppNode[],
      edges: AppEdge[],
      runCardId: string,
    ) => {
      void run(workflowId, workflowName, nodes, edges, runCardId)
    },
    [run],
  )

  /**
   * Load & Run.
   * Loads the snapshot into the canvas (replacing current state) and executes.
   * Also syncs `workflowId` and `workflowName` in the store so subsequent
   * top-bar saves go to the right record.
   *
   * @param workflowId   - The workflow's DB id.
   * @param workflowName - Display name; also set in the workflow store.
   * @param nodes        - Snapshot nodes from the history response.
   * @param edges        - Snapshot edges from the history response.
   * @param runCardId    - The run card's id (used for spinner tracking).
   */
  const loadAndRunWorkflow = useCallback(
    (
      workflowId: string,
      workflowName: string,
      nodes: AppNode[],
      edges: AppEdge[],
      runCardId: string,
    ) => {
      // Sanitise DB JSON nodes before hydrating — strips stale RF internal fields
      // that cause "Cannot read properties of undefined (reading 'x')" on mount.
      const cleanNodes = sanitiseNodes(nodes)

      // Hydrate the canvas store before running
      setNodes(cleanNodes)
      setEdges(edges)
      setWorkflowId(workflowId)
      setWorkflowName(workflowName)

      void run(workflowId, workflowName, cleanNodes, edges, runCardId)
    },
    [run, setNodes, setEdges, setWorkflowId, setWorkflowName],
  )

  return {
    rerunWorkflow,
    loadAndRunWorkflow,
    /** True while a re-run or load-and-run is in progress (any card). */
    isRerunnning: rerunningId !== null,
    /** The specific run card currently showing a spinner; null otherwise. */
    rerunningId,
  }
}
