'use client'

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, useCallback, useRef } from 'react'
import { Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWorkflowStore } from '@/stores/workflow-store'
import { useExecutionStore } from '@/stores/execution-store'
import { useTargetHandleConnected } from '@/hooks/use-handle-connected'
import type { CropImageNodeData, UploadImageNodeData } from '@/types/workflow'
import { SOURCE_HANDLE_ID } from '@/types/workflow'
import { getNodeErrorHint } from '@/lib/workflow/error-hints'
import { cn } from '@/lib/utils/cn'

const pct = ['image_url', 'x_percent', 'y_percent', 'width_percent', 'height_percent'] as const

function PercentField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase text-zinc-500">{label}</span>
      <Input
        type="text"
        inputMode="decimal"
        className={cn(
          'h-8 border-zinc-700 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-100 focus-visible:border-[var(--accent)] focus-visible:ring-0 focus-visible:ring-offset-0',
          disabled && 'cursor-not-allowed bg-zinc-900/40 text-zinc-500 opacity-100',
        )}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

/**
 * Crop image via FFmpeg on Trigger.dev — UI collects % box; edges override manual fields.
 * Individual Run button dispatches the crop standalone; result preview shows the CDN URL.
 */
function CropImageNodeInner(props: NodeProps<Node<CropImageNodeData, 'cropImage'>>) {
  const { id, data, selected } = props
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  const nodeResults = useExecutionStore((s) => s.nodeResults)
  const setNodeSuccess = useExecutionStore((s) => s.setNodeSuccess)

  const cImage = useTargetHandleConnected(id, 'image_url')
  const cX = useTargetHandleConnected(id, 'x_percent')
  const cY = useTargetHandleConnected(id, 'y_percent')
  const cW = useTargetHandleConnected(id, 'width_percent')
  const cH = useTargetHandleConnected(id, 'height_percent')
  const conn = { image_url: cImage, x_percent: cX, y_percent: cY, width_percent: cW, height_percent: cH }

  const abortRef = useRef<AbortController | null>(null)

  // ── Execution store state ────────────────────────────────────────────────
  const execResult = nodeResults[id]
  const execStatus = execResult?.status ?? 'idle'
  const execOutput = execResult?.output

  // Prefer data.status (standalone run) over execution store status
  const isRunning = data.status === 'running' || execStatus === 'running'
  const isSuccess = data.status === 'success' || execStatus === 'success'
  const isError = data.status === 'error' || execStatus === 'failed'
  const isSkipped = execStatus === 'skipped'

  // Result URL: prefer execution store output (global run), fallback to standalone resultUrl
  const displayUrl =
    (typeof execOutput === 'string' && execOutput.startsWith('http') ? execOutput : undefined) ??
    (typeof (execOutput as any)?.cdnUrl === 'string' ? (execOutput as any).cdnUrl : undefined) ??
    data.resultUrl

  const displayError =
    (typeof execResult?.error === 'string' ? execResult.error : undefined) ??
    data.errorMessage

  // ── Resolve imageUrl from the connected edge ─────────────────────────────
  const resolveImageUrl = useCallback((): string | null => {
    const edge = edges.find((e) => e.target === id && e.targetHandle === 'image_url')
    if (!edge) return null
    const sourceNode = nodes.find((n) => n.id === edge.source)
    if (!sourceNode) return null

    // 1. Check execution store output (e.g. an upstream cropImage / extractFrame result)
    const upstreamOutput = nodeResults[edge.source]?.output
    if (typeof upstreamOutput === 'string' && upstreamOutput.startsWith('http')) {
      return upstreamOutput
    }
    if (upstreamOutput && typeof (upstreamOutput as any).cdnUrl === 'string') {
      return (upstreamOutput as any).cdnUrl
    }

    // 2. Fallback: uploadImage stores URL in data.imageUrl
    const d = sourceNode.data as Partial<UploadImageNodeData>
    return d.imageUrl ?? null
  }, [id, nodes, edges, nodeResults])

  // ── Run handler ──────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    const imageUrl = resolveImageUrl()

    if (!imageUrl) {
      updateNodeData(id, {
        status: 'error',
        errorMessage: 'Connect an Upload Image node to the image_url handle first.',
      })
      return
    }

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    updateNodeData(id, { status: 'running', resultUrl: undefined, errorMessage: undefined })

    try {
      const res = await fetch('/api/nodes/crop-image/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          nodeId: id,
          imageUrl,
          xPercent: data.xPercent,
          yPercent: data.yPercent,
          widthPercent: data.widthPercent,
          heightPercent: data.heightPercent,
        }),
      })

      if (!res.ok) {
        const raw = await res.text()
        let msg = `HTTP ${res.status}`
        try { msg = (JSON.parse(raw) as { error?: string }).error ?? msg } catch { /* noop */ }
        throw new Error(msg)
      }

      const { cdnUrl } = (await res.json()) as { cdnUrl: string }

      // Write to node data (persists across re-renders) AND execution store
      // (so downstream LLM/image nodes see it as a resolved upstream output)
      updateNodeData(id, { status: 'success', resultUrl: cdnUrl, errorMessage: undefined })
      setNodeSuccess(id, cdnUrl)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Crop failed.'
      updateNodeData(id, { status: 'error', errorMessage: msg })
    }
  }, [
    id,
    data.xPercent,
    data.yPercent,
    data.widthPercent,
    data.heightPercent,
    resolveImageUrl,
    updateNodeData,
    setNodeSuccess,
  ])

  return (
    <div
      className={cn(
        'relative min-w-[260px] max-w-[280px] rounded-xl border border-[var(--node-border)] bg-[var(--node-bg)] p-3 shadow-lg transition-all',
        selected && 'ring-1 ring-[var(--accent)]',
        isRunning && 'nextflow-node-running',
        isSuccess && 'border-[var(--handle-image)]/40',
        isError && 'border-red-900/50',
      )}
    >
      {/* Target handles */}
      {pct.map((hid, i) => (
        <Handle
          key={hid}
          id={hid}
          type="target"
          position={Position.Left}
          style={{ top: 32 + i * 36 }}
          className="!h-2.5 !w-2.5 !border-2 !border-[var(--handle-image)] !bg-zinc-950"
        />
      ))}

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Crop image</p>

      {/* Percent fields */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <PercentField
          label="X %"
          value={data.xPercent}
          disabled={conn.x_percent || isRunning}
          onChange={(v) => updateNodeData(id, { xPercent: v })}
        />
        <PercentField
          label="Y %"
          value={data.yPercent}
          disabled={conn.y_percent || isRunning}
          onChange={(v) => updateNodeData(id, { yPercent: v })}
        />
        <PercentField
          label="Width %"
          value={data.widthPercent}
          disabled={conn.width_percent || isRunning}
          onChange={(v) => updateNodeData(id, { widthPercent: v })}
        />
        <PercentField
          label="Height %"
          value={data.heightPercent}
          disabled={conn.height_percent || isRunning}
          onChange={(v) => updateNodeData(id, { heightPercent: v })}
        />
      </div>

      {/* Run button */}
      <Button
        type="button"
        onClick={handleRun}
        disabled={isRunning || !cImage}
        aria-label="Run crop"
        title={!cImage ? 'Connect an image source first' : 'Run crop'}
        className={cn(
          'nodrag mb-3 flex w-full gap-1.5 px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97]',
          'bg-[var(--accent)] text-white hover:bg-[var(--accent)] hover:opacity-90',
          (!cImage) && 'opacity-40',
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
            <p className="text-xs text-zinc-400">Cropping…</p>
          </div>
        ) : isSkipped ? (
          <p className="text-xs italic text-zinc-500">Skipped — upstream node failed</p>
        ) : isError && displayError ? (
          <div className="rounded bg-red-950/30 p-2 text-xs text-red-200 border border-red-900/50">
            {displayError}
            <p className="mt-1 text-[10px] text-red-400/80">
              {getNodeErrorHint('cropImage', displayError)}
            </p>
          </div>
        ) : displayUrl ? (
          <div className="relative w-full overflow-hidden rounded-lg bg-zinc-900" style={{ aspectRatio: '16/9' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayUrl}
              alt="Cropped result"
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

export const CropImageNode = memo(CropImageNodeInner)
