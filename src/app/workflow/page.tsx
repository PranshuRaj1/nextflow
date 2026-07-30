'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  Plus,
  Loader2,
  Workflow,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface WorkflowItem {
  id: string
  name: string
  updatedAt: string
  nodeCount: number
}

// ── New-workflow button ────────────────────────────────────────────────────────

function NewWorkflowButton() {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = useCallback(async () => {
    setIsCreating(true)
    try {
      const res = await fetch('/api/workflows', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create workflow')
      const { id } = (await res.json()) as { id: string }
      router.push(`/workflow/${id}?new=1`)
    } catch {
      setIsCreating(false)
    }
  }, [router])

  return (
    <button
      id="new-workflow-btn"
      type="button"
      onClick={handleCreate}
      disabled={isCreating}
      className={cn(
        'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all',
        'bg-[var(--accent)] hover:opacity-90 active:scale-[0.97]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'shadow-[0_0_20px_rgba(99,102,241,0.25)]',
      )}
    >
      {isCreating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      New Workflow
    </button>
  )
}

// ── Workflow card ──────────────────────────────────────────────────────────────

function WorkflowCard({ workflow }: { workflow: WorkflowItem }) {
  return (
    <Link
      href={`/workflow/${workflow.id}`}
      className={cn(
        'group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.06]',
        'bg-white/[0.03] p-5 transition-all duration-200',
        'hover:border-white/[0.12] hover:bg-white/[0.06] hover:shadow-[0_4px_32px_rgba(0,0,0,0.4)]',
        'active:scale-[0.99]',
      )}
    >
      {/* Icon + arrow */}
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/10">
          <Workflow className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <ArrowRight className="h-4 w-4 text-zinc-600 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-400" />
      </div>

      {/* Name */}
      <div>
        <h3 className="truncate text-[15px] font-semibold leading-snug text-zinc-100 transition-colors group-hover:text-white">
          {workflow.name}
        </h3>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 border-t border-white/[0.04] pt-3">
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Layers className="h-3 w-3" />
          {workflow.nodeCount} node{workflow.nodeCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(workflow.updatedAt), { addSuffix: true })}
        </span>
      </div>
    </Link>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.08]">
        <Workflow className="h-8 w-8 text-zinc-600" />
      </div>
      <div>
        <p className="text-base font-semibold text-zinc-300">No workflows yet</p>
        <p className="mt-1 text-sm text-zinc-500">
          Create your first workflow to get started.
        </p>
      </div>
      <NewWorkflowButton />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

export default function WorkflowDashboard() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/workflows')
      .then((r) => r.json())
      .then((d: { workflows: WorkflowItem[] }) => {
        setWorkflows(d.workflows ?? [])
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[var(--canvas-bg)] text-[var(--foreground)]">
      {/* ── Header ── */}
      <header className="border-b border-white/[0.05] bg-[var(--node-bg)] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-sm font-semibold text-zinc-200">Workflows</h1>
          <NewWorkflowButton />
        </div>
      </header>

      {/* ── Content ── */}
      <main className="mx-auto max-w-6xl px-6 py-10">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
          </div>
        ) : workflows.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-200">
                My Workflows
                <span className="ml-2 text-sm font-normal text-zinc-500">({workflows.length})</span>
              </h2>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {/* Create new card */}
              <NewWorkflowCardButton />

              {/* Existing workflow cards */}
              {workflows.map((wf) => (
                <WorkflowCard key={wf.id} workflow={wf} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// A "card-style" new-workflow button for the grid layout
function NewWorkflowCardButton() {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = useCallback(async () => {
    setIsCreating(true)
    try {
      const res = await fetch('/api/workflows', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create workflow')
      const { id } = (await res.json()) as { id: string }
      router.push(`/workflow/${id}?new=1`)
    } catch {
      setIsCreating(false)
    }
  }, [router])

  return (
    <button
      id="new-workflow-card-btn"
      type="button"
      onClick={handleCreate}
      disabled={isCreating}
      className={cn(
        'group flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10',
        'bg-transparent p-5 text-zinc-500 transition-all duration-200 min-h-[160px]',
        'hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 hover:text-zinc-300',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {isCreating ? (
        <Loader2 className="h-7 w-7 animate-spin" />
      ) : (
        <Plus className="h-7 w-7 transition-transform group-hover:scale-110" />
      )}
      <span className="text-sm font-medium">New Workflow</span>
    </button>
  )
}
