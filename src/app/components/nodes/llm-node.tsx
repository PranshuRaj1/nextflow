'use client'

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { useWorkflowStore } from '@/stores/workflow-store'
import { useTargetHandleConnected } from '@/hooks/use-handle-connected'
import type { LlmNodeData } from '@/types/workflow'
import { GEMINI_MODEL_OPTIONS, SOURCE_HANDLE_ID } from '@/types/workflow'
import { cn } from '@/lib/utils/cn'

const handleCls = '!h-2.5 !w-2.5 !border-2 !border-[var(--accent)] !bg-zinc-950'

/**
 * Multimodal LLM node: optional system + required user message + multi image inputs.
 * Results render inline (no separate output node). Pulsating border while `running`.
 */
function LlmNodeInner(props: NodeProps<Node<LlmNodeData, 'llm'>>) {
  const { id, data, selected } = props
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)

  const sysConn = useTargetHandleConnected(id, 'system_prompt')
  const userConn = useTargetHandleConnected(id, 'user_message')

  return (
    <div
      className={cn(
        'relative min-w-[280px] max-w-[320px] rounded-xl border border-[var(--node-border)] bg-[var(--node-bg)] p-3 shadow-lg',
        selected && 'ring-1 ring-[var(--accent)]',
        data.status === 'running' && 'nextflow-node-running',
      )}
    >
      <Handle id="system_prompt" type="target" position={Position.Left} style={{ top: 96 }} className={handleCls} />
      <Handle id="user_message" type="target" position={Position.Left} style={{ top: 156 }} className={handleCls} />
      <Handle id="images" type="target" position={Position.Left} style={{ top: 216 }} className={handleCls} />

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Run any LLM</p>

      <label className="mb-1 block text-[10px] uppercase text-zinc-500">Model</label>
      <select
        className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-[var(--accent)]"
        value={data.model}
        disabled={data.status === 'running'}
        onChange={(e) => updateNodeData(id, { model: e.target.value })}
        aria-label="Gemini model"
      >
        {GEMINI_MODEL_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-[10px] uppercase text-zinc-500">System prompt (optional)</label>
      <textarea
        className={cn(
          'nodrag mb-2 h-12 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-[var(--accent)]',
          sysConn && 'cursor-not-allowed bg-zinc-900/30 text-zinc-500',
        )}
        placeholder="Or connect a Text node"
        value={data.systemPrompt}
        disabled={sysConn || data.status === 'running'}
        onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })}
        aria-label="System prompt"
      />

      <label className="mb-1 block text-[10px] uppercase text-zinc-500">User message (required)</label>
      <textarea
        className={cn(
          'nodrag mb-3 h-16 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-[var(--accent)]',
          userConn && 'cursor-not-allowed bg-zinc-900/30 text-zinc-500',
        )}
        placeholder="Or connect a Text node"
        value={data.userMessage}
        disabled={userConn || data.status === 'running'}
        onChange={(e) => updateNodeData(id, { userMessage: e.target.value })}
        aria-label="User message"
      />

      <div className="mb-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
        <p className="mb-1 text-[10px] font-medium text-zinc-500">Result</p>
        {data.status === 'running' ? (
          <p className="text-xs text-zinc-400">Running…</p>
        ) : data.status === 'error' && data.errorMessage ? (
          <p className="text-xs text-red-400">{data.errorMessage}</p>
        ) : data.resultText ? (
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-zinc-200">{data.resultText}</p>
        ) : (
          <p className="text-xs text-zinc-500">Output appears here after execution.</p>
        )}
      </div>

      <Handle
        id={SOURCE_HANDLE_ID}
        type="source"
        position={Position.Right}
        style={{ top: '50%' }}
        className="!h-3 !w-3 !border-2 !border-[var(--handle-text)] !bg-zinc-950"
      />
    </div>
  )
}

export const LlmNode = memo(LlmNodeInner)
