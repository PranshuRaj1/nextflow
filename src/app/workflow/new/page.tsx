'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

/**
 * Route handler for /workflow/new.
 * Automatically creates a new workflow DB record and redirects to /workflow/[id]?new=1
 */
export default function NewWorkflowPage() {
  const router = useRouter()
  const [error, setError] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function createAndRedirect() {
      try {
        const res = await fetch('/api/workflows', { method: 'POST' })
        if (!res.ok) throw new Error('Failed to create workflow')
        const { id } = (await res.json()) as { id: string }
        if (isMounted) {
          router.replace(`/workflow/${id}?new=1`)
        }
      } catch {
        if (isMounted) {
          setError(true)
        }
      }
    }
    createAndRedirect()
    return () => {
      isMounted = false
    }
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--canvas-bg)] text-white">
        <p className="text-sm font-medium text-red-400">Failed to create workflow.</p>
        <button
          type="button"
          onClick={() => router.push('/workflow')}
          className="mt-4 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:bg-zinc-700"
        >
          Go to Workflows Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--canvas-bg)] text-white">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
      <p className="text-sm font-medium text-zinc-400">Creating new workflow...</p>
    </div>
  )
}
