import { useMemo } from 'react'
import { useWorkflowStore } from '@/stores/workflow-store'

/**
 * Returns whether an incoming edge is attached to the given target handle.
 *
 * Reads from the Zustand workflow store (not React Flow's `useEdges`) so
 * that edges set programmatically — e.g. when a preset is loaded — are
 * reflected immediately without requiring a manual disconnect/reconnect.
 */
export function useTargetHandleConnected(nodeId: string, handleId: string): boolean {
  const edges = useWorkflowStore((s) => s.edges)
  return useMemo(
    () => edges.some((e) => e.target === nodeId && e.targetHandle === handleId),
    [edges, nodeId, handleId],
  )
}
