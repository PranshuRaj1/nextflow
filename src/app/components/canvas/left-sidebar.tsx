'use client'

import {
  Crop,
  Film,
  ImageIcon,
  MessageSquareText,
  ScanSearch,
  Sparkles,
} from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useCallback } from 'react'
import { useWorkflowStore } from '@/stores/workflow-store'
import type { AppNodeType } from '@/types/workflow'
import { DND_TYPE } from '@/app/components/canvas/workflow-canvas'
import { cn } from '@/lib/utils/cn'

const QUICK_ACCESS: { type: AppNodeType; label: string; icon: typeof MessageSquareText }[] = [
  { type: 'text', label: 'Text', icon: MessageSquareText },
  { type: 'uploadImage', label: 'Upload image', icon: ImageIcon },
  { type: 'uploadVideo', label: 'Upload video', icon: Film },
  { type: 'llm', label: 'Run any LLM', icon: Sparkles },
  { type: 'cropImage', label: 'Crop image', icon: Crop },
  { type: 'extractFrame', label: 'Extract frame', icon: ScanSearch },
]

/**
 * Quick Access palette — drag onto canvas or click to add near viewport center.
 */
export function LeftSidebar() {
  const { screenToFlowPosition } = useReactFlow()

  const addAtViewCenter = useCallback(
    (type: AppNodeType) => {
      const pane = document.querySelector('.react-flow__pane')
      const rect = pane?.getBoundingClientRect()
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
      const pos = screenToFlowPosition({ x, y })
      useWorkflowStore.getState().addNode(type, pos)
    },
    [screenToFlowPosition],
  )

  const onDragStart = (e: React.DragEvent, type: AppNodeType) => {
    e.dataTransfer.setData(DND_TYPE, type)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--node-bg)] md:w-[220px]">
      <div className="border-b border-[var(--border-subtle)] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Quick access</p>
        <input
          type="search"
          placeholder="Search nodes…"
          disabled
          className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-xs text-zinc-500"
          aria-label="Search nodes (coming soon)"
        />
      </div>
      <nav className="flex flex-col gap-1 overflow-y-auto p-2" aria-label="Add nodes">
        {QUICK_ACCESS.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            type="button"
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            onClick={() => addAtViewCenter(type)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left text-xs font-medium text-zinc-300 transition',
              'hover:border-zinc-700 hover:bg-zinc-800/80 hover:text-white',
              'active:scale-[0.98]',
            )}
          >
            <Icon className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
