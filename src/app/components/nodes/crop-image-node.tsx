'use client'

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { useWorkflowStore } from '@/stores/workflow-store'
import { useTargetHandleConnected } from '@/hooks/use-handle-connected'
import type { CropImageNodeData } from '@/types/workflow'
import { SOURCE_HANDLE_ID } from '@/types/workflow'
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
      <input
        type="text"
        inputMode="decimal"
        className={cn(
          'w-full rounded border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-[var(--accent)]',
          disabled && 'cursor-not-allowed bg-zinc-900/40 text-zinc-500',
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
 */
function CropImageNodeInner(props: NodeProps<Node<CropImageNodeData, 'cropImage'>>) {
  const { id, data, selected } = props
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)

  const cImage = useTargetHandleConnected(id, 'image_url')
  const cX = useTargetHandleConnected(id, 'x_percent')
  const cY = useTargetHandleConnected(id, 'y_percent')
  const cW = useTargetHandleConnected(id, 'width_percent')
  const cH = useTargetHandleConnected(id, 'height_percent')
  const conn = { image_url: cImage, x_percent: cX, y_percent: cY, width_percent: cW, height_percent: cH }

  return (
    <div
      className={cn(
        'relative min-w-[260px] max-w-[280px] rounded-xl border border-[var(--node-border)] bg-[var(--node-bg)] p-3 shadow-lg',
        selected && 'ring-1 ring-[var(--accent)]',
      )}
    >
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
      <p className="mb-2 text-[10px] text-zinc-500">Defaults: 0,0 — 100×100%. FFmpeg task in production.</p>

      <div className="grid grid-cols-2 gap-2">
        <PercentField
          label="X %"
          value={data.xPercent}
          disabled={conn.x_percent}
          onChange={(v) => updateNodeData(id, { xPercent: v })}
        />
        <PercentField
          label="Y %"
          value={data.yPercent}
          disabled={conn.y_percent}
          onChange={(v) => updateNodeData(id, { yPercent: v })}
        />
        <PercentField
          label="Width %"
          value={data.widthPercent}
          disabled={conn.width_percent}
          onChange={(v) => updateNodeData(id, { widthPercent: v })}
        />
        <PercentField
          label="Height %"
          value={data.heightPercent}
          disabled={conn.height_percent}
          onChange={(v) => updateNodeData(id, { heightPercent: v })}
        />
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
