'use client'

import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import { memo } from 'react'

/**
 * Krea-style animated purple edge between nodes.
 */
function PurpleEdgeInner(props: EdgeProps) {
  const { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, selected } = props
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <BaseEdge
      path={path}
      style={{
        stroke: selected ? '#c084fc' : 'var(--accent)',
        strokeWidth: selected ? 2.5 : 2,
      }}
      className="nextflow-edge-animated"
    />
  )
}

export const PurpleEdge = memo(PurpleEdgeInner)
