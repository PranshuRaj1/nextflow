'use client'

import { ReactFlowProvider } from '@xyflow/react'
import { useEffect } from 'react'
import { useWorkflowStore } from '@/stores/workflow-store'
import { LeftSidebar } from '@/app/components/canvas/left-sidebar'
import { RightSidebar } from '@/app/components/canvas/right-sidebar'
import { TopBar } from '@/app/components/canvas/top-bar'
import { WorkflowCanvas } from '@/app/components/canvas/workflow-canvas'
import { WorkflowErrorBoundary } from '@/app/components/canvas/workflow-error-boundary'

function useWorkflowKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
        return
      }
      if ((t as HTMLElement).isContentEditable) return

      if (e.key === 'Delete' || e.key === 'Backspace') return

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          useWorkflowStore.getState().redo()
        } else {
          useWorkflowStore.getState().undo()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        useWorkflowStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/**
 * Full-height workflow builder: Clerk-protected route mounts this client shell.
 */
export function WorkflowShell() {
  useWorkflowKeyboardShortcuts()

  return (
    <ReactFlowProvider>
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--canvas-bg)] text-[var(--foreground)]">
        <WorkflowErrorBoundary label="top bar">
          <TopBar />
        </WorkflowErrorBoundary>
        <div className="flex min-h-0 flex-1">
          <WorkflowErrorBoundary label="node palette">
            <LeftSidebar />
          </WorkflowErrorBoundary>
          <WorkflowErrorBoundary label="canvas">
            <div className="relative min-h-0 min-w-0 flex-1">
              <WorkflowCanvas />
            </div>
          </WorkflowErrorBoundary>
          <WorkflowErrorBoundary label="history">
            <RightSidebar />
          </WorkflowErrorBoundary>
        </div>
      </div>
    </ReactFlowProvider>
  )
}
