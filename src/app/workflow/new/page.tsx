'use client'

import { useEffect } from 'react'
import { useWorkflowStore } from '@/stores/workflow-store'
import { WorkflowShell } from '@/app/components/canvas/workflow-shell'

export const dynamic = 'force-dynamic'

/**
 * Blank workflow editor.
 * Resets the Zustand store on mount so previous workflow nodes don't bleed in.
 * The first Save or Run will create a new DB record and update the URL.
 */
export default function NewWorkflowPage() {
  useEffect(() => {
    useWorkflowStore.getState().reset()
  }, [])

  return <WorkflowShell showPresetsOnMount={true} />
}

