'use client'

import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { Redo2, Save, Undo2, ZoomOut } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useWorkflowStore } from '@/stores/workflow-store'
import { cn } from '@/lib/utils/cn'

/**
 * Workflow chrome: name, save (stub), undo/redo, fit view, Clerk user.
 */
export function TopBar() {
  const workflowName = useWorkflowStore((s) => s.workflowName)
  const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName)
  const undo = useWorkflowStore((s) => s.undo)
  const redo = useWorkflowStore((s) => s.redo)
  const past = useWorkflowStore((s) => s.past)
  const future = useWorkflowStore((s) => s.future)
  const { fitView } = useReactFlow()

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--node-bg)] px-3 md:px-4">
      <Link
        href="/"
        className="hidden shrink-0 text-xs font-medium text-zinc-400 transition hover:text-white sm:inline"
      >
        ← Home
      </Link>
      <input
        className="min-w-0 flex-1 rounded-lg border border-transparent bg-zinc-900/50 px-2 py-1 text-sm font-medium text-white outline-none focus:border-[var(--accent)]"
        value={workflowName}
        onChange={(e) => setWorkflowName(e.target.value)}
        aria-label="Workflow name"
      />
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => undo()}
          disabled={past.length === 0}
          className={cn(
            'rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white',
            past.length === 0 && 'pointer-events-none opacity-30',
          )}
          title="Undo"
          aria-label="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => redo()}
          disabled={future.length === 0}
          className={cn(
            'rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white',
            future.length === 0 && 'pointer-events-none opacity-30',
          )}
          title="Redo"
          aria-label="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => fitView({ padding: 0.2, duration: 200 })}
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          title="Fit view"
          aria-label="Fit view"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled
          className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-500"
          title="Wire to POST /api/workflow/[id] in Phase 5"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </button>
        <button
          type="button"
          disabled
          className="ml-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white opacity-50"
          title="Wire to Trigger.dev in Phase 4"
        >
          Run
        </button>
      </div>
      <UserButton />
    </header>
  )
}
