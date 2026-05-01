'use client'

import { ReactFlowProvider } from '@xyflow/react'
import { useEffect, useState, useRef } from 'react'
import { useWorkflowStore } from '@/stores/workflow-store'
import { LeftSidebar } from '@/app/components/canvas/left-sidebar'
import { RightSidebar } from '@/app/components/canvas/right-sidebar'
import { TopBar } from '@/app/components/canvas/top-bar'
import { WorkflowCanvas, type WorkflowCanvasHandle } from '@/app/components/canvas/workflow-canvas'
import { WorkflowErrorBoundary } from '@/app/components/canvas/workflow-error-boundary'
import WorkflowPresetsModal from '@/app/components/canvas/WorkflowPresetsModal'

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

import type { AppNode, AppEdge } from '@/types/workflow'

interface WorkflowShellProps {
  initialData: {
    id: string
    name: string
    nodes: any[]
    edges: any[]
  }
  isNew: boolean
}

/**
 * Full-height workflow builder: Clerk-protected route mounts this client shell.
 */
export function WorkflowShell({ initialData, isNew }: WorkflowShellProps) {
  useWorkflowKeyboardShortcuts()
  const canvasRef = useRef<WorkflowCanvasHandle>(null)

  // Show the presets picker only if explicitly new AND the canvas is actually empty.
  // This prevents the modal from appearing when refreshing an existing workflow that still has ?new=1
  const hasNodes = initialData.nodes && initialData.nodes.length > 0
  const [showPresets, setShowPresets] = useState(isNew && !hasNodes)

  // Hydrate the store once on mount
  useEffect(() => {
    const store = useWorkflowStore.getState()
    store.setWorkflowId(initialData.id)
    store.setWorkflowName(initialData.name)
    store.setNodes(
      (initialData.nodes ?? []).map((n: any) => ({
        id: n.id,
        type: n.type,
        data: n.data,
        position: {
          x: typeof n.position?.x === 'number' ? n.position.x : 0,
          y: typeof n.position?.y === 'number' ? n.position.y : 0,
        },
        ...(n.width != null ? { width: n.width } : {}),
        ...(n.height != null ? { height: n.height } : {}),
      })) as AppNode[],
    )
    store.setEdges((initialData.edges ?? []) as AppEdge[])

    setTimeout(() => canvasRef.current?.fitView(), 100)
  }, [initialData])

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
                <WorkflowCanvas ref={canvasRef} />
                {showPresets && (
                  <WorkflowPresetsModal onDismiss={() => setShowPresets(false)} />
                )}
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
