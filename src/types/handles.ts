/**
 * Port semantic types for type-safe edges (assignment §6).
 * Used by `isValidConnection` and must stay aligned with Zod/API schemas in later phases.
 */
export type HandleDataType = 'text' | 'image' | 'video' | 'number'

/**
 * Maps target handle IDs to which source output types may connect.
 * `timestamp` accepts text (e.g. "50%") or numeric strings from a dedicated number path.
 */
export const TARGET_HANDLE_ACCEPTS: Readonly<Record<string, readonly HandleDataType[]>> = {
  system_prompt: ['text'],
  user_message: ['text'],
  images: ['image'],
  image_url: ['image'],
  video_url: ['video'],
  timestamp: ['text', 'number'],
  /** Text nodes may feed string percentages; dedicated number outputs use `number`. */
  x_percent: ['text', 'number'],
  y_percent: ['text', 'number'],
  width_percent: ['text', 'number'],
  height_percent: ['text', 'number'],
} as const

export type TargetHandleId = keyof typeof TARGET_HANDLE_ACCEPTS
