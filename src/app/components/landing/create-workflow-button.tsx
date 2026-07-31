"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { ArrowRight, Loader2 } from "lucide-react"

export function CreateWorkflowButton() {
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      if (!isSignedIn) {
        router.push("/workflow")
        return
      }

      const res = await fetch("/api/workflows", { method: "POST" })
      if (!res.ok) throw new Error("Failed to create workflow")
      const { id } = (await res.json()) as { id: string }
      router.push(`/workflow/${id}?new=1`)
    } catch {
      setIsCreating(false)
      router.push("/workflow")
    }
  }

  return (
    <button
      type="button"
      onClick={handleCreate}
      disabled={isCreating}
      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-75"
    >
      {isCreating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Creating workflow...</span>
        </>
      ) : (
        <>
          <span>Create Workflow</span>
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  )
}
