'use client'

import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { X, Plus } from 'lucide-react'
import { useWorkflowStore } from '@/stores/workflow-store'
import type { AppNode, AppEdge } from '@/types/workflow'
import './workflow-presets.css'

// ── Preset definitions ──────────────────────────────────────────────────────

type Preset = {
  id: string
  title: string
  description: string
  nodes: AppNode[]
  edges: AppEdge[]
}

const PRESETS: Preset[] = [
  {
    id: 'product-marketing-kit',
    title: 'Product Marketing Kit',
    description: 'Parallel branches converging into a final marketing summary',
    nodes: [
      { id: 'upload-image-1', type: 'uploadImage', position: { x: 80, y: 100 }, data: { imageUrl: null, status: 'idle' } },
      { id: 'text-1', type: 'text', position: { x: 80, y: 250 }, data: { value: 'You are a professional marketing copywriter. Generate a compelling one-paragraph product description.' } },
      { id: 'text-2', type: 'text', position: { x: 80, y: 450 }, data: { value: 'Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.' } },
      { id: 'crop-image-1', type: 'cropImage', position: { x: 400, y: 100 }, data: { xPercent: '10', yPercent: '10', widthPercent: '80', heightPercent: '80', status: 'idle' } },
      { id: 'llm-1', type: 'llm', position: { x: 720, y: 250 }, data: { model: 'gemini-2.5-flash', systemPrompt: '', userMessage: '', resultText: '', status: 'idle' } },
      { id: 'upload-video-1', type: 'uploadVideo', position: { x: 80, y: 650 }, data: { videoUrl: null, status: 'idle' } },
      { id: 'extract-frame-1', type: 'extractFrame', position: { x: 400, y: 650 }, data: { timestamp: '50', status: 'idle' } },
      { id: 'text-3', type: 'text', position: { x: 720, y: 650 }, data: { value: 'You are a social media manager. Create a tweet-length marketing post based on the product image and video frame.' } },
      { id: 'llm-2', type: 'llm', position: { x: 1050, y: 450 }, data: { model: 'gemini-2.5-flash', systemPrompt: '', userMessage: '', resultText: '', status: 'idle' } },
    ],
    edges: [
      { id: 'e1', source: 'upload-image-1', target: 'crop-image-1', sourceHandle: 'out', targetHandle: 'image_url', type: 'purple', animated: true },
      { id: 'e2', source: 'crop-image-1', target: 'llm-1', sourceHandle: 'out', targetHandle: 'images', type: 'purple', animated: true },
      { id: 'e3', source: 'text-1', target: 'llm-1', sourceHandle: 'out', targetHandle: 'system_prompt', type: 'purple', animated: true },
      { id: 'e4', source: 'text-2', target: 'llm-1', sourceHandle: 'out', targetHandle: 'user_message', type: 'purple', animated: true },
      { id: 'e5', source: 'upload-video-1', target: 'extract-frame-1', sourceHandle: 'out', targetHandle: 'video_url', type: 'purple', animated: true },
      { id: 'e6', source: 'llm-1', target: 'llm-2', sourceHandle: 'out', targetHandle: 'user_message', type: 'purple', animated: true },
      { id: 'e7', source: 'crop-image-1', target: 'llm-2', sourceHandle: 'out', targetHandle: 'images', type: 'purple', animated: true },
      { id: 'e8', source: 'extract-frame-1', target: 'llm-2', sourceHandle: 'out', targetHandle: 'images', type: 'purple', animated: true },
      { id: 'e9', source: 'text-3', target: 'llm-2', sourceHandle: 'out', targetHandle: 'system_prompt', type: 'purple', animated: true },
    ]
  },
  {
    id: 'llm-chat',
    title: 'LLM Chat',
    description: 'Simple prompt-response with Gemini',
    nodes: [
      {
        id: '1',
        type: 'text',
        position: { x: 80, y: 200 },
        data: { value: '' },
      },
      {
        id: '2',
        type: 'llm',
        position: { x: 360, y: 200 },
        data: {
          model: 'gemini-2.5-flash',
          systemPrompt: '',
          userMessage: '',
          resultText: '',
          status: 'idle',
        },
      },
    ],
    edges: [
      { id: 'e1-2', source: '1', sourceHandle: 'out', target: '2', targetHandle: 'user_message', type: 'purple', animated: true },
    ],
  },
  {
    id: 'crop-image',
    title: 'Crop Image',
    description: 'Upload and crop to custom dimensions',
    nodes: [
      {
        id: '1',
        type: 'uploadImage',
        position: { x: 80, y: 200 },
        data: { imageUrl: null, status: 'idle' },
      },
      {
        id: '2',
        type: 'cropImage',
        position: { x: 380, y: 200 },
        data: { xPercent: '0', yPercent: '0', widthPercent: '100', heightPercent: '100', status: 'idle' },
      },
    ],
    edges: [
      { id: 'e1-2', source: '1', sourceHandle: 'out', target: '2', targetHandle: 'image_url', type: 'purple', animated: true },
    ],
  },
  {
    id: 'extract-frames',
    title: 'Extract Frames',
    description: 'Pull a frame from video at a set timestamp',
    nodes: [
      {
        id: '1',
        type: 'uploadVideo',
        position: { x: 80, y: 200 },
        data: { videoUrl: null, status: 'idle' },
      },
      {
        id: '2',
        type: 'extractFrame',
        position: { x: 380, y: 200 },
        data: { timestamp: '0', status: 'idle' },
      },
    ],
    edges: [
      { id: 'e1-2', source: '1', sourceHandle: 'out', target: '2', targetHandle: 'video_url', type: 'purple', animated: true },
    ],
  },
  {
    id: 'parallel-llm',
    title: 'Parallel LLM',
    description: 'Run two LLMs on the same input simultaneously',
    nodes: [
      {
        id: '1',
        type: 'text',
        position: { x: 80, y: 220 },
        data: { value: '' },
      },
      {
        id: '2',
        type: 'llm',
        position: { x: 360, y: 60 },
        data: {
          model: 'gemini-2.5-flash',
          systemPrompt: 'Summarize the following:',
          userMessage: '',
          resultText: '',
          status: 'idle',
        },
      },
      {
        id: '3',
        type: 'llm',
        position: { x: 360, y: 360 },
        data: {
          model: 'gemini-2.5-flash',
          systemPrompt: 'Critique the following:',
          userMessage: '',
          resultText: '',
          status: 'idle',
        },
      },
    ],
    edges: [
      { id: 'e1-2', source: '1', sourceHandle: 'out', target: '2', targetHandle: 'user_message', type: 'purple', animated: true },
      { id: 'e1-3', source: '1', sourceHandle: 'out', target: '3', targetHandle: 'user_message', type: 'purple', animated: true },
    ],
  },
  {
    id: 'image-caption',
    title: 'Image Caption',
    description: 'Generate captions from images with LLM',
    nodes: [
      {
        id: '1',
        type: 'uploadImage',
        position: { x: 80, y: 200 },
        data: { imageUrl: null, status: 'idle' },
      },
      {
        id: '2',
        type: 'llm',
        position: { x: 380, y: 200 },
        data: {
          model: 'gemini-2.5-flash',
          systemPrompt: 'Describe this image in detail:',
          userMessage: '',
          resultText: '',
          status: 'idle',
        },
      },
    ],
    edges: [
      { id: 'e1-2', source: '1', sourceHandle: 'out', target: '2', targetHandle: 'images', type: 'purple', animated: true },
    ],
  },
]

