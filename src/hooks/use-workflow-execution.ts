'use client'

import { useCallback } from 'react'
import { useWorkflowStore } from '@/stores/workflow-store'
import { useExecutionStore } from '@/stores/execution-store'
import type { AppNode, AppEdge } from '@/types/workflow'
import type { ExecuteWorkflowResponse } from '@/app/api/workflow/execute/route'

// ── Input resolution ────────────────────────────────────────────────────────

/**
 * Resolved inputs collected from upstream nodes before a task is dispatched.
 * Keys are the target handle IDs defined on each node's input handles
 * (e.g. "system_prompt", "user_message", "image_url", "images").
 */
type ResolvedInputs = Record<string, unknown>

/**
 * Collects the resolved outputs from upstream nodes and maps them to the
 * target node's input handles.
 *
 * ### Multi-connection handles
 * The `images` handle on the LLM node accepts multiple incoming edges.
 * Each upstream output is accumulated into an array so the task receives
 * `imageUrls: string[]` regardless of how many Image nodes are connected.
 *
 * @param targetNodeId - The node we are about to execute.
 * @param edges        - All edges in the workflow.
 * @param resolvedMap  - Accumulated nodeId → output map from previous waves.
 */
function collectInputs(
  targetNodeId: string,
  edges: AppEdge[],
  resolvedMap: Map<string, unknown>,
): ResolvedInputs {
  const inputs: ResolvedInputs = {}

  for (const edge of edges) {
    if (edge.target !== targetNodeId) continue
    const upstream = resolvedMap.get(edge.source)
    if (upstream === undefined) continue

    const handle = edge.targetHandle ?? 'input'

    // `images` handle accumulates multiple connections into an array
    if (handle === 'images') {
      const existing = inputs['images']
      if (Array.isArray(existing)) {
        existing.push(upstream)
      } else {
        inputs['images'] = [upstream]
      }
    } else {
      inputs[handle] = upstream
    }
  }

  return inputs
}

// ── Node task dispatcher ────────────────────────────────────────────────────

/**
 * Dispatches the appropriate action for a single node.
 *
 * Source nodes (text, uploadImage, uploadVideo) resolve immediately from
 * their stored node data — no API call is needed.
 *
 * Processing nodes (llm, cropImage, extractFrame) call their respective
 * API routes which internally trigger Trigger.dev background tasks and
 * block until the result is ready.
 *
 * Connected handle values always win over the node's inline field values,
 * so a Text node piped into `system_prompt` overrides whatever is typed
 * directly in the LLM node's system prompt textarea.
 *
 * @param node           - The AppNode being executed.
 * @param resolvedInputs - Outputs from upstream nodes keyed by handle ID.
 * @returns The node's output value (text string, CDN URL, etc.)
 * @throws  On non-ok HTTP responses or network failures.
 */
async function dispatchNodeTask(
  node: AppNode,
  resolvedInputs: ResolvedInputs,
  runId: string,
): Promise<unknown> {
  switch (node.type) {
    // ── Source nodes: resolve from stored data, no Trigger.dev task ─────────

    case 'text': {
      const data = node.data as any
      return data.value ?? ''
    }

    case 'uploadImage': {
      const data = node.data as any
      const url = data.imageUrl
      if (!url) throw new Error('Upload Image node has no uploaded image yet')
      return url
    }

    case 'uploadVideo': {
      const data = node.data as any
      const url = data.videoUrl
      if (!url) throw new Error('Upload Video node has no uploaded video yet')
      return url
    }

    // ── Processing nodes: dispatch Trigger.dev tasks via API routes ──────────

    case 'llm': {
      const data = node.data as any
      // Connected handle values override inline node fields
      const systemPrompt =
        (resolvedInputs['system_prompt'] as string | undefined) ??
        data.systemPrompt

      const userMessage =
        (resolvedInputs['user_message'] as string | undefined) ??
        data.userMessage

      if (!userMessage?.trim()) {
        throw new Error('LLM node requires a user message (connected or typed directly)')
      }

      const imageUrls = resolvedInputs['images']
        ? (Array.isArray(resolvedInputs['images'])
          ? resolvedInputs['images']
          : [resolvedInputs['images']]) as string[]
        : []

      const res = await fetch('/api/nodes/llm/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          runId,
          model: data.model,
          systemPrompt: systemPrompt || undefined,
          userMessage,
          imageUrls,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
        throw new Error(err.error ?? `LLM execute failed (HTTP ${res.status})`)
      }

      const resData = await res.json() as { text: string }
      return resData.text
    }

    case 'cropImage': {
      const data = node.data as Record<string, any>
      // image_url handle wins; CropImageNode has no inline URL field
      const imageUrl = resolvedInputs['image_url'] as string | undefined
      if (!imageUrl) {
        throw new Error('Crop Image node requires an image connected to the image_url handle')
      }

      // Numeric handles override inline number fields; both stored as strings in node data
      const xPercent =
        (resolvedInputs['x_percent'] as number | string | undefined) ??
        data.xPercent
      const yPercent =
        (resolvedInputs['y_percent'] as number | string | undefined) ??
        data.yPercent
      const widthPercent =
        (resolvedInputs['width_percent'] as number | string | undefined) ??
        data.widthPercent
      const heightPercent =
        (resolvedInputs['height_percent'] as number | string | undefined) ??
        data.heightPercent

      const res = await fetch('/api/nodes/crop-image/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          runId,
          imageUrl,
          xPercent,
          yPercent,
          widthPercent,
          heightPercent,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
        throw new Error(err.error ?? `Crop Image execute failed (HTTP ${res.status})`)
      }

      const resData = await res.json() as { cdnUrl: string }
      return resData.cdnUrl
    }

    case 'extractFrame': {
      const data = node.data as any
      // video_url handle wins over any inline value
      const videoUrl = resolvedInputs['video_url'] as string | undefined
      if (!videoUrl) {
        throw new Error('Extract Frame node requires a video connected to the video_url handle')
      }

      // timestamp handle wins over the inline timestamp field
      const timestamp =
        (resolvedInputs['timestamp'] as number | string | undefined) ??
        data.timestamp

      const res = await fetch('/api/nodes/extract-frame/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          runId,
          videoUrl,
          timestamp,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
        throw new Error(err.error ?? `Extract Frame execute failed (HTTP ${res.status})`)
      }

      const resData = await res.json() as { cdnUrl: string }
      return resData.cdnUrl
    }

    default: {
      throw new Error(`Unknown node type: ${(node as any).type}`)
    }
  }
}

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