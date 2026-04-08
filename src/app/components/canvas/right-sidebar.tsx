'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  History,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useRerunWorkflow } from '@/hooks/use-rerun-workflow'
import { useExecutionStore } from '@/stores/execution-store'
import { cn } from '@/lib/utils/cn'
import type { AppNode, AppEdge } from '@/types/workflow'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RunHistoryItem {
  id: string
  workflowId: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELLED'
  scope: 'FULL' | 'PARTIAL' | 'SINGLE'
  durationMs: number | null
  startedAt: string
  name: string | null
  workflow: {
    name: string
    /** Full snapshot — included so buttons don't need a second fetch. */
    nodes: AppNode[]
    edges: AppEdge[]
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LS_KEY = 'nextflow:sidebar:right'

function readStorage(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(LS_KEY) === 'true'
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RunHistoryItem['status'] }) {
  const configs: Record<
    RunHistoryItem['status'],
    { icon: any; color: string; bg: string; animate?: string }
  > = {
    PENDING:   { icon: Clock,        color: 'text-zinc-400',    bg: 'bg-zinc-500/10' },
    RUNNING:   { icon: Loader2,      color: 'text-blue-400',    bg: 'bg-blue-500/10',    animate: 'animate-spin' },
    COMPLETED: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    FAILED:    { icon: XCircle,      color: 'text-rose-400',    bg: 'bg-rose-500/10' },
    PARTIAL:   { icon: AlertCircle,  color: 'text-amber-400',   bg: 'bg-amber-500/10' },
    CANCELLED: { icon: XCircle,      color: 'text-zinc-500',    bg: 'bg-zinc-500/5' },
  }

  const config = configs[status] ?? configs.PENDING
  const { icon: Icon, color, bg, animate } = config

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${bg} ${color}`}
    >
      <Icon className={`h-3 w-3 ${animate ?? ''}`} />
      {status.toLowerCase()}
    </div>
  )
}

// ── Run card ──────────────────────────────────────────────────────────────────

interface RunCardProps {
  run: RunHistoryItem
  isRerunnning: boolean
  rerunningId: string | null
  isGlobalRunning: boolean
  onRun: (run: RunHistoryItem) => void
  onLoadAndRun: (run: RunHistoryItem) => void
}

function RunCard({
  run,
  isRerunnning,
  rerunningId,
  isGlobalRunning,
  onRun,
  onLoadAndRun,
}: RunCardProps) {
  const isThisCardActive = rerunningId === run.id
  const isAnyBusy        = isGlobalRunning || isRerunnning
  const displayName      = run.name ?? run.workflow.name

  return (
    <div className="group flex flex-col gap-2 rounded-xl border border-white/[0.03] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[11px] font-semibold text-zinc-200">{displayName}</span>
          <span className="text-[9px] text-zinc-500">
            {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
          </span>
        </div>
        <StatusBadge status={run.status} />
      </div>

      {/* Footer row — duration + action buttons */}
      <div className="flex items-center justify-between border-t border-white/[0.03] pt-2">
        {/* Duration */}
        <div className="flex items-center gap-1 text-[9px] text-zinc-500">
          <Clock className="h-2.5 w-2.5" />
          {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '--'}
        </div>

        {/* Action buttons — visible on hover or while this card is active */}
        <div
          className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 data-[active=true]:opacity-100"
          data-active={isThisCardActive}
        >
          {/* Button 1 — Run (silent re-run, canvas unchanged) */}
          <button
            id={`run-btn-${run.id}`}
            title="Re-run this workflow (canvas unchanged)"
            aria-label={`Re-run ${displayName}`}
            disabled={isAnyBusy || !run.workflow.nodes?.length}
            onClick={() => onRun(run)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-zinc-400
              hover:bg-white/5 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40
              transition-colors"
          >
            {isThisCardActive ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Run
          </button>

          {/* Divider */}
          <span className="h-3 w-px bg-white/10" aria-hidden />

          {/* Button 2 — Load & Run (replace canvas then run) */}
          <button
            id={`load-run-btn-${run.id}`}
            title="Load into canvas and re-run"
            aria-label={`Load and run ${displayName}`}
            disabled={isAnyBusy || !run.workflow.nodes?.length}
            onClick={() => onLoadAndRun(run)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-zinc-400
              hover:bg-white/5 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40
              transition-colors"
          >
            <FolderOpen className="h-3 w-3" />
            Load &amp; Run
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

/**
 * Run history sidebar — collapsible.
 * Collapsed: 48 px strip showing the History icon + toggle button only.
 * Expanded: full run-card list with Run / Load & Run buttons.
 * Collapse state is persisted via localStorage.
 */
export function RightSidebar() {
  const [runs, setRuns]           = useState<RunHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)

  useEffect(() => {
    setIsCollapsed(readStorage())
  }, [])

  const { rerunWorkflow, loadAndRunWorkflow, isRerunnning, rerunningId } = useRerunWorkflow()

  const isGlobalRunning = useExecutionStore((s) => s.isRunning)

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(LS_KEY, String(next))
      return next
    })
  }, [])

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/workflow/history')
      if (res.ok) {
        const data = await res.json()
        setRuns(data.runs)
      }
    } catch (err) {
      console.error('[RightSidebar] Failed to fetch history:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
    const timer = setInterval(fetchHistory, 5000)
    return () => clearInterval(timer)
  }, [fetchHistory])

  // Refresh once a re-run finishes so the new record appears quickly
  useEffect(() => {
    if (!isRerunnning) void fetchHistory()
  }, [isRerunnning, fetchHistory])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRun = useCallback(
    (run: RunHistoryItem) => {
      rerunWorkflow(
        run.workflowId,
        run.workflow.name,
        run.workflow.nodes ?? [],
        run.workflow.edges ?? [],
        run.id,
      )
    },
    [rerunWorkflow],
  )

  const handleLoadAndRun = useCallback(
    (run: RunHistoryItem) => {
      loadAndRunWorkflow(
        run.workflowId,
        run.workflow.name,
        run.workflow.nodes ?? [],
        run.workflow.edges ?? [],
        run.id,
      )
    },
    [loadAndRunWorkflow],
  )

  // ── Render ────────────────────────────────────────────────────────────────

  const isBusy = (isLoading && runs.length > 0) || isGlobalRunning || isRerunnning

  return (
    <aside
      className={cn(
        'relative flex shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--node-bg)]',
        'transition-[width] duration-[250ms] ease-in-out overflow-hidden',
        isCollapsed ? 'w-12' : 'w-[260px] md:w-[300px]',
      )}
    >
      {/* ── Header ── */}
      <div
        className={cn(
          'flex shrink-0 items-center border-b border-[var(--border-subtle)]',
          isCollapsed ? 'flex-col gap-2 px-0 py-3' : 'justify-between px-4 py-3',
        )}
      >
        {/* Toggle button — left of title when expanded, top when collapsed */}
        <button
          type="button"
          onClick={toggle}
          title={isCollapsed ? 'Expand run history' : 'Collapse run history'}
          aria-label={isCollapsed ? 'Expand run history' : 'Collapse run history'}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md
            text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
        >
          {isCollapsed ? (
            <ChevronLeft className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {/* History icon — always visible */}
        <div
          className={cn(
            'flex items-center gap-2',
            isCollapsed && 'flex-col',
          )}
          title={isCollapsed ? 'Run history' : undefined}
        >
          <History
            className="h-4 w-4 text-[var(--accent)]"
            aria-hidden
          />
          {!isCollapsed && (
            <h2 className="text-sm font-semibold text-zinc-200">Run history</h2>
          )}
        </div>

        {/* Spinner — only visible when expanded */}
        {!isCollapsed && isBusy && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
        )}
      </div>

      {/* ── Run list — hidden when collapsed ── */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar">
          {isLoading && runs.length === 0 ? (
            <div className="flex h-full items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
            </div>
          ) : runs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <div className="rounded-full bg-zinc-500/5 p-3">
                <History className="h-6 w-6 text-zinc-700" />
              </div>
              <p className="text-xs font-medium text-zinc-400">No runs yet.</p>
              <p className="text-[10px] leading-relaxed text-zinc-600 max-w-[180px]">
                Executions will appear here with status, duration, and replay options.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {runs.map((run) => (
                <RunCard
                  key={run.id}
                  run={run}
                  isRerunnning={isRerunnning}
                  rerunningId={rerunningId}
                  isGlobalRunning={isGlobalRunning}
                  onRun={handleRun}
                  onLoadAndRun={handleLoadAndRun}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
