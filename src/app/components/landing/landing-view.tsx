import Link from "next/link"
import { LandingSidebar } from "./sidebar"
import { ArrowRight, Sparkles, Workflow, Cpu, Layers } from "lucide-react"

export function LandingView() {
  return (
    <div className="flex min-h-screen bg-black font-sans text-white">
      <LandingSidebar />
      <main className="min-h-screen flex-1 bg-[#0d0d0d] px-6 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-5xl">
          {/* Hero Section */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-8 sm:p-12">
            <div className="flex flex-col items-start gap-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Next-Gen Visual AI Workflows</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                Build & Execute Multimodal LLM Pipelines
              </h1>
              <p className="max-w-2xl text-base text-zinc-400 sm:text-lg">
                Connect LLMs, image manipulation, and video frame extraction in a visual DAG graph powered by Gemini and Trigger.dev.
              </p>
              <div className="mt-2 flex flex-wrap gap-4">
                <Link
                  href="/workflow"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  Create Workflow
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:border-white/10 hover:bg-white/[0.04]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <Workflow className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Visual DAG Canvas</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Intuitive node-based canvas for orchestrating text, images, video processing, and LLMs.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:border-white/10 hover:bg-white/[0.04]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Gemini & Multimodal</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Leverage Google Gemini for smart prompt chains and vision processing.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:border-white/10 hover:bg-white/[0.04]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Background Execution</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Wave-based async execution using Trigger.dev and Upstash Redis.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
