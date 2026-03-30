import { WorkflowShell } from '@/app/components/canvas/workflow-shell'

/** Clerk + client canvas — avoid static prerender for auth-aware UI. */
export const dynamic = 'force-dynamic'

/**
 * Visual workflow builder. Auth: `src/proxy.ts` protects `/workflow/*`.
 */
export default function WorkflowPage() {
  return <WorkflowShell />
}
