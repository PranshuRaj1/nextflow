'use client'

import { History } from 'lucide-react'

/**
 * Workflow run history — list + expandable tree wired in Phase 5 (`GET /api/history`).
 */
export function RightSidebar() {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--node-bg)] md:w-[300px]">
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-3">
        <History className="h-4 w-4 text-[var(--accent)]" aria-hidden />
        <h2 className="text-sm font-semibold text-zinc-200">Run history</h2>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-xs text-zinc-500">No runs yet.</p>
        <p className="text-[10px] leading-relaxed text-zinc-600">
          Executions will appear here with status, duration, and per-node details after Trigger.dev integration.
        </p>
      </div>
    </aside>
  )
}
