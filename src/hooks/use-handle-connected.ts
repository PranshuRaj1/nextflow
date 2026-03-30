import { useEdges } from '@xyflow/react'
import { useMemo } from 'react'

/**
 * Returns whether an incoming edge is attached to the given target handle.
 * Used to disable manual inputs when the port is driven by upstream data.
 */
export function useTargetHandleConnected(nodeId: string, handleId: string): boolean {
  const edges = useEdges()
  return useMemo(
    () => edges.some((e) => e.target === nodeId && e.targetHandle === handleId),
    [edges, nodeId, handleId],
  )
}
