import type { Edge, Node } from '@xyflow/react'
import type { HandleDataType } from '@/types/handles'

/** Discriminant for React Flow `node.type` (Quick Access palette). */
export type AppNodeType = 'text' | 'uploadImage' | 'uploadVideo' | 'llm' | 'cropImage' | 'extractFrame'

/** Default Gemini models for the LLM node selector (swap via env/task later). */
export const GEMINI_MODEL_OPTIONS = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
] as const

export type TextNodeData = {
  value: string
}

export type UploadImageNodeData = {
  imageUrl: string | null
  fileName?: string
  status: 'idle' | 'uploading' | 'error'
  errorMessage?: string
}

export type UploadVideoNodeData = {
  videoUrl: string | null
  fileName?: string
  status: 'idle' | 'uploading' | 'error'
  errorMessage?: string
}

export type LlmNodeData = {
  model: string
  /** Used when `system_prompt` handle is not connected. */
  systemPrompt: string
  /** Used when `user_message` handle is not connected. */
  userMessage: string
  resultText: string
  status: 'idle' | 'running' | 'success' | 'error'
  errorMessage?: string
}

export type CropImageNodeData = {
  xPercent: string
  yPercent: string
  widthPercent: string
  heightPercent: string
}

export type ExtractFrameNodeData = {
  timestamp: string
}

export type AppNodeData =
  | TextNodeData
  | UploadImageNodeData
  | UploadVideoNodeData
  | LlmNodeData
  | CropImageNodeData
  | ExtractFrameNodeData

export type AppNode = Node<AppNodeData, AppNodeType>

export type AppEdge = Edge

/** Source handle id for all producer nodes (single output). */
export const SOURCE_HANDLE_ID = 'out'

/**
 * Maps canvas node type → data carried on outgoing edges.
 * Crop / extract outputs are image URLs; LLM output is text.
 */
export function getSourceDataType(nodeType: AppNodeType): HandleDataType | null {
  switch (nodeType) {
    case 'text':
      return 'text'
    case 'uploadImage':
    case 'cropImage':
    case 'extractFrame':
      return 'image'
    case 'uploadVideo':
      return 'video'
    case 'llm':
      return 'text'
  }
}

export function defaultNodeData(type: AppNodeType): AppNodeData {
  switch (type) {
    case 'text':
      return { value: '' }
    case 'uploadImage':
      return { imageUrl: null, status: 'idle' }
    case 'uploadVideo':
      return { videoUrl: null, status: 'idle' }
    case 'llm':
      return {
        model: GEMINI_MODEL_OPTIONS[0]?.value ?? 'gemini-2.0-flash',
        systemPrompt: '',
        userMessage: '',
        resultText: '',
        status: 'idle',
      }
    case 'cropImage':
      return {
        xPercent: '0',
        yPercent: '0',
        widthPercent: '100',
        heightPercent: '100',
      }
    case 'extractFrame':
      return { timestamp: '0' }
  }
}
