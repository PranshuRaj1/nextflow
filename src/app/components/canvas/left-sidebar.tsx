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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

const QUICK_ACCESS: { type: AppNodeType; label: string; icon: typeof MessageSquareText; description: string }[] = [
  { type: 'text', label: 'Text Node', icon: MessageSquareText, description: 'Simple text input' },
  { type: 'uploadImage', label: 'Upload Image Node', icon: ImageIcon, description: 'Transloadit upload' },
  { type: 'uploadVideo', label: 'Upload Video Node', icon: Film, description: 'Transloadit upload' },
  { type: 'llm', label: 'Run Any LLM Node', icon: Sparkles, description: 'Trigger.dev task' },
  { type: 'cropImage', label: 'Crop Image Node', icon: Crop, description: 'FFmpeg on Trigger.dev' },
  { type: 'extractFrame', label: 'Extract Frame from Video Node', icon: ScanSearch, description: 'FFmpeg on Trigger.dev' },
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
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-subtle bg-panel md:w-[260px]">
      <div className="border-b border-subtle p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick access</p>
        <Input
          type="search"
          placeholder="Search nodes…"
          disabled
          className="mt-2 h-8 w-full border-subtle bg-surface px-2 text-xs text-muted-foreground focus-visible:border-active focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label="Search nodes (coming soon)"
        />
      </div>
      <nav className="flex flex-col gap-1 overflow-y-auto p-2" aria-label="Add nodes">
        {QUICK_ACCESS.map(({ type, label, icon: Icon, description }) => (
          <Button
            key={type}
            variant="ghost"
            type="button"
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            onClick={() => addAtViewCenter(type)}
            className={cn(
              'group h-auto w-full justify-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition',
              'hover:border-subtle hover:bg-surface active:scale-[0.98]',
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground-secondary" aria-hidden />
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-xs font-medium text-foreground-secondary transition-colors group-hover:text-foreground">{label}</span>
              <span className="whitespace-normal text-[10px] font-normal leading-tight text-muted-foreground transition-colors">{description}</span>
            </div>
          </Button>
        ))}
      </nav>
    </aside>
  )
}
