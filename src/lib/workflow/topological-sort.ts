import type { Edge } from '@xyflow/react'

/**
 * Kahn topological ordering over a DAG of node ids.
 *
 * Used by the execution engine (Phase 4) to build wave groups for Trigger.dev.
 * Time complexity **O(V + E)**; space **O(V + E)** for adjacency + indegree maps.
 *
 * @throws Error if a cycle remains (should not happen when `isValidConnection` + cycle check are enforced).
 */
export function topologicalSortNodes(nodeIds: readonly string[], edges: readonly Pick<Edge, 'source' | 'target'>[]): string[] {
  const indegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const id of nodeIds) {
    indegree.set(id, 0)
    adj.set(id, [])
  }

  for (const e of edges) {
    if (!indegree.has(e.source) || !indegree.has(e.target)) continue
    const list = adj.get(e.source)
    if (list) list.push(e.target)
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, d] of indegree) {
    if (d === 0) queue.push(id)
  }

  const order: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()
    if (id === undefined) break
    order.push(id)
    const outs = adj.get(id) ?? []
    for (const t of outs) {
      const next = (indegree.get(t) ?? 0) - 1
      indegree.set(t, next)
      if (next === 0) queue.push(t)
    }
  }

  if (order.length !== nodeIds.length) {
    throw new Error('topologicalSortNodes: cycle detected in workflow graph')
  }

  return order
}
