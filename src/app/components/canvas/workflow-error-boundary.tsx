'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; label: string }

type State = { error: Error | null }

/**
 * Isolates canvas / sidebar failures so the rest of the shell stays usable.
 */
export class WorkflowErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[NextFlow] ${this.props.label}`, error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-sm font-medium text-red-400">Something went wrong in {this.props.label}.</p>
          <p className="max-w-xs text-xs text-zinc-500">{this.state.error.message}</p>
          <button
            type="button"
            className="mt-2 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-white"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
