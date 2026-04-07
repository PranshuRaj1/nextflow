// src/lib/workflow/dispatch-node-task.ts

/**
 * Shared node task dispatcher and input collector.
 *
 * Extracted from `use-workflow-execution.ts` so that both:
 *  - `useWorkflowExecution`  (live canvas run, triggered from TopBar)
 *  - `useRerunWorkflow`      (history re-run / load-and-run)
 *
 * share identical node-level execution logic without duplication.
 */

import type { AppNode, AppEdge } from '@/types/workflow'

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Resolved inputs collected from upstream nodes before a task is dispatched.
 * Keys are the target handle IDs defined on each node's input handles
 * (e.g. "system_prompt", "user_message", "image_url", "images").
 */
export type ResolvedInputs = Record<string, unknown>

// ── Input resolution ─────────────────────────────────────────────────────────

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
export function collectInputs(
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

// ── Node task dispatcher ──────────────────────────────────────────────────────

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
 * @param runId          - The current WorkflowRun ID (passed to node APIs).
 * @returns The node's output value (text string, CDN URL, etc.)
 * @throws  On non-ok HTTP responses or network failures.
 */
export async function dispatchNodeTask(
  node: AppNode,
  resolvedInputs: ResolvedInputs,
  runId: string,
): Promise<unknown> {
  switch (node.type) {
    // ── Source nodes: resolve from stored data, no Trigger.dev task ──────────

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

    // ── Processing nodes: dispatch Trigger.dev tasks via API routes ───────────

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
      const videoUrl = resolvedInputs['video_url'] as string | undefined
      if (!videoUrl) {
        throw new Error('Extract Frame node requires a video connected to the video_url handle')
      }

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
