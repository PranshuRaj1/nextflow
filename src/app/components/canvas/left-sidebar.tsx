'use client'

import {
  Crop,
  Film,
  ImageIcon,
  MessageSquareText,
  ScanSearch,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useCallback, useState } from 'react'
import { useWorkflowStore } from '@/stores/workflow-store'
import type { AppNodeType } from '@/types/workflow'
import { DND_TYPE } from '@/app/components/canvas/workflow-canvas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

const QUICK_ACCESS: {
  type: AppNodeType
  label: string
  icon: typeof MessageSquareText
  description: string
}[] = [
  { type: 'text',         label: 'Text Node',                     icon: MessageSquareText, description: 'Simple text input' },
  { type: 'uploadImage',  label: 'Upload Image Node',             icon: ImageIcon,         description: 'Transloadit upload' },
  { type: 'uploadVideo',  label: 'Upload Video Node',             icon: Film,              description: 'Transloadit upload' },
  { type: 'llm',          label: 'Run Any LLM Node',             icon: Sparkles,          description: 'Trigger.dev task' },
  { type: 'cropImage',    label: 'Crop Image Node',              icon: Crop,              description: 'FFmpeg on Trigger.dev' },
  { type: 'extractFrame', label: 'Extract Frame from Video Node', icon: ScanSearch,        description: 'FFmpeg on Trigger.dev' },
]

const LS_KEY = 'nextflow:sidebar:left'

function readStorage(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(LS_KEY) === 'true'
}

/**
 * Quick Access palette — collapsible.
 * Collapsed: 48 px icon-only strip with native `title` tooltips.
 * Expanded: full label + description list.
 * Collapse state persists across refreshes via localStorage.
 */
export function LeftSidebar() {
  const { screenToFlowPosition } = useReactFlow()

  const [isCollapsed, setIsCollapsed] = useState<boolean>(readStorage)

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(LS_KEY, String(next))
      return next
    })
  }, [])

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
    <aside
      className={cn(
        'relative flex shrink-0 flex-col border-r border-subtle bg-panel',
        'transition-[width] duration-[250ms] ease-in-out overflow-hidden',
        isCollapsed ? 'w-12' : 'w-[200px] md:w-[260px]',
      )}
    >
      {/* ── Header ── */}
      <div
        className={cn(
          'flex shrink-0 items-center border-b border-subtle',
          isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-3',
        )}
      >
        {/* Label + search — hidden when collapsed */}
        {!isCollapsed && (
          <div className="flex min-w-0 flex-1 flex-col gap-2 pr-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quick access
            </p>
            <Input
              type="search"
              placeholder="Search nodes…"
              disabled
              className="h-8 w-full border-subtle bg-surface px-2 text-xs text-muted-foreground focus-visible:border-active focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Search nodes (coming soon)"
            />
          </div>
        )}

        {/* Toggle button */}
        <button
          type="button"
          onClick={toggle}
          title={isCollapsed ? 'Expand palette' : 'Collapse palette'}
          aria-label={isCollapsed ? 'Expand node palette' : 'Collapse node palette'}
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
            'text-muted-foreground transition-colors hover:bg-surface hover:text-foreground-secondary',
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* ── Node list ── */}
      <nav
        className={cn(
          'flex flex-col overflow-y-auto',
          isCollapsed ? 'items-center gap-1 p-1.5' : 'gap-1 p-2',
        )}
        aria-label="Add nodes"
      >
        {QUICK_ACCESS.map(({ type, label, icon: Icon, description }) =>
          isCollapsed ? (
            /* Collapsed: icon-only button with native tooltip */
            <button
              key={type}
              type="button"
              title={label}
              aria-label={label}
              draggable
              onDragStart={(e) => onDragStart(e, type)}
              onClick={() => addAtViewCenter(type)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg border border-transparent',
                'text-muted-foreground transition-colors',
                'hover:border-subtle hover:bg-surface hover:text-foreground-secondary active:scale-95',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          ) : (
            /* Expanded: full label + description */
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
              <Icon
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground-secondary"
                aria-hidden
              />
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-xs font-medium text-foreground-secondary transition-colors group-hover:text-foreground">
                  {label}
                </span>
                <span className="whitespace-normal text-[10px] font-normal leading-tight text-muted-foreground transition-colors">
                  {description}
                </span>
              </div>
            </Button>
          ),
        )}
      </nav>
    </aside>
  )
}
