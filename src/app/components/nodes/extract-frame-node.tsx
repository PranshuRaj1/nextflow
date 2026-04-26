'use client'

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, useCallback, useRef } from 'react'
import { Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWorkflowStore } from '@/stores/workflow-store'
import { useExecutionStore } from '@/stores/execution-store'
import { useTargetHandleConnected } from '@/hooks/use-handle-connected'
import type { ExtractFrameNodeData, UploadVideoNodeData } from '@/types/workflow'
import { SOURCE_HANDLE_ID } from '@/types/workflow'
import { getNodeErrorHint } from '@/lib/workflow/error-hints'
import { cn } from '@/lib/utils/cn'

/**
 * Extract one frame from video (FFmpeg on Trigger.dev). Timestamp: seconds or e.g. `50%`.
 * Individual Run button dispatches the task standalone; result preview shows the CDN URL.
 */
function ExtractFrameNodeInner(props: NodeProps<Node<ExtractFrameNodeData, 'extractFrame'>>) {
  const { id, data, selected } = props
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  const nodeResults = useExecutionStore((s) => s.nodeResults)
  const setNodeSuccess = useExecutionStore((s) => s.setNodeSuccess)

  const cVideo = useTargetHandleConnected(id, 'video_url')
  const cTs = useTargetHandleConnected(id, 'timestamp')

  const abortRef = useRef<AbortController | null>(null)

  // ── Execution store state ────────────────────────────────────────────────
  const execResult = nodeResults[id]
  const execStatus = execResult?.status ?? 'idle'
  const execOutput = execResult?.output

  // Prefer node-data status (standalone run) over execution store status
  const isRunning = data.status === 'running' || execStatus === 'running'
  const isSuccess = data.status === 'success' || execStatus === 'success'
  const isError = data.status === 'error' || execStatus === 'failed'
  const isSkipped = execStatus === 'skipped'

  // Result URL: prefer execution store output (global run), then standalone resultUrl
  const displayUrl =
    (typeof execOutput === 'string' && execOutput.startsWith('http') ? execOutput : undefined) ??
    (typeof (execOutput as any)?.cdnUrl === 'string' ? (execOutput as any).cdnUrl : undefined) ??
    data.resultUrl

  const displayError =
    (typeof execResult?.error === 'string' ? execResult.error : undefined) ??
    data.errorMessage

  // ── Resolve videoUrl from the connected edge ─────────────────────────────
  const resolveVideoUrl = useCallback((): string | null => {
    const edge = edges.find((e) => e.target === id && e.targetHandle === 'video_url')
    if (!edge) return null
    const sourceNode = nodes.find((n) => n.id === edge.source)
    if (!sourceNode) return null

    // 1. Check execution store output (upstream processing node result)
    const upstreamOutput = nodeResults[edge.source]?.output
    if (typeof upstreamOutput === 'string' && upstreamOutput.startsWith('http')) {
      return upstreamOutput
    }
    if (upstreamOutput && typeof (upstreamOutput as any).cdnUrl === 'string') {
      return (upstreamOutput as any).cdnUrl
    }

    // 2. Fallback: uploadVideo stores URL in data.videoUrl
    const d = sourceNode.data as Partial<UploadVideoNodeData>
    return d.videoUrl ?? null
  }, [id, nodes, edges, nodeResults])

  // ── Run handler ──────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    const videoUrl = resolveVideoUrl()

    if (!videoUrl) {
      updateNodeData(id, {
        status: 'error',
        errorMessage: 'Connect an Upload Video node to the video_url handle first.',
      })
      return
    }

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    updateNodeData(id, { status: 'running', resultUrl: undefined, errorMessage: undefined })

    try {
      const res = await fetch('/api/nodes/extract-frame/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          nodeId: id,
          videoUrl,
          timestamp: data.timestamp,
        }),
      })

      if (!res.ok) {
        const raw = await res.text()
        let msg = `HTTP ${res.status}`
        try { msg = (JSON.parse(raw) as { error?: string }).error ?? msg } catch { /* noop */ }
        throw new Error(msg)
      }

      const { cdnUrl } = (await res.json()) as { cdnUrl: string }

      // Write to node data AND execution store (so downstream nodes see it)
      updateNodeData(id, { status: 'success', resultUrl: cdnUrl, errorMessage: undefined })
      setNodeSuccess(id, cdnUrl)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Frame extraction failed.'
      updateNodeData(id, { status: 'error', errorMessage: msg })
    }
  }, [id, data.timestamp, resolveVideoUrl, updateNodeData, setNodeSuccess])

  return (
    <div
      className={cn(
        'relative min-w-[240px] max-w-[260px] rounded-xl border border-[var(--node-border)] bg-[var(--node-bg)] p-3 shadow-lg transition-all',
        selected && 'ring-1 ring-[var(--accent)]',
        isRunning && 'nextflow-node-running',
        isSuccess && 'border-[var(--handle-image)]/40',
        isError && 'border-red-900/50',
      )}
    >
      {/* Video URL input handle */}
      <Handle
        id="video_url"
        type="target"
        position={Position.Left}
        style={{ top: 48 }}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--handle-video)] !bg-zinc-950"
      />
      {/* Timestamp override handle */}
      <Handle
        id="timestamp"
        type="target"
        position={Position.Left}
        style={{ top: 108 }}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--handle-number)] !bg-zinc-950"
      />

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Extract frame</p>
      <p className="mb-2 text-[10px] text-zinc-500">Connect video URL or use manual timestamp when not wired.</p>

      {/* Timestamp field */}
      <label className="mb-3 block">
        <span className="mb-0.5 block text-[10px] uppercase text-zinc-500">Timestamp</span>
        <Input
          type="text"
          className={cn(
            'h-8 border-zinc-700 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-100 focus-visible:border-[var(--accent)] focus-visible:ring-0 focus-visible:ring-offset-0',
            cTs && 'cursor-not-allowed bg-zinc-900/40 text-zinc-500 opacity-100',
          )}
          placeholder='e.g. 10 or "50%"'
          value={data.timestamp}
          disabled={cTs || isRunning}
          onChange={(e) => updateNodeData(id, { timestamp: e.target.value })}
          aria-label="Frame timestamp"
        />
      </label>

      {/* Video connection status */}
      {cVideo ? (
        <p className="mb-3 text-[10px] text-zinc-500">🎬 Video connected</p>
      ) : (
        <p className="mb-3 text-[10px] text-amber-600/90">Connect an Upload Video node.</p>
      )}

      {/* Run button */}
      <Button
        type="button"
        onClick={handleRun}
        disabled={isRunning || !cVideo}
        aria-label="Run frame extraction"
        title={!cVideo ? 'Connect a video source first' : 'Extract frame'}
        className={cn(
          'nodrag mb-3 flex w-full gap-1.5 px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97]',
          'bg-[var(--accent)] text-white hover:bg-[var(--accent)] hover:opacity-90',
          !cVideo && 'opacity-40',
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
      </Button>

      {/* Result preview panel */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
        <p className="mb-1.5 text-[10px] font-medium text-zinc-500">Result</p>

        {isRunning ? (
          <div className="flex items-center gap-1.5 py-1">
            <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
            <p className="text-xs text-zinc-400">Extracting frame…</p>
          </div>
        ) : isSkipped ? (
          <p className="text-xs italic text-zinc-500">Skipped — upstream node failed</p>
        ) : isError && displayError ? (
          <div className="rounded bg-red-950/30 p-2 text-xs text-red-200 border border-red-900/50">
            {displayError}
            <p className="mt-1 text-[10px] text-red-400/80">
              {getNodeErrorHint('extractFrame', displayError)}
            </p>
          </div>
        ) : displayUrl ? (
          <div className="relative w-full overflow-hidden rounded-lg bg-zinc-900" style={{ aspectRatio: '16/9' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayUrl}
              alt="Extracted frame"
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Preview appears here after running.</p>
        )}
      </div>

      <Handle
        id={SOURCE_HANDLE_ID}
        type="source"
        position={Position.Right}
        style={{ top: '50%' }}
        className="!h-3 !w-3 !border-2 !border-[var(--handle-image)] !bg-zinc-950"
      />
    </div>
  )
}

export const ExtractFrameNode = memo(ExtractFrameNodeInner)
