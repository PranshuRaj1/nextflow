import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTaskError(error: string): string {
  if (!error) return 'An unknown error occurred'

  // Specific handling for common Gemini errors (503 Service Unavailable)
  if (error.includes('[503 Service Unavailable]')) {
    return error.split('] ').pop()?.trim() || error
  }

  // Handle Rate Limits
  if (error.includes('[429 Too Many Requests]')) {
    return 'Rate limit exceeded. Please wait a moment and try again.'
  }

  // Remove common technical prefixes
  let cleaned = error
    .replace(/^Error:\s*/i, '')
    .replace(/^\[GoogleGenerativeAI Error\]:\s*/i, '')
    .trim()

  // If it's a "fetch error" from Gemini or similar, focus on the actual reason at the end
  if (cleaned.includes('Error fetching from') || cleaned.includes('failed with status:')) {
    const parts = cleaned.split(/[:\]]\s*/)
    const lastPart = parts[parts.length - 1]?.trim()
    if (lastPart && lastPart.length > 5) {
      return lastPart
    }
  }

  return cleaned
}
