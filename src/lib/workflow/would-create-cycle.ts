import type { Connection, Edge } from '@xyflow/react'

/**
 * Detects whether adding a directed edge `source → target` would introduce a cycle.
 * Uses reachability: if `target` can already reach `source`, the new edge closes a loop.
 *
 * Time complexity: **O(V + E)** for DFS over the adjacency list.
 */
export function wouldCreateCycle(edges: readonly Edge[], proposed: Connection): boolean {
  const source = proposed.source
  const target = proposed.target
  if (!source || !target || source === target) {
    return true
  }

  const adj = new Map<string, string[]>()
  for (const e of edges) {
    const list = adj.get(e.source)
    if (list) {
      list.push(e.target)
    } else {
      adj.set(e.source, [e.target])
    }
  }

  return isReachable(adj, target, source)
}

function isReachable(adj: ReadonlyMap<string, string[]>, start: string, goal: string): boolean {
  const stack: string[] = [start]
  const seen = new Set<string>()

  while (stack.length > 0) {
    const n = stack.pop()
    if (n === undefined) break
    if (n === goal) return true
    if (seen.has(n)) continue
    seen.add(n)
    const next = adj.get(n)
    if (next) {
      for (const w of next) {
        stack.push(w)
      }
    }
  }
  return false
}