// ── Thumbnail chip renderer ─────────────────────────────────────────────────

type ThumbNode = { id: string; type?: string; data: Record<string, unknown> }

const NODE_COLOR_MAP: Record<string, string> = {
  text: 'preset-thumb-node--blue',
  uploadImage: 'preset-thumb-node--blue',
  uploadVideo: 'preset-thumb-node--amber',
  llm: 'preset-thumb-node--green',
  cropImage: 'preset-thumb-node--purple',
  extractFrame: 'preset-thumb-node--accent',
}

const NODE_LABEL_MAP: Record<string, string> = {
  text: 'Text',
  uploadImage: 'Image',
  uploadVideo: 'Video',
  llm: 'LLM',
  cropImage: 'Crop',
  extractFrame: 'Extract',
}

function PresetThumb({ preset }: { preset: Preset }) {
  if (preset.id === 'product-marketing-kit') {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 h-full w-full">
        <div className="flex items-center gap-1.5">
          <div className="preset-thumb-node preset-thumb-node--blue">Img</div>
          <div className="preset-thumb-edge" />
          <div className="preset-thumb-node preset-thumb-node--purple">Crop</div>
          <div className="preset-thumb-edge" />
          <div className="preset-thumb-node preset-thumb-node--green">LLM</div>
        </div>
        <div className="flex items-center gap-1.5" style={{ opacity: 0.8 }}>
          <div className="preset-thumb-node preset-thumb-node--amber">Vid</div>
          <div className="preset-thumb-edge" />
          <div className="preset-thumb-node preset-thumb-node--accent">Frame</div>
          <div className="preset-thumb-edge" />
          <div className="preset-thumb-node preset-thumb-node--green">Merge</div>
        </div>
      </div>
    )
  }

  const isParallel = preset.id === 'parallel-llm'

  if (isParallel) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 h-full w-full">
        <div className="flex items-center gap-1.5">
          <div className="preset-thumb-node preset-thumb-node--blue">Text</div>
          <div className="preset-thumb-edge" />
          <div className="preset-thumb-node preset-thumb-node--green">LLM A</div>
        </div>
        <div className="flex items-center gap-1.5" style={{ opacity: 0.6 }}>
          <div className="preset-thumb-node preset-thumb-node--blue">Text</div>
          <div className="preset-thumb-edge" />
          <div className="preset-thumb-node preset-thumb-node--purple">LLM B</div>
        </div>
      </div>
    )
  }

  const nodes = preset.nodes as ThumbNode[]
  return (
    <div className="flex items-center justify-center gap-1.5 h-full w-full px-2">
      {nodes.map((node, i) => {
        const colorClass = NODE_COLOR_MAP[node.type ?? ''] ?? 'preset-thumb-node--default'
        const label = NODE_LABEL_MAP[node.type ?? ''] ?? node.type ?? '?'
        return (
          <div key={node.id} className="flex items-center gap-1.5">
            {i > 0 && <div className="preset-thumb-edge" />}
            <div className={`preset-thumb-node ${colorClass}`}>{label}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Modal component ─────────────────────────────────────────────────────────

type WorkflowPresetsModalProps = {
  onDismiss: () => void
}

export default function WorkflowPresetsModal({ onDismiss }: WorkflowPresetsModalProps) {
  const { fitView } = useReactFlow()

  const loadPreset = useCallback(
    (preset: Preset) => {
      // Set nodes and edges through the Zustand store so history + validation stay consistent
      useWorkflowStore.getState().setNodes(preset.nodes)
      useWorkflowStore.getState().setEdges(preset.edges)
      // FitView after React has committed the new nodes
      setTimeout(() => fitView({ padding: 0.25, duration: 400 }), 60)
      onDismiss()
    },
    [fitView, onDismiss],
  )

  return (
    <div className="workflow-presets-overlay">
      <p className="workflow-presets-hint">
        <kbd>Add a node</kbd>
        <span>or drag and drop media files, or select a preset</span>
      </p>

      <div className="workflow-presets-row">
        {/* Empty workflow card */}
        <button
          className="preset-card preset-card--empty"
          onClick={onDismiss}
          title="Start from scratch"
        >
          <Plus size={24} strokeWidth={1.5} />
          <span>Empty Workflow</span>
        </button>

        {/* Sample preset cards */}
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            className="preset-card"
            onClick={() => loadPreset(preset)}
            title={preset.description}
          >
            <div className="preset-card__thumb">
              <PresetThumb preset={preset} />
            </div>
            <div className="preset-card__body">
              <p className="preset-card__title">{preset.title}</p>
              <p className="preset-card__desc">{preset.description}</p>
            </div>
          </button>
        ))}
      </div>

      <button className="workflow-presets-dismiss" onClick={onDismiss}>
        <X size={13} />
        Dismiss
      </button>
    </div>
  )
}
