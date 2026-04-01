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
  console.log('Validating connection:', connection)
  if (!source || !target || source === target) {
    console.log('Failed: No source/target or self-connection')
    return false
  }

  const sourceNode = nodes.find((n) => n.id === source) as AppNode | undefined
  const targetNode = nodes.find((n) => n.id === target) as AppNode | undefined
  if (!sourceNode || !targetNode) {
    console.log('Failed: sourceNode or targetNode not found', { sourceNode, targetNode })
    return false
  }

  const srcType = sourceNode.type as AppNodeType
  const outType = getSourceDataType(srcType)
  if (!outType) {
    console.log('Failed: no outType for srcType', srcType)
    return false
  }

  if (sourceHandle != null && sourceHandle !== SOURCE_HANDLE_ID) {
    console.log('Failed: incorrect sourceHandle', sourceHandle, 'expected:', SOURCE_HANDLE_ID)
    return false
  }

  if (!targetHandle || !(targetHandle in TARGET_HANDLE_ACCEPTS)) {
    console.log('Failed: targetHandle not accepted or missing', targetHandle)
    return false
  }

  const allowed = TARGET_HANDLE_ACCEPTS[targetHandle as keyof typeof TARGET_HANDLE_ACCEPTS]
  if (!allowed || !(allowed as readonly string[]).includes(outType)) {
    console.log('Failed: outType not allowed for targetHandle', outType, allowed)
    return false
  }

  if (wouldCreateCycle(edges, connection)) {
    console.log('Failed: would create cycle')
    return false
  }

  console.log('Validation passed!')
  return true
}
