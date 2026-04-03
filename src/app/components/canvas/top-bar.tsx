// src/app/components/canvas/top-bar.tsx

'use client'

import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { Loader2, Redo2, Save, Undo2, ZoomOut } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWorkflowStore } from '@/stores/workflow-store'
import { useWorkflowExecution } from '@/hooks/use-workflow-execution'

/**
 * Workflow chrome: name, save (stub), undo/redo, fit view, run, Clerk user.
 *
 * Phase 4 changes:
 * - Run button wired to `useWorkflowExecution`.
 * - Run button shows a spinner and "Running…" label while execution is active.
 * - Run button disabled when `isRunning` or no nodes on canvas.
 */
export function TopBar() {
  const workflowName = useWorkflowStore((s) => s.workflowName)
  const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName)
  const undo = useWorkflowStore((s) => s.undo)
  const redo = useWorkflowStore((s) => s.redo)
  const past = useWorkflowStore((s) => s.past)
  const future = useWorkflowStore((s) => s.future)
  const nodes = useWorkflowStore((s) => s.nodes)
  const { fitView } = useReactFlow()

  const { runWorkflow, isRunning } = useWorkflowExecution()

  const hasNodes = nodes.length > 0

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
        disabled={isRunning}
      />

      <div className="flex shrink-0 items-center gap-1">
        {/* Undo */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => undo()}
          disabled={past.length === 0 || isRunning}
          className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          title="Undo"
          aria-label="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </Button>

        {/* Redo */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => redo()}
          disabled={future.length === 0 || isRunning}
          className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          title="Redo"
          aria-label="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        {/* Fit view */}
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

        {/* Save — stub until Phase 5 */}
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

        {/* Run — Phase 4: wired to useWorkflowExecution */}
        <Button
          variant="default"
          size="sm"
          onClick={runWorkflow}
          disabled={isRunning || !hasNodes}
          className="ml-1 h-8 min-w-[72px] gap-1.5 bg-[var(--accent)] px-3 text-xs font-semibold text-white hover:bg-[var(--accent)] hover:opacity-90 disabled:opacity-50"
          title={
            !hasNodes
              ? 'Add nodes to the canvas first'
              : isRunning
                ? 'Workflow is running…'
                : 'Run the entire workflow'
          }
          aria-label={isRunning ? 'Running workflow' : 'Run workflow'}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Running…
            </>
          ) : (
            'Run'
          )}
        </Button>
      </div>

      <UserButton />
    </header>
  )
}