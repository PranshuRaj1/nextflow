// src/types/tasks.ts
/**
 * Shared payload and result types for all Trigger.dev task definitions.
 * Import these in both the task file and API route callers.
 * Use `import type` wherever possible to keep them tree-shakeable.
 */

// ---------------------------------------------------------------------------
// run-llm-task
// ---------------------------------------------------------------------------

/**
 * Input payload for the `run-llm-task` Trigger.dev task.
 * `imageUrls` are CDN URLs — the task fetches and base64-encodes them
 * before sending to the Gemini multimodal API.
 */
export interface RunLlmPayload {
  /** React Flow node ID — used by the client to match the result. */
  nodeId: string
  /** Gemini model string, e.g. 'gemini-2.5-flash'. */
  model: string
  /** Optional system instructions (from connected Text node or inline). */
  systemPrompt?: string
  /** Required user message text. */
  userMessage: string
  /** Zero or more CDN image URLs to include as inline image parts. */
  imageUrls?: string[]
}

/**
 * Return value of the `run-llm-task` Trigger.dev task.
 */
export interface RunLlmResult {
  /** The generated text from Gemini. */
  text: string
  /** The model string that was used, echoed back for display. */
  model: string
}

// ---------------------------------------------------------------------------
// crop-image-task (stub — implementation in a later phase)
// ---------------------------------------------------------------------------

export interface CropImagePayload {
  nodeId: string
  imageUrl: string
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
}

export interface CropImageResult {
  cdnUrl: string
}

// ---------------------------------------------------------------------------
// extract-frame-task (stub — implementation in a later phase)
// ---------------------------------------------------------------------------

export interface ExtractFramePayload {
  nodeId: string
  videoUrl: string
  timestamp: number | string
}

export interface ExtractFrameResult {
  cdnUrl: string
}
