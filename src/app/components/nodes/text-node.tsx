'use client'

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { useWorkflowStore } from '@/stores/workflow-store'
import type { TextNodeData } from '@/types/workflow'
import { SOURCE_HANDLE_ID } from '@/types/workflow'
import { cn } from '@/lib/utils/cn'

function TextNodeInner(props: NodeProps<Node<TextNodeData, 'text'>>) {
  const { id, data, selected } = props
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)

  return (
    <div
      className={cn(
        'min-w-[220px] rounded-xl border border-[var(--node-border)] bg-[var(--node-bg)] p-3 shadow-lg',
        selected && 'ring-1 ring-[var(--accent)]',
      )}
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Text</p>
      <textarea
        className="nodrag nowheel h-24 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
        value={data.value}
        onChange={(e) => updateNodeData(id, { value: e.target.value })}
        placeholder="Enter text…"
        aria-label="Text node content"
      />
      <Handle
        id={SOURCE_HANDLE_ID}
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-[var(--handle-text)] !bg-zinc-950"
      />
    </div>
  )
}

export const TextNode = memo(TextNodeInner)
