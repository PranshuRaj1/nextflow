import { task } from '@trigger.dev/sdk/v3'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, readFile, unlink, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Transloadit } from 'transloadit'
import type { CropImagePayload, CropImageResult } from '@/types/tasks'

const execFileAsync = promisify(execFile)

/**
 * Trigger.dev background task — crops an image using FFmpeg and re-uploads
 * the result to Transloadit CDN.
 *
 * ### Crop algorithm
 * All four parameters are percentages (0–100) of the source image dimensions.
 * They are converted to pixel values before being passed to FFmpeg:
 * ```
 * x_px      = round((xPercent / 100) * imageWidth)
 * y_px      = round((yPercent / 100) * imageHeight)
 * width_px  = round((widthPercent / 100) * imageWidth)
 * height_px = round((heightPercent / 100) * imageHeight)
 * ```
 * FFmpeg filter: `crop=width_px:height_px:x_px:y_px`
 *
 * ### Retry config
 * Up to 3 attempts with exponential back-off.
 * FFmpeg errors (bad codec, unsupported format) will not be retried —
 * only transient network or Transloadit upload failures benefit from retries.
 *
 * @param payload - nodeId, imageUrl, xPercent, yPercent, widthPercent, heightPercent
 * @returns { cdnUrl } — Transloadit CDN URL of the cropped image
 */
export const cropImageTask = task({
  id: 'crop-image-task',
  maxDuration: 60,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 200,
    maxTimeoutInMs: 800,
    randomize: false,
  },
  run: async (payload: CropImagePayload): Promise<CropImageResult> => {
    const transloaditKey = process.env.TRANSLOADIT_KEY
    const transloaditSecret = process.env.TRANSLOADIT_SECRET
    if (!transloaditKey || !transloaditSecret) {
      throw new Error('TRANSLOADIT_KEY or TRANSLOADIT_SECRET environment variable is not set')
    }

    // ── 1. Download source image from CDN ─────────────────────────────────
    const downloadRes = await fetch(payload.imageUrl)
    if (!downloadRes.ok) {
      throw new Error(
        `Failed to download image from ${payload.imageUrl}: ${downloadRes.status} ${downloadRes.statusText}`,
      )
    }

    const imageBuffer = Buffer.from(await downloadRes.arrayBuffer())

    // ── 2. Write image to temp file (FFprobe reads from disk) ──────────────────
    const tmpDir = await mkdtemp(join(tmpdir(), 'nextflow-crop-'))
    const inputPath = join(tmpDir, 'input.jpg')
    const outputPath = join(tmpDir, 'output.jpg')

    try {
      await writeFile(inputPath, imageBuffer)

      // ── 3. Get image dimensions via FFprobe ──────────────────────────────
      const { stdout: probeJson } = await execFileAsync('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        inputPath,
      ])

      let imageWidth: number
      let imageHeight: number
      try {
        const probe = JSON.parse(probeJson.toString()) as {
          streams?: Array<{ codec_type?: string; width?: number; height?: number }>
        }
        const videoStream = probe.streams?.find((s) => s.codec_type === 'video')
        if (!videoStream?.width || !videoStream?.height) {
          throw new Error('Could not determine image dimensions from FFprobe output')
        }
        imageWidth = videoStream.width
        imageHeight = videoStream.height
      } catch (err) {
        throw new Error(
          `FFprobe failed to parse image dimensions: ${err instanceof Error ? err.message : String(err)}`,
        )
      }

      // ── 4. Convert percentage params to pixel values ────────────────────
      const xPx = Math.round((payload.xPercent / 100) * imageWidth)
      const yPx = Math.round((payload.yPercent / 100) * imageHeight)
      const wPx = Math.max(1, Math.round((payload.widthPercent / 100) * imageWidth))
      const hPx = Math.max(1, Math.round((payload.heightPercent / 100) * imageHeight))

      // Clamp to image bounds to avoid FFmpeg errors on edge-case inputs
      const safeX = Math.min(xPx, imageWidth - 1)
      const safeY = Math.min(yPx, imageHeight - 1)
      const safeW = Math.min(wPx, imageWidth - safeX)
      const safeH = Math.min(hPx, imageHeight - safeY)

      // ── 5. Run FFmpeg crop ──────────────────────────────────────────────
      await execFileAsync('ffmpeg', [
        '-i', inputPath,
        '-vf', `crop=${safeW}:${safeH}:${safeX}:${safeY}`,
        '-frames:v', '1',
        '-q:v', '2',   // High JPEG quality (2 = near-lossless, scale 1–31)
        '-y',          // Overwrite output without prompting
        outputPath,
      ])

      // ── 6. Read cropped output ──────────────────────────────────────────
      const croppedBuffer = await readFile(outputPath)

      // ── 7. Upload to Transloadit CDN ────────────────────────────────────
      const transloadit = new Transloadit({
        authKey: transloaditKey,
        authSecret: transloaditSecret,
      })

      const assembly = await transloadit.createAssembly({
        waitForCompletion: true,
        params: {
          steps: {
            ':original': {
              robot: '/upload/handle',
            },
          },
        },
        uploads: {
          'cropped.jpg': croppedBuffer,
        },
      })

      const fromResults =
        assembly.results?.[':original']?.[0] ??
        Object.values(assembly.results ?? {}).find((arr) => arr && arr.length > 0)?.[0]

      const fromUploads = assembly.uploads?.[0]

      const uploadedFile = fromResults ?? fromUploads
      if (!uploadedFile?.ssl_url) {
        throw new Error('Transloadit upload did not return a CDN URL')
      }

      return { cdnUrl: uploadedFile.ssl_url }
    } finally {
      // ── 8. Clean up temp files ──────────────────────────────────────────
      await unlink(inputPath).catch(() => undefined)
      await unlink(outputPath).catch(() => undefined)
    }
  },
})
