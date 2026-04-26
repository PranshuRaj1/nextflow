'use client'

import { useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useWorkflowStore } from '@/stores/workflow-store'
import { WorkflowShell } from '@/app/components/canvas/workflow-shell'
import type { AppNode, AppEdge } from '@/types/workflow'

export const dynamic = 'force-dynamic'

/**
 * Loads a saved workflow from the DB into the Zustand store,
 * then mounts the canvas editor.
 *
 * Runs the fetch exactly once on mount (using a ref guard) to avoid
 * wiping out in-progress canvas changes on re-renders.
 */
export default function WorkflowEditorPage() {
  const params = useParams<{ workflowId: string }>()
  const workflowId = params.workflowId
  const searchParams = useSearchParams()
  // ?new=1 is appended by the dashboard when creating a brand-new workflow so
  // the presets modal still appears, but NOT when opening an existing workflow.
  const isNew = searchParams.get('new') === '1'
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    async function load() {
      try {
        const res = await fetch(`/api/workflow/${workflowId}`)
        if (!res.ok) return // 404 / 403 — store stays empty (fresh canvas)

        const data = (await res.json()) as {
          id: string
          name: string
          nodes: AppNode[]
          edges: AppEdge[]
        }

        const store = useWorkflowStore.getState()
        store.setWorkflowId(data.id)
        store.setWorkflowName(data.name)
        // Sanitise RF internal fields that get persisted as JSON (e.g. `measured`)
        store.setNodes(
          (data.nodes ?? []).map((n) => ({
            id: n.id,
            type: n.type,
            data: n.data,
            position: {
              x: typeof n.position?.x === 'number' ? n.position.x : 0,
              y: typeof n.position?.y === 'number' ? n.position.y : 0,
            },
            ...(n.width  != null ? { width:  n.width  } : {}),
            ...(n.height != null ? { height: n.height } : {}),
          })) as AppNode[],
        )
        store.setEdges((data.edges ?? []) as AppEdge[])
      } catch {
        // Leave canvas blank on network error
      }
    }

    void load()
  }, [workflowId])

  return <WorkflowShell showPresetsOnMount={isNew} />
}
