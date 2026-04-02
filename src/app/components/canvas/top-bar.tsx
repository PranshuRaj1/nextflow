'use client'

import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { Redo2, Save, Undo2, ZoomOut } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWorkflowStore } from '@/stores/workflow-store'

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
      <Input
        className="h-8 min-w-0 flex-1 border-transparent bg-zinc-900/50 px-2 py-1 text-sm font-medium text-white focus-visible:border-[var(--accent)] focus-visible:ring-0 focus-visible:ring-offset-0"
        value={workflowName}
        onChange={(e) => setWorkflowName(e.target.value)}
        aria-label="Workflow name"
      />
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => undo()}
          disabled={past.length === 0}
          className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          title="Undo"
          aria-label="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => redo()}
          disabled={future.length === 0}
          className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          title="Redo"
          aria-label="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fitView({ padding: 0.2, duration: 200 })}
          className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          title="Fit view"
          aria-label="Fit view"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled
          className="ml-1 h-8 gap-1.5 border-zinc-700 bg-transparent text-xs font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-400"
          title="Wire to POST /api/workflow/[id] in Phase 5"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
        <Button
          variant="default"
          size="sm"
          disabled
          className="ml-1 h-8 bg-[var(--accent)] px-3 text-xs font-semibold text-white hover:bg-[var(--accent)] hover:opacity-90 disabled:opacity-50"
          title="Wire to Trigger.dev in Phase 4"
        >
          Run
        </Button>
      </div>
      <UserButton />
    </header>
  )
}
