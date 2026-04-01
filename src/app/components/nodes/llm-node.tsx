'use client'

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, useCallback, useEffect, useRef } from 'react'
import { Loader2, Play } from 'lucide-react'
import { useWorkflowStore } from '@/stores/workflow-store'
import { useTargetHandleConnected } from '@/hooks/use-handle-connected'
import type { LlmNodeData, UploadImageNodeData } from '@/types/workflow'
import { GEMINI_MODEL_OPTIONS, SOURCE_HANDLE_ID } from '@/types/workflow'
import { cn } from '@/lib/utils/cn'

const handleCls = '!h-2.5 !w-2.5 !border-2 !border-[var(--accent)] !bg-zinc-950'

/** How often (ms) to poll the run-status endpoint after triggering. */
const POLL_INTERVAL_MS = 1500

/**
 * Multimodal LLM node: optional system + required user message + multi image inputs.
 * On "Run" click it dispatches a Trigger.dev task and polls for the result.
 * Results render inline — no separate output node needed.
 * Pulsating border appears while `status === 'running'`.
 */
function LlmNodeInner(props: NodeProps<Node<LlmNodeData, 'llm'>>) {
  const { id, data, selected } = props
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)

  const sysConn = useTargetHandleConnected(id, 'system_prompt')
  const userConn = useTargetHandleConnected(id, 'user_message')
  const imgConn = useTargetHandleConnected(id, 'images')

  /** Ref to the polling interval so we can clear it on unmount / completion. */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stop polling when component unmounts
  useEffect(() => {
    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current)
      }
    }
  }, [])

  /**
   * Resolve the effective value of a connected text handle by tracing the
   * edge back to its source node's data.
   */
  const resolveTextHandle = useCallback(
    (handleId: string): string | undefined => {
      const edge = edges.find((e) => e.target === id && e.targetHandle === handleId)
      if (!edge) return undefined
      const sourceNode = nodes.find((n) => n.id === edge.source)
      if (!sourceNode) return undefined
      const d = sourceNode.data as Record<string, unknown>
      // Text nodes store their value in `data.value`
      const v = d['value']
      return typeof v === 'string' ? v : undefined
    },
    [id, nodes, edges],
  )

  /**
   * Collect CDN URLs for all image nodes wired into the `images` handle.
   */
  const resolveImageUrls = useCallback((): string[] => {
    const imageEdges = edges.filter((e) => e.target === id && e.targetHandle === 'images')
    return imageEdges
      .map((e) => {
        const sourceNode = nodes.find((n) => n.id === e.source)
        if (!sourceNode) return null
        const d = sourceNode.data as Partial<UploadImageNodeData>
        return d.imageUrl ?? null
      })
      .filter((url): url is string => url !== null)
  }, [id, nodes, edges])

  /** Start polling a Trigger.dev run until it completes or fails. */
  const startPolling = useCallback(
    (runId: string) => {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/workflow/run-status/${runId}`)
          if (!res.ok) return // transient error — keep polling

          const json = (await res.json()) as {
            status: string
            output?: { text: string; model: string }
            error?: string
          }

          if (json.status === 'COMPLETED' && json.output) {
            clearInterval(pollRef.current!)
            pollRef.current = null
            updateNodeData(id, {
              resultText: json.output.text,
              status: 'success',
              errorMessage: undefined,
            })
          } else if (json.error) {
            clearInterval(pollRef.current!)
            pollRef.current = null
            updateNodeData(id, {
              status: 'error',
              errorMessage: json.error,
            })
          }
          // Otherwise keep polling (PENDING / QUEUED / EXECUTING…)
        } catch {
          // Network error — keep polling silently
        }
      }, POLL_INTERVAL_MS)
    },
    [id, updateNodeData],
  )

  /** Dispatch the run-llm-task and start polling. */
  const handleRun = useCallback(async () => {
    // Resolve inputs — prefer connected handle values over inline text
    const systemPrompt = sysConn
      ? resolveTextHandle('system_prompt')
      : data.systemPrompt || undefined
    const userMessage = userConn
      ? (resolveTextHandle('user_message') ?? data.userMessage)
      : data.userMessage

    if (!userMessage.trim()) {
      updateNodeData(id, {
        status: 'error',
        errorMessage: 'User message is required before running.',
      })
      return
    }

    const imageUrls = imgConn ? resolveImageUrls() : []

    updateNodeData(id, { status: 'running', resultText: '', errorMessage: undefined })

    try {
      const res = await fetch('/api/workflow/execute-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: id,
          model: data.model,
          systemPrompt,
          userMessage,
          imageUrls,
        }),
      })

      if (!res.ok) {
        const raw = await res.text()
        let message = `HTTP ${res.status}`
        try {
          const err = JSON.parse(raw) as { error?: unknown }
          message = String(err.error ?? message)
        } catch {
          // Server returned HTML — use status code only
        }
        throw new Error(message)
      }

      const raw = await res.text()
      const { runId } = JSON.parse(raw) as { runId: string }
      startPolling(runId)
    } catch (err: unknown) {
      updateNodeData(id, {
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Failed to start task.',
      })
    }
  }, [
    id,
    data.model,
    data.systemPrompt,
    data.userMessage,
    sysConn,
    userConn,
    imgConn,
    resolveTextHandle,
    resolveImageUrls,
    startPolling,
    updateNodeData,
  ])

  const isRunning = data.status === 'running'

  return (
    <div
      className={cn(
        'relative min-w-[280px] max-w-[320px] rounded-xl border border-[var(--node-border)] bg-[var(--node-bg)] p-3 shadow-lg',
        selected && 'ring-1 ring-[var(--accent)]',
        isRunning && 'nextflow-node-running',
      )}
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Run any LLM</p>

      <label className="mb-1 block text-[10px] uppercase text-zinc-500">Model</label>
      <select
        className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-[var(--accent)]"
        value={data.model}
        disabled={isRunning}
        onChange={(e) => updateNodeData(id, { model: e.target.value })}
        aria-label="Gemini model"
      >
        {GEMINI_MODEL_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="relative mb-2">
        <Handle
          id="system_prompt"
          type="target"
          position={Position.Left}
          style={{ top: '50%', transform: 'translateY(-50%)', left: '-19px' }}
          className={handleCls}
        />
        <label className="mb-1 block text-[10px] uppercase text-zinc-500">System prompt (optional)</label>
        <textarea
          className={cn(
            'nodrag h-12 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-[var(--accent)]',
            sysConn && 'cursor-not-allowed bg-zinc-900/30 text-zinc-500',
          )}
          placeholder="Or connect a Text node"
          value={data.systemPrompt}
          disabled={sysConn || isRunning}
          onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })}
          aria-label="System prompt"
        />
      </div>

      <div className="relative mb-3">
        <Handle
          id="user_message"
          type="target"
          position={Position.Left}
          style={{ top: '50%', transform: 'translateY(-50%)', left: '-19px' }}
          className={handleCls}
        />
        <label className="mb-1 block text-[10px] uppercase text-zinc-500">User message (required)</label>
        <textarea
          className={cn(
            'nodrag h-16 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-[var(--accent)]',
            userConn && 'cursor-not-allowed bg-zinc-900/30 text-zinc-500',
          )}
          placeholder="Or connect a Text node"
          value={data.userMessage}
          disabled={userConn || isRunning}
          onChange={(e) => updateNodeData(id, { userMessage: e.target.value })}
          aria-label="User message"
        />
      </div>

      {/* Run button */}
      <button
        type="button"
        onClick={handleRun}
        disabled={isRunning}
        aria-label="Run LLM node"
        className={cn(
          'nodrag mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
          'bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.97]',
          isRunning && 'cursor-not-allowed opacity-60',
        )}
      >
        {isRunning ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Running…
          </>
        ) : (
          <>
            <Play className="h-3 w-3" aria-hidden />
            Run
          </>
        )}
      </button>

      {/* Result + images handle */}
      <div className="relative mb-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
        <Handle
          id="images"
          type="target"
          position={Position.Left}
          style={{ top: '20px', left: '-27px' }}
          className="!h-2.5 !w-2.5 !border-2 !border-[var(--handle-image)] !bg-zinc-950"
        />
        <p className="mb-1 text-[10px] font-medium text-zinc-500">Result (and Images input)</p>
        {imgConn && <p className="mb-2 text-[10px] text-zinc-400">🖼️ Image connected</p>}
        {isRunning ? (
          <p className="text-xs text-zinc-400">Running…</p>
        ) : data.status === 'error' && data.errorMessage ? (
          <p className="text-xs text-red-400">{data.errorMessage}</p>
        ) : data.resultText ? (
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-zinc-200">
            {data.resultText}
          </p>
        ) : (
          <p className="text-xs text-zinc-500">Output appears here after execution.</p>
        )}
      </div>

      <Handle
        id={SOURCE_HANDLE_ID}
        type="source"
        position={Position.Right}
        style={{ top: '50%' }}
        className="!h-3 !w-3 !border-2 !border-[var(--handle-text)] !bg-zinc-950"
      />
    </div>
  )
}

export const LlmNode = memo(LlmNodeInner)
