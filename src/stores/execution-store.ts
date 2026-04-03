// src/stores/execution-store.ts

import { create } from 'zustand'

/**
 * Execution status for a single node during a global workflow run.
 * Mirrors the NodeStatus enum in the DB schema so the UI and
 * persistence layer stay in sync.
 */
export type NodeExecutionStatus = 'idle' | 'pending' | 'running' | 'success' | 'failed' | 'skipped'

/**
 * Per-node result stored in the execution store while a run is active.
 * `output` is the raw value produced by the node (text string, CDN URL, etc.)
 * `error` is populated only when status === 'failed'.
 */
export interface NodeExecutionResult {
  status: NodeExecutionStatus
  output?: unknown
  error?: string
}

/**
 * Global execution state shape.
 * The store is reset to this at the start of every new run.
 */
interface ExecutionStoreState {
  /** True while a full workflow run is in progress. */
  isRunning: boolean

  /**
   * ID of the WorkflowRun record created in the database for this run.
   * Null when no run is active.
   */
  currentRunId: string | null

  /**
   * Live map of every node's execution result, keyed by nodeId.
   * Updated in real-time as each node moves through pending → running → success/failed.
   * Drives the visual glow / status badge on each node card.
   */
  nodeResults: Record<string, NodeExecutionResult>

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Called at the start of a run. Resets all per-node state and marks the
   * store as running. Pass the DB-generated runId so it can be referenced
   * by the polling layer (Phase 5).
   */
  startRun: (runId: string, nodeIds: string[]) => void

  /**
   * Move a single node to `running` status.
   * Called immediately before its Trigger.dev task is dispatched.
   */
  setNodeRunning: (nodeId: string) => void

  /**
   * Record a successful output for a node and mark it `success`.
   * `output` is forwarded to downstream nodes as their resolved input.
   */
  setNodeSuccess: (nodeId: string, output: unknown) => void

  /**
   * Record a failure for a node and mark it `failed`.
   * The run continues to the next wave if other nodes are still pending,
   * but converging nodes that depend on this node will be marked `skipped`.
   */
  setNodeFailed: (nodeId: string, error: string) => void

  /**
   * Mark a node as `skipped` — used when an upstream dependency failed
   * and the node cannot receive the input it requires.
   */
  setNodeSkipped: (nodeId: string) => void

  /**
   * Called when the run finishes (all waves done, or a fatal error occurred).
   * Flips `isRunning` off and clears `currentRunId`.
   * Per-node results are intentionally kept so the canvas can display the
   * last run's outputs after completion.
   */
  finishRun: () => void

  /**
   * Fully resets the store to its initial state.
   * Called before starting a brand-new run or when the user navigates away.
   */
  reset: () => void
}

const initialState = {
  isRunning: false,
  currentRunId: null,
  nodeResults: {},
}

export const useExecutionStore = create<ExecutionStoreState>((set) => ({
  ...initialState,

  startRun: (runId, nodeIds) =>
    set({
      isRunning: true,
      currentRunId: runId,
      nodeResults: Object.fromEntries(
        nodeIds.map((id) => [id, { status: 'pending' as NodeExecutionStatus }]),
      ),
    }),

  setNodeRunning: (nodeId) =>
    set((s) => ({
      nodeResults: {
        ...s.nodeResults,
        [nodeId]: { status: 'running' },
      },
    })),

  setNodeSuccess: (nodeId, output) =>
    set((s) => ({
      nodeResults: {
        ...s.nodeResults,
        [nodeId]: { status: 'success', output },
      },
    })),

  setNodeFailed: (nodeId, error) =>
    set((s) => ({
      nodeResults: {
        ...s.nodeResults,
        [nodeId]: { status: 'failed', error },
      },
    })),

  setNodeSkipped: (nodeId) =>
    set((s) => ({
      nodeResults: {
        ...s.nodeResults,
        [nodeId]: { status: 'skipped' },
      },
    })),

  finishRun: () =>
    set({ isRunning: false, currentRunId: null }),

  reset: () => set(initialState),
}))