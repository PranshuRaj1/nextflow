// src/stores/workflow-store.ts

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react'
import { create } from 'zustand'
import type { AppEdge, AppNode, AppNodeType } from '@/types/workflow'
import { defaultNodeData, SOURCE_HANDLE_ID } from '@/types/workflow'
import { isValidWorkflowConnection } from '@/lib/workflow/validate-connection'

const MAX_HISTORY = 80

type Snapshot = { nodes: AppNode[]; edges: AppEdge[] }

function cloneSnapshot(nodes: AppNode[], edges: AppEdge[]): Snapshot {
  return {
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
  }
}

/** Normalize RF `Connection | Edge` to a `Connection` for DAG / handle validation. */
function normalizeConnection(c: Connection | AppEdge): Connection {
  return {
    source: c.source,
    target: c.target,
    sourceHandle: c.sourceHandle ?? null,
    targetHandle: c.targetHandle ?? null,
  }
}

interface WorkflowStoreState {
  workflowName: string
  nodes: AppNode[]
  edges: AppEdge[]
  past: Snapshot[]
  future: Snapshot[]
  setWorkflowName: (name: string) => void
  setNodes: (nodes: AppNode[]) => void
  setEdges: (edges: AppEdge[]) => void
  updateNodeData: (id: string, partial: Record<string, unknown>) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  onNodesChange: OnNodesChange<AppNode>
  onEdgesChange: OnEdgesChange
  onConnect: (connection: Connection) => void
  addNode: (type: AppNodeType, position: { x: number; y: number }) => void
  /** React Flow may pass a `Connection` or an `Edge` while dragging / reconnecting. */
  isValidConnection: (connection: Connection | AppEdge) => boolean
  reset: () => void
}

const initialSnapshot = (): Snapshot => ({ nodes: [], edges: [] })

export const useWorkflowStore = create<WorkflowStoreState>((set, get) => ({
  workflowName: 'Untitled workflow',
  nodes: [],
  edges: [],
  past: [],
  future: [],

  setWorkflowName: (workflowName) => set({ workflowName }),

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  updateNodeData: (id, partial) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...partial } as AppNode['data'] } : n,
      ),
    })),

  pushHistory: () =>
    set((s) => {
      const snap = cloneSnapshot(s.nodes, s.edges)
      return {
        past: [...s.past, snap].slice(-MAX_HISTORY),
        future: [],
      }
    }),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s
      const prev = s.past[s.past.length - 1]
      if (!prev) return s
      const current = cloneSnapshot(s.nodes, s.edges)
      return {
        nodes: prev.nodes,
        edges: prev.edges,
        past: s.past.slice(0, -1),
        future: [current, ...s.future].slice(0, MAX_HISTORY),
      }
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s
      const next = s.future[0]
      if (!next) return s
      const current = cloneSnapshot(s.nodes, s.edges)
      return {
        nodes: next.nodes,
        edges: next.edges,
        past: [...s.past, current].slice(-MAX_HISTORY),
        future: s.future.slice(1),
      }
    }),

  onNodesChange: (changes: NodeChange<AppNode>[]) => {
    const removes = changes.some((c) => c.type === 'remove')
    if (removes) {
      get().pushHistory()
    }
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }))
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    const removes = changes.some((c) => c.type === 'remove')
    if (removes) {
      get().pushHistory()
    }
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }))
  },

  onConnect: (connection) => {
    const { nodes, edges } = get()
    if (!isValidWorkflowConnection(connection, nodes, edges)) {
      return
    }
    get().pushHistory()
    set((s) => ({
      edges: addEdge(
        {
          ...connection,
          sourceHandle: connection.sourceHandle ?? SOURCE_HANDLE_ID,
          type: 'purple',
          animated: true,
        },
        s.edges,
      ),
    }))
  },

  addNode: (type, position) => {
    get().pushHistory()
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const node: AppNode = {
      id,
      type,
      position,
      data: defaultNodeData(type),
    }
    set((s) => ({ nodes: [...s.nodes, node] }))
  },

  isValidConnection: (connection) => {
    const { nodes, edges } = get()
    return isValidWorkflowConnection(normalizeConnection(connection), nodes, edges)
  },

  reset: () => set({ ...initialSnapshot(), past: [], future: [], workflowName: 'Untitled workflow' }),
}))
