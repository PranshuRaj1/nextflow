// src/app/components/canvas/top-bar.tsx

'use client'

import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { Check, Loader2, Redo2, Save, Undo2, ZoomOut, Download, Upload } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useCallback, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWorkflowStore } from '@/stores/workflow-store'
import { useWorkflowExecution } from '@/hooks/use-workflow-execution'
import { workflowNodeTypes } from '@/app/components/nodes/node-registry'

type SaveState = 'idle' | 'saving' | 'saved'

/**
 * Workflow chrome: name, save, undo/redo, fit view, run, Clerk user.
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

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const hasNodes = nodes.length > 0
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(() => {
    const { nodes: currentNodes, edges: currentEdges, workflowName: currentName } = useWorkflowStore.getState()
    const data = { nodes: currentNodes, edges: currentEdges }
    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `${currentName || 'workflow'}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Workflow exported')
  }, [])

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string
          const parsed = JSON.parse(content)

          if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
            throw new Error('Invalid workflow JSON format')
          }

          const validTypes = Object.keys(workflowNodeTypes)
          for (const node of parsed.nodes) {
            if (!node.type || !validTypes.includes(node.type)) {
              throw new Error(`Invalid node type in file: ${node.type}`)
            }
          }

          useWorkflowStore.getState().setNodes(parsed.nodes)
          useWorkflowStore.getState().setEdges(parsed.edges)

          setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 60)
          toast.success('Workflow imported')
        } catch (error) {
          toast.error('Failed to import workflow')
        }
        // reset input so the same file can be selected again if needed
        e.target.value = ''
      }
      reader.readAsText(file)
    },
    [fitView],
  )

  const handleSave = useCallback(async () => {
    const { workflowId, workflowName: name, nodes: n, edges: e } =
      useWorkflowStore.getState()

    setSaveState('saving')

    try {
      if (workflowId) {
        // ── Update existing workflow ──────────────────────────────────────
        const res = await fetch(`/api/workflow/${workflowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, nodes: n, edges: e }),
        })
        if (!res.ok) throw new Error('Save failed')
      } else {
        // ── Create new workflow, then store the returned ID ───────────────
        const res = await fetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        if (!res.ok) throw new Error('Create failed')
        const { id } = (await res.json()) as { id: string }

        // Store the new ID immediately so future saves go to the right record
        useWorkflowStore.getState().setWorkflowId(id)

        // PATCH the new record with current name + canvas state
        await fetch(`/api/workflow/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, nodes: n, edges: e }),
        })

        // Update the browser URL without a full navigation
        window.history.replaceState(null, '', `/workflow/${id}`)
      }

      setSaveState('saved')
      toast.success('Workflow saved')
      // Reset to idle after 2 s
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('idle')
      toast.error('Failed to save workflow')
    }
  }, [])

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--node-bg)] px-3 md:px-4">
      <Link
        href="/workflow"
        className="hidden shrink-0 text-xs font-medium text-zinc-400 transition hover:text-white sm:inline"
      >
        ← Workflows
      </Link>

      <Input
        className="h-8 min-w-0 flex-1 border-transparent bg-zinc-900/50 px-2 py-1 text-sm font-medium text-white focus-visible:border-[var(--accent)] focus-visible:ring-0 focus-visible:ring-offset-0"
        value={workflowName}
        onChange={(e) => setWorkflowName(e.target.value)}
        onFocus={(e) => e.target.select()}
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

        {/* Export JSON */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleExport}
          disabled={!hasNodes || isRunning}
          className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          title="Export JSON"
          aria-label="Export JSON"
        >
          <Download className="h-4 w-4" />
        </Button>

        {/* Import JSON */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRunning}
          className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          title="Import JSON"
          aria-label="Import JSON"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <input
          type="file"
          accept="application/json"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleImport}
        />

        {/* Save */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saveState === 'saving' || isRunning}
          className="ml-1 h-8 gap-1.5 border-zinc-700 bg-transparent text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-50"
          title="Save workflow"
          aria-label="Save workflow"
          id="save-workflow-btn"
        >
          {saveState === 'saving' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saveState === 'saved' ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved!' : 'Save'}
        </Button>

        {/* Run */}
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