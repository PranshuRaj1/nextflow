import type { Connection, Edge, Node } from '@xyflow/react'
import { TARGET_HANDLE_ACCEPTS } from '@/types/handles'
import type { AppNode, AppNodeType } from '@/types/workflow'
import { getSourceDataType, SOURCE_HANDLE_ID } from '@/types/workflow'
import { wouldCreateCycle } from '@/lib/workflow/would-create-cycle'

/**
 * Validates a proposed React Flow connection:
 * 1. Self-connections rejected.
 * 2. Target handle must exist in the type matrix.
 * 3. Source output type must be allowed for that target handle.
 * 4. Graph must remain a DAG (no cycles).
 */
export function isValidWorkflowConnection(
  connection: Connection,
  nodes: readonly Node[],
  edges: readonly Edge[],
): boolean {
  const { source, target, sourceHandle, targetHandle } = connection
  if (!source || !target || source === target) {
    return false
  }

  const sourceNode = nodes.find((n) => n.id === source) as AppNode | undefined
  const targetNode = nodes.find((n) => n.id === target) as AppNode | undefined
  if (!sourceNode || !targetNode) {
    return false
  }

  const srcType = sourceNode.type as AppNodeType
  const outType = getSourceDataType(srcType)
  if (!outType) {
    return false
  }

  if (sourceHandle != null && sourceHandle !== SOURCE_HANDLE_ID) {
    return false
  }

  if (!targetHandle || !(targetHandle in TARGET_HANDLE_ACCEPTS)) {
    return false
  }

  const allowed = TARGET_HANDLE_ACCEPTS[targetHandle as keyof typeof TARGET_HANDLE_ACCEPTS]
  if (!allowed || !(allowed as readonly string[]).includes(outType)) {
    return false
  }

  if (wouldCreateCycle(edges, connection)) {
    return false
  }

  return true
}
