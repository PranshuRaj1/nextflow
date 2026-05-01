'use client'

import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useWorkflowStore } from '@/stores/workflow-store'
import { useExecutionStore } from '@/stores/execution-store'
import type { AppEdge } from '@/types/workflow'
import type { ExecuteWorkflowResponse } from '@/app/api/workflow/execute/route'
import { collectInputs, dispatchNodeTask } from '@/lib/workflow/dispatch-node-task'

/**
 * `useWorkflowExecution`
 *
 * Frontend orchestrator for server-side workflow execution.
 *
 * ### Execution flow
 * 1. POSTs current canvas state to `POST /api/workflow/execute` → receives
 *    a plan and `runId`. The API internally dispatches the Trigger.dev Master Task.
 * 2. Calls `executionStore.startRun(runId)` — marks nodes `pending`.
 * 3. A `useEffect` loop polls `/api/workflow/runs/[runId]` every 1.5s to 
 *    sync the server's NodeExecution states into the `executionStore`.
 * 4. When the Master Task completes, the loop finishes and shows a toast.
 */
export function useWorkflowExecution() {
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const workflowId = useWorkflowStore((s) => s.workflowId)
  const workflowName = useWorkflowStore((s) => s.workflowName)

  const {
    isRunning,
    currentRunId,
    startRun,
    mergeNodeResults,
    finishRun,
  } = useExecutionStore()

  // ── 1. Recovery on mount ──────────────────────────────────────────────────
  useEffect(() => {
    // Only check if we are bound to a saved workflow and not already running
    if (!workflowId || isRunning) return

    const checkActiveRun = async () => {
      try {
        const res = await fetch(`/api/workflow/${workflowId}/active-run`)
        if (!res.ok) return
        const data = await res.json()
        if (data.success && data.run) {
          // Resume polling for this active run
          // We pass all canvas node IDs so they get initialized in the store
          startRun(data.run.id, nodes.map((n) => n.id))
        }
      } catch (err) {
        console.error('[useWorkflowExecution] recovery check error:', err)
      }
    }
    
    void checkActiveRun()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId])

  // ── 2. Polling Active Run ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning || !currentRunId) return

    let intervalId: NodeJS.Timeout

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/workflow/runs/${currentRunId}`)
        if (!res.ok) return
        
        const data = await res.json()
        if (!data.success) return

        // Bulk merge results
        mergeNodeResults(data.nodes)

        // Check if terminal
        if (['COMPLETED', 'FAILED', 'PARTIAL', 'CANCELLED'].includes(data.run.status)) {
          clearInterval(intervalId)
          
          // Prevent duplicate toasts if concurrent polls both return terminal status
          if (!useExecutionStore.getState().isRunning) return
          
          finishRun()
          
          const failedCount = Object.values(data.nodes).filter((n: any) => n.status === 'FAILED').length
          const skippedCount = Object.values(data.nodes).filter((n: any) => n.status === 'SKIPPED').length

          if (failedCount > 0) {
            toast.error(
              `Workflow completed with ${failedCount} failed node${failedCount > 1 ? 's' : ''}` +
                (skippedCount > 0 ? ` and ${skippedCount} skipped` : ''),
              { description: 'Click the red nodes to see what went wrong.' },
            )
          } else {
            toast.success('Workflow completed successfully')
          }
        } else if (data.run.status === 'RUNNING' && data.run.lastHeartbeatAt) {
          const heartbeatTime = new Date(data.run.lastHeartbeatAt).getTime()
          const now = Date.now()
          // 5 minutes staleness check
          if (now - heartbeatTime > 5 * 60 * 1000) {
            // Avoid spamming the toast by storing a flag on the window object
            if (!(window as any).__stalledWarningShown) {
              toast.warning('This run may have stalled. No heartbeat received in 5 minutes.', { duration: 10000 })
              ;(window as any).__stalledWarningShown = true
            }
          }
        }
      } catch (err) {
        console.error('[useWorkflowExecution] polling error:', err)
      }
    }

    intervalId = setInterval(pollStatus, 1500)
    void pollStatus() // fetch immediately

    return () => clearInterval(intervalId)
  }, [isRunning, currentRunId, mergeNodeResults, finishRun])

  // ── 3. Start New Run ──────────────────────────────────────────────────────
  const runWorkflow = useCallback(async () => {
    if (isRunning) return
    if (nodes.length === 0) return

    try {
      const res = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, workflowId, workflowName }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
        console.error('[useWorkflowExecution] execute API error:', err.error)
        toast.error(`Execution failed: ${err.error ?? 'Unknown error'}`)
        return
      }

      const data = await res.json() as ExecuteWorkflowResponse
      startRun(data.plan.runId, data.plan.allNodeIds)
    } catch (err) {
      console.error('[useWorkflowExecution] network error:', err)
      toast.error('Network error starting workflow')
    }
  }, [isRunning, nodes, edges, workflowId, workflowName, startRun])

  // ── 4. Retry Single Node (Client-Side) ────────────────────────────────────
  /**
   * Retries a single failed node locally. It calls the node's API route directly
   * bypassing the master task, which is perfect for quick one-off retries.
   */
  const retryNode = useCallback(
    async (nodeId: string) => {
      if (isRunning) return

      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return

      const storeState = useExecutionStore.getState()
      const runId = storeState.lastRunId ?? ''

      const resolvedMap = new Map<string, unknown>()
      for (const [id, result] of Object.entries(storeState.nodeResults)) {
        if (result.status === 'success') {
          resolvedMap.set(id, result.output)
        }
      }

      const resolvedInputs = collectInputs(nodeId, edges, resolvedMap)

      useExecutionStore.getState().setNodeRunning(nodeId)

      try {
        const output = await dispatchNodeTask(node, resolvedInputs, runId)
        useExecutionStore.getState().setNodeSuccess(nodeId, output)
        toast.success('Node retried successfully')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        useExecutionStore.getState().setNodeFailed(nodeId, message)
      }
    },
    [isRunning, nodes, edges],
  )

  return { runWorkflow, retryNode, isRunning }
}