import { task } from '@trigger.dev/sdk'
import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import type { RunLlmPayload, RunLlmResult } from '@/types/tasks'
import { prisma } from '@/lib/db/prisma'

/**
 * Trigger.dev background task — calls the Google Gemini API with optional
 * multimodal inputs (text + images).
 *
 * Retry config handles 429 rate-limit responses automatically:
 * - Attempt 1: immediate
 * - Attempt 2: ~200 ms
 * - Attempt 3: ~400 ms
 *
 * @param payload - nodeId, model, systemPrompt, userMessage, imageUrls
 * @returns { text, model } — the generated response text and model used
 */
export const runLlmTask = task({
  id: 'run-llm-task',
  maxDuration: 120,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 200,
    maxTimeoutInMs: 800,
    randomize: false,
  },
  run: async (payload: RunLlmPayload): Promise<RunLlmResult> => {
    const startTime = Date.now()

    // ── 1. Create NodeExecution record (Running) ───────────────────────────
    let executionId: string | undefined
    if (payload.runId) {
      try {
        const execution = await prisma.nodeExecution.create({
          data: {
            runId: payload.runId,
            nodeId: payload.nodeId,
            nodeType: 'llm',
            status: 'RUNNING',
            inputs: {
              model: payload.model,
              systemPrompt: payload.systemPrompt,
              userMessage: payload.userMessage,
              imageUrls: payload.imageUrls,
            } as any,
          },
        })
        executionId = execution.id
      } catch (err) {
        console.error('[runLlmTask] Failed to create NodeExecution record:', err)
      }
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set')
      }

      const genAI = new GoogleGenerativeAI(apiKey)

      const model = genAI.getGenerativeModel({
        model: payload.model,
        ...(payload.systemPrompt ? { systemInstruction: payload.systemPrompt } : {}),
      })

      // Build the content parts array — text first, then any images
      const parts: Part[] = [{ text: payload.userMessage }]

      for (const imageUrl of payload.imageUrls ?? []) {
        const res = await fetch(imageUrl)
        if (!res.ok) {
          throw new Error(`Failed to fetch image at ${imageUrl}: ${res.status} ${res.statusText}`)
        }
        const buffer = await res.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const mimeType = res.headers.get('content-type') ?? 'image/jpeg'
        parts.push({ inlineData: { data: base64, mimeType } })
      }

      const result = await model.generateContent(parts)
      const text = result.response.text()
      const durationMs = Date.now() - startTime

      // ── 2. Update NodeExecution record (Completed) ────────────────────────
      if (executionId) {
        await prisma.nodeExecution.update({
          where: { id: executionId },
          data: {
            status: 'COMPLETED',
            output: { text, model: payload.model } as any,
            executionMs: durationMs,
          },
        })
      }

      return { text, model: payload.model }
    } catch (err) {
      const durationMs = Date.now() - startTime
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      // ── 3. Update NodeExecution record (Failed) ───────────────────────────
      if (executionId) {
        await prisma.nodeExecution.update({
          where: { id: executionId },
          data: {
            status: 'FAILED',
            error: { message: errorMessage } as any,
            executionMs: durationMs,
          },
        })
      }

      throw err
    }
  },
})
