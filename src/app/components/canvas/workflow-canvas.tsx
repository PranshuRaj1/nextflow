'use client'

import { useCallback } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useWorkflowStore } from '@/stores/workflow-store'
import { workflowNodeTypes } from '@/app/components/nodes/node-registry'
import { workflowEdgeTypes } from '@/app/components/canvas/purple-edge-types'
import type { AppNodeType } from '@/types/workflow'

const DND_TYPE = 'application/nextflow-node'

/**
 * React Flow canvas: dot grid, minimap (bottom-right), animated purple edges, DAG-safe connects.
 */
export function WorkflowCanvas() {
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange)
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange)
  const onConnect = useWorkflowStore((s) => s.onConnect)
  const isValidConnection = useWorkflowStore((s) => s.isValidConnection)
  const pushHistory = useWorkflowStore((s) => s.pushHistory)
  const { screenToFlowPosition } = useReactFlow()

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData(DND_TYPE)
      if (!raw) return
      const type = raw as AppNodeType
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      useWorkflowStore.getState().addNode(type, pos)
    },
    [screenToFlowPosition],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onNodeDragStart={() => pushHistory()}
      nodeTypes={workflowNodeTypes}
      edgeTypes={workflowEdgeTypes}
      defaultEdgeOptions={{ type: 'purple', animated: true }}
      fitView
      minZoom={0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      deleteKeyCode={['Backspace', 'Delete']}
      className="!bg-[var(--canvas-bg)]"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <Background
        id="nextflow-dots"
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="rgba(255,255,255,0.07)"
      />
      <MiniMap
        position="bottom-right"
        className="!m-3 !rounded-lg !border !border-[var(--border-subtle)] !bg-zinc-900/90"
        maskColor="rgba(0,0,0,0.45)"
        nodeColor={() => '#3f3f46'}
      />
      <Controls
        position="bottom-left"
        className="!m-3 !rounded-lg !border !border-[var(--border-subtle)] !bg-zinc-900/90 !shadow-lg"
        showInteractive={false}
      />
    </ReactFlow>
  )
}

export { DND_TYPE }
