'use client'

import { useCallback } from 'react'
import { useWorkflowStore } from '@/stores/workflow-store'
import { useExecutionStore } from '@/stores/execution-store'
import type { AppEdge } from '@/types/workflow'
import type { ExecuteWorkflowResponse } from '@/app/api/workflow/execute/route'
import { collectInputs, dispatchNodeTask } from '@/lib/workflow/dispatch-node-task'

// collectInputs and dispatchNodeTask are now in @/lib/workflow/dispatch-node-task

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * `useWorkflowExecution`
 *
 * Frontend orchestrator for Phase 4 global workflow execution.
 *
 * ### Execution flow
 * 1. POSTs current canvas state to `POST /api/workflow/execute` → receives
 *    a wave plan (`string[][]`).
 * 2. Calls `executionStore.startRun()` — marks all nodes `pending` and
 *    triggers the status badge / glow animation system.
 * 3. Iterates waves sequentially. Within each wave, all nodes are dispatched
 *    concurrently via `Promise.all` — independent branches run in parallel.
 * 4. Upstream outputs are forwarded to downstream nodes via `resolvedMap`.
 *    Connected handle values always win over inline node field values.
 * 5. If a node fails, its ID is added to `failedNodeIds`. Any downstream
 *    node with a failed upstream dependency is marked `skipped` rather than
 *    attempted with incomplete inputs.
 * 6. `finishRun()` is called when all waves complete. Per-node results are
 *    kept in the store so the canvas continues to display outputs.
 *
 * ### Orchestration choice
 * Uses **frontend orchestration** for Phase 4. The wave loop runs in the
 * browser. Trigger.dev tasks dispatched mid-run will complete server-side
 * even if the tab is closed, but the UI won't reflect those results.
 * Replacing the internals of `runWorkflow` with a master Trigger.dev task
 * in a later phase requires no changes to the store or TopBar integration.
 *
 * @returns `runWorkflow` — call when the user clicks Run.
 *          `isRunning`   — bind to the Run button's disabled/loading state.
 */
export function useWorkflowExecution() {
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const workflowId = useWorkflowStore((s) => s.workflowId)
  const workflowName = useWorkflowStore((s) => s.workflowName)

  const {
    isRunning,
    startRun,
    setNodeRunning,
    setNodeSuccess,
    setNodeFailed,
    setNodeSkipped,
    finishRun,
  } = useExecutionStore()

  const runWorkflow = useCallback(async () => {
    if (isRunning) return
    if (nodes.length === 0) return

    // ── 1. Fetch execution plan from the API ────────────────────────────────
    let plan: ExecuteWorkflowResponse['plan']
    try {
      const res = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, workflowId, workflowName }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
        console.error('[useWorkflowExecution] execute API error:', err.error)
        return
      }

      const data = await res.json() as ExecuteWorkflowResponse
      plan = data.plan
    } catch (err) {
      console.error('[useWorkflowExecution] network error:', err)
      return
    }

    // ── 2. Initialise store — all nodes → `pending` ─────────────────────────
    startRun(plan.runId, plan.allNodeIds)

    /**
     * `resolvedMap`: nodeId → output, built up as waves complete.
     * This is the data bus that carries outputs between nodes.
     */
    const resolvedMap = new Map<string, unknown>()

    /**
     * `failedNodeIds`: nodes that errored this run.
     * Downstream dependents are skipped rather than run with missing inputs.
     */
    const failedNodeIds = new Set<string>()

    // ── 3. Walk waves sequentially ──────────────────────────────────────────
    for (const wave of plan.waves) {
      // All nodes in a wave are dispatched concurrently
      await Promise.all(
        wave.map(async (nodeId) => {
          const node = nodes.find((n) => n.id === nodeId)
          if (!node) {
            failedNodeIds.add(nodeId)
            setNodeFailed(nodeId, 'Node not found on canvas — was it deleted?')
            return
          }

          // Skip if any direct upstream dependency failed
          const incomingEdges = edges.filter((e) => e.target === nodeId)
          const hasFailedDep = incomingEdges.some((e) => failedNodeIds.has(e.source))
          if (hasFailedDep) {
            setNodeSkipped(nodeId)
            return
          }

          // Collect all resolved upstream outputs for this node's handles
          const resolvedInputs = collectInputs(nodeId, edges, resolvedMap)

          // Mark running → triggers glow animation on the node card
          setNodeRunning(nodeId)

          try {
            const output = await dispatchNodeTask(node, resolvedInputs, plan.runId)
            resolvedMap.set(nodeId, output)
            setNodeSuccess(nodeId, output)
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'Unknown error during node execution'
            console.error(`[useWorkflowExecution] node "${nodeId}" failed:`, message)
            failedNodeIds.add(nodeId)
            setNodeFailed(nodeId, message)
          }
        }),
      )
    }

    // ── 4. All waves complete ───────────────────────────────────────────────
    finishRun()
  }, [
    isRunning,
    nodes,
    workflowId,
    workflowName,
    startRun,
    setNodeRunning,
    setNodeSuccess,
    setNodeFailed,
    setNodeSkipped,
    finishRun,
  ])

  return { runWorkflow, isRunning }
}