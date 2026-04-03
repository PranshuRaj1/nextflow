import { task } from '@trigger.dev/sdk/v3'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, readFile, unlink, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Transloadit } from 'transloadit'
import type { ExtractFramePayload, ExtractFrameResult } from '@/types/tasks'

const execFileAsync = promisify(execFile)

/**
 * Parses the `timestamp` field from an ExtractFrame node.
 *
 * Accepts two formats:
 * - A plain number or numeric string → treated as seconds (e.g. `30` → seek to 00:00:30)
 * - A percentage string ending in `%` → calculates seconds from video duration
 *   (e.g. `"50%"` on a 60s video → seek to 00:00:30)
 *
 * @param timestamp     - Raw value from the node's `timestamp` field.
 * @param videoDuration - Total video duration in seconds (required for % mode).
 * @returns             Seek position in seconds.
 */
function resolveTimestamp(timestamp: number | string, videoDuration: number): number {
  if (typeof timestamp === 'string' && timestamp.trim().endsWith('%')) {
    const pct = parseFloat(timestamp)
    if (isNaN(pct)) return 0
    return Math.max(0, Math.min((pct / 100) * videoDuration, videoDuration - 0.1))
  }
  const secs = typeof timestamp === 'number' ? timestamp : parseFloat(String(timestamp))
  if (isNaN(secs)) return 0
  return Math.max(0, Math.min(secs, videoDuration - 0.1))
}

/**
 * Trigger.dev background task — extracts a single frame from a video at a
 * given timestamp using FFmpeg and re-uploads the JPEG to Transloadit CDN.
 *
 * ### Timestamp formats
 * - Seconds: `30` or `"30"` → seek to 30 seconds
 * - Percentage: `"50%"` → seek to the midpoint of the video
 *
 * ### FFmpeg command used
 * ```
 * ffmpeg -ss {seekSeconds} -i input.mp4 -frames:v 1 -q:v 2 output.jpg
 * ```
 * `-ss` is placed before `-i` (input-side seek) for fast seeking on large files.
 *
 * ### Retry config
 * 3 attempts with exponential back-off. Useful for transient CDN download
 * failures; FFmpeg codec errors are not retryable but are surfaced clearly.
 *
 * @param payload - nodeId, videoUrl, timestamp (seconds or "50%")
 * @returns { cdnUrl } — Transloadit CDN URL of the extracted JPEG frame
 */
export const extractFrameTask = task({
  id: 'extract-frame-task',
  maxDuration: 60,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 200,
    maxTimeoutInMs: 800,
    randomize: false,
  },
  run: async (payload: ExtractFramePayload): Promise<ExtractFrameResult> => {
    const transloaditKey = process.env.TRANSLOADIT_KEY
    const transloaditSecret = process.env.TRANSLOADIT_SECRET
    if (!transloaditKey || !transloaditSecret) {
      throw new Error('TRANSLOADIT_KEY or TRANSLOADIT_SECRET environment variable is not set')
    }

    // ── 1. Download source video from CDN ─────────────────────────────────
    const downloadRes = await fetch(payload.videoUrl)
    if (!downloadRes.ok) {
      throw new Error(
        `Failed to download video from ${payload.videoUrl}: ${downloadRes.status} ${downloadRes.statusText}`,
      )
    }

    const videoBuffer = Buffer.from(await downloadRes.arrayBuffer())

    // ── 2. Write video to temp file (FFmpeg needs a seekable file) ─────────
    const tmpDir = await mkdtemp(join(tmpdir(), 'nextflow-frame-'))
    const inputPath = join(tmpDir, 'input.mp4')
    const outputPath = join(tmpDir, 'frame.jpg')

    try {
      await writeFile(inputPath, videoBuffer)

      // ── 3. Get video duration via FFprobe ──────────────────────────────
      const { stdout: probeJson } = await execFileAsync('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        inputPath,
      ])

      let videoDuration = 0
      try {
        const probe = JSON.parse(probeJson) as {
          streams?: Array<{ codec_type?: string; duration?: string }>
        }
        const videoStream = probe.streams?.find((s) => s.codec_type === 'video')
        videoDuration = parseFloat(videoStream?.duration ?? '0') || 0
      } catch {
        // If FFprobe fails to parse duration, default to 0 (seek to start)
      }

      // ── 4. Resolve seek position from timestamp ────────────────────────
      const seekSeconds = resolveTimestamp(payload.timestamp, videoDuration)

      // ── 5. Extract single frame with FFmpeg ────────────────────────────
      await execFileAsync('ffmpeg', [
        '-ss', String(seekSeconds), // Input-side seek — fast for large files
        '-i', inputPath,
        '-frames:v', '1',           // Extract exactly one frame
        '-q:v', '2',                // High JPEG quality (scale 1–31)
        '-y',                       // Overwrite output without prompting
        outputPath,
      ])

      // ── 6. Read extracted frame ────────────────────────────────────────
      const frameBuffer = await readFile(outputPath)

      // ── 7. Upload to Transloadit CDN ───────────────────────────────────
      const transloadit = new Transloadit({
        authKey: transloaditKey,
        authSecret: transloaditSecret,
      })

      const assembly = await transloadit.createAssembly({
        params: {
          steps: {
            ':original': {
              robot: '/upload/handle',
            },
          },
        },
        uploads: {
          'frame.jpg': frameBuffer,
        },
      })

      const uploadedFile = assembly.results?.[':original']?.[0]
      if (!uploadedFile?.ssl_url) {
        throw new Error('Transloadit upload did not return a CDN URL')
      }

      return { cdnUrl: uploadedFile.ssl_url }
    } finally {
      // ── 8. Clean up temp files ─────────────────────────────────────────
      await unlink(inputPath).catch(() => undefined)
      await unlink(outputPath).catch(() => undefined)
    }
  },
})
