'use client'

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { useWorkflowStore } from '@/stores/workflow-store'
import { useExecutionStore } from '@/stores/execution-store'
import { useTargetHandleConnected } from '@/hooks/use-handle-connected'
import type { ExtractFrameNodeData } from '@/types/workflow'
import { SOURCE_HANDLE_ID } from '@/types/workflow'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

/**
 * Extract one frame from video (FFmpeg on Trigger.dev). Timestamp: seconds or e.g. `50%`.
 */
function ExtractFrameNodeInner(props: NodeProps<Node<ExtractFrameNodeData, 'extractFrame'>>) {
  const { id, data, selected } = props
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  const nodeResults = useExecutionStore((s) => s.nodeResults)
  const cVideo = useTargetHandleConnected(id, 'video_url')
  const cTs = useTargetHandleConnected(id, 'timestamp')

  const status = nodeResults[id]?.status
  const isRunning = status === 'running'
  const isSuccess = status === 'success'
  const isError = status === 'failed'

  return (
    <div
      className={cn(
        'relative min-w-[240px] max-w-[260px] rounded-xl border border-[var(--node-border)] bg-[var(--node-bg)] p-3 shadow-lg',
        selected && 'ring-1 ring-[var(--accent)]',
        isRunning && 'nextflow-node-running',
        isSuccess && 'border-[var(--handle-success)]/50',
        isError && 'border-red-900/50',
      )}
    >
      <Handle
        id="video_url"
        type="target"
        position={Position.Left}
        style={{ top: 48 }}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--handle-video)] !bg-zinc-950"
      />
      <Handle
        id="timestamp"
        type="target"
        position={Position.Left}
        style={{ top: 108 }}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--handle-number)] !bg-zinc-950"
      />

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Extract frame</p>
      <p className="mb-2 text-[10px] text-zinc-500">Connect video URL or use manual timestamp when not wired.</p>

      <label className="block">
        <span className="mb-0.5 block text-[10px] uppercase text-zinc-500">Timestamp</span>
        <Input
          type="text"
          className={cn(
            'h-8 border-zinc-700 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-100 focus-visible:border-[var(--accent)] focus-visible:ring-0 focus-visible:ring-offset-0',
            cTs && 'cursor-not-allowed bg-zinc-900/40 text-zinc-500 opacity-100',
          )}
          placeholder='e.g. 10 or "50%"'
          value={data.timestamp}
          disabled={cTs}
          onChange={(e) => updateNodeData(id, { timestamp: e.target.value })}
          aria-label="Frame timestamp"
        />
      </label>
      {cVideo ? (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-zinc-500">Video URL from connection.</p>
          {isSuccess && (
            <span className="text-[10px] font-medium text-[var(--handle-success)]">✓ Frame ready</span>
          )}
          {isError && (
            <span className="text-[10px] font-medium text-red-500">✕ Failed</span>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[10px] text-amber-600/90">Connect Upload video or a URL source.</p>
      )}

      <Handle
        id={SOURCE_HANDLE_ID}
        type="source"
        position={Position.Right}
        style={{ top: '50%' }}
        className="!h-3 !w-3 !border-2 !border-[var(--handle-image)] !bg-zinc-950"
      />
    </div>
  )
}

export const ExtractFrameNode = memo(ExtractFrameNodeInner)
