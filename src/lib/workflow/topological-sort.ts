// src/lib/workflow/topological-sort.ts

import type { Edge } from '@xyflow/react'

/**
 * Kahn topological ordering over a DAG of node ids.
 *
 * Returns a flat `string[]` of node IDs in dependency order.
 * Used internally by `buildExecutionWaves`.
 *
 * Time complexity **O(V + E)**; space **O(V + E)**.
 *
 * @throws Error if a cycle remains (should not happen when `isValidConnection`
 *   + cycle-check are enforced on every `onConnect`).
 */
export function topologicalSortNodes(
  nodeIds: readonly string[],
  edges: readonly Pick<Edge, 'source' | 'target'>[],
): string[] {
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

/**
 * Groups nodes into **parallel execution waves** using a level-aware variant
 * of Kahn's algorithm.
 *
 * Nodes in the same wave share no mutual dependency and can be dispatched
 * concurrently via `Promise.all`. A node only enters wave N+1 after every
 * node in wave N has resolved — this is what makes convergence nodes (e.g.
 * LLM Node #2 waiting for both Branch A and Branch B) work correctly without
 * any extra coordination logic.
 *
 * ### Example
 * ```
 * Text ──┐
 *        ├──► LLM ──► Output
 * Image ─┘
 * Video ──► Extract ──┘   (parallel branch)
 * ```
 * Returns:
 * ```
 * [
 *   ['text-1', 'image-1', 'video-1'],  // Wave 0 — no dependencies
 *   ['llm-1', 'extract-1'],            // Wave 1 — depend on Wave 0
 *   ['output-1'],                       // Wave 2 — waits for both branches
 * ]
 * ```
 *
 * Time complexity **O(V + E)**; space **O(V + E)**.
 *
 * @param nodeIds - All node IDs present in the workflow.
 * @param edges   - All edges (only `source` and `target` are used).
 * @returns Array of waves. Each wave is an array of node IDs that can run in parallel.
 * @throws Error if a cycle is detected.
 */
export function buildExecutionWaves(
  nodeIds: readonly string[],
  edges: readonly Pick<Edge, 'source' | 'target'>[],
): string[][] {
  const indegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const id of nodeIds) {
    indegree.set(id, 0)
    adj.set(id, [])
  }

  for (const e of edges) {
    if (!indegree.has(e.source) || !indegree.has(e.target)) continue
    adj.get(e.source)!.push(e.target)
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1)
  }

  // Seed the first wave with all zero-indegree nodes
  let currentWave: string[] = []
  for (const [id, d] of indegree) {
    if (d === 0) currentWave.push(id)
  }

  const waves: string[][] = []
  let processed = 0

  while (currentWave.length > 0) {
    waves.push(currentWave)
    processed += currentWave.length

    const nextWave: string[] = []
    for (const id of currentWave) {
      for (const neighbour of adj.get(id) ?? []) {
        const newDegree = (indegree.get(neighbour) ?? 0) - 1
        indegree.set(neighbour, newDegree)
        if (newDegree === 0) nextWave.push(neighbour)
      }
    }
    currentWave = nextWave
  }

  if (processed !== nodeIds.length) {
    throw new Error('buildExecutionWaves: cycle detected in workflow graph')
  }

  return waves
}