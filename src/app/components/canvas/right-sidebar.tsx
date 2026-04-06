'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, Play, CheckCircle2, XCircle, Clock, Loader2, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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
  }
}

function StatusBadge({ status }: { status: RunHistoryItem['status'] }) {
  const configs: Record<RunHistoryItem['status'], { icon: any; color: string; bg: string; animate?: string }> = {
    PENDING: { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
    RUNNING: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10', animate: 'animate-spin' },
    COMPLETED: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    FAILED: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    PARTIAL: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    CANCELLED: { icon: XCircle, color: 'text-zinc-500', bg: 'bg-zinc-500/5' },
  }

  const config = configs[status] || configs.PENDING
  const { icon: Icon, color, bg, animate } = config

  return (
    <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${bg} ${color}`}>
      <Icon className={`h-3 w-3 ${animate ?? ''}`} />
      {status.toLowerCase()}
    </div>
  )
}

/**
 * Workflow run history — list + expandable tree wired in Phase 5 (`GET /api/history`).
 */
export function RightSidebar() {
  const [runs, setRuns] = useState<RunHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
    // Poll for updates every 5 seconds while the tab is active
    const timer = setInterval(fetchHistory, 5000)
    return () => clearInterval(timer)
  }, [fetchHistory])

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--node-bg)] md:w-[300px]">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--accent)]" aria-hidden />
          <h2 className="text-sm font-semibold text-zinc-200">Run history</h2>
        </div>
        {isLoading && runs.length > 0 && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
        )}
      </div>

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
              Executions will appear here with status, duration, and per-node details.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {runs.map((run) => (
              <div 
                key={run.id}
                className="group flex flex-col gap-2 rounded-xl border border-white/[0.03] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[11px] font-semibold text-zinc-200">
                      {run.name || run.workflow.name}
                    </span>
                    <span className="text-[9px] text-zinc-500">
                      {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                    </span>
                  </div>
                  <StatusBadge status={run.status} />
                </div>

                <div className="flex items-center justify-between border-t border-white/[0.03] pt-2">
                  <div className="flex items-center gap-3">
                     <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                       <Clock className="h-2.5 w-2.5" />
                       {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '--'}
                     </div>
                  </div>
                  <button className="rounded-md p-1 opacity-0 transition-opacity hover:bg-white/5 group-hover:opacity-100">
                    <Play className="h-3 w-3 text-zinc-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
