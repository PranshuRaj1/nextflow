// src/lib/workflow/error-hints.ts

/**
 * Maps (nodeType, rawErrorMessage) → a user-friendly contextual hint string.
 *
 * Pure function — no React, no side effects. Import in any node component to
 * display an actionable suggestion alongside the raw error message.
 *
 * @param nodeType - The React Flow node type string (e.g. 'llm', 'cropImage').
 * @param error    - The raw error message string stored in the execution store.
 * @returns A short, actionable hint sentence, or a generic fallback.
 */
export function getNodeErrorHint(nodeType: string, error: string): string {
  const e = error.toLowerCase()

  // ── LLM node ──────────────────────────────────────────────────────────────
  if (nodeType === 'llm') {
    if (e.includes('429') || e.includes('rate limit') || e.includes('quota')) {
      return 'Gemini rate limit hit. Wait a moment, then retry — or switch to Flash Lite in the model dropdown.'
    }
    if (e.includes('api_key') || e.includes('api key') || e.includes('apikey')) {
      return 'Invalid or missing Gemini API key. Check your GEMINI_API_KEY environment variable.'
    }
    if (e.includes('user message') || e.includes('user_message')) {
      return 'Connect a Text node to the user_message handle, or type a message directly into the field.'
    }
    if (e.includes('503') || e.includes('service unavailable') || e.includes('overloaded')) {
      return 'Gemini service is temporarily overloaded. Wait a few seconds and retry.'
    }
    if (e.includes('400') || e.includes('bad request')) {
      return 'The request was rejected by the API. Check your system prompt and user message for unsupported content.'
    }
    return 'Check your model selection and message inputs, then retry.'
  }

  // ── Crop Image node ────────────────────────────────────────────────────────
  if (nodeType === 'cropImage') {
    if (e.includes('bounds') || e.includes('crop') || e.includes('exceed')) {
      return 'Crop area exceeds image bounds. Reduce x% + width% so they sum to ≤ 100, same for y% + height%.'
    }
    if (e.includes('image_url') || e.includes('image url') || e.includes('handle') || e.includes('no image')) {
      return 'Connect an Upload Image or another image-output node to the image_url handle.'
    }
    if (e.includes('ffmpeg') || e.includes('format') || e.includes('codec')) {
      return 'FFmpeg could not process this image. Ensure the file is a valid jpg, png, or webp.'
    }
    return 'Check the crop parameters and the connected image source.'
  }

  // ── Extract Frame node ─────────────────────────────────────────────────────
  if (nodeType === 'extractFrame') {
    if (e.includes('video_url') || e.includes('video url') || e.includes('handle') || e.includes('no video')) {
      return 'Connect an Upload Video node to the video_url handle.'
    }
    if (e.includes('timestamp') || e.includes('time') || e.includes('duration') || e.includes('out of range')) {
      return 'Enter a valid timestamp: seconds (e.g. 30) or a percentage (e.g. 50%). Must be within the video duration.'
    }
    if (e.includes('ffmpeg') || e.includes('format') || e.includes('codec')) {
      return 'FFmpeg could not process this video. Ensure it is a valid mp4, mov, or webm file.'
    }
    return 'Check the timestamp value and the connected video source.'
  }

  // ── Upload Image / Upload Video nodes ──────────────────────────────────────
  if (nodeType === 'uploadImage') {
    if (e.includes('format') || e.includes('jpg') || e.includes('png') || e.includes('webp') || e.includes('gif')) {
      return 'Unsupported format. Upload a jpg, png, webp, or gif file.'
    }
    if (e.includes('upload') || e.includes('cdn') || e.includes('transloadit')) {
      return 'Upload to CDN failed. Check your network connection and try again.'
    }
    return 'Select a valid image file using the upload button.'
  }

  if (nodeType === 'uploadVideo') {
    if (e.includes('format') || e.includes('mp4') || e.includes('mov') || e.includes('webm')) {
      return 'Unsupported format. Upload an mp4, mov, webm, or m4v file.'
    }
    if (e.includes('upload') || e.includes('cdn') || e.includes('transloadit')) {
      return 'Upload to CDN failed. Check your network connection and try again.'
    }
    return 'Select a valid video file using the upload button.'
  }

  // ── Generic fallback ───────────────────────────────────────────────────────
  return 'Check your inputs and try again.'
}
