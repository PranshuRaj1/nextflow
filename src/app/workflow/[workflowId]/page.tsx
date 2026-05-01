import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { WorkflowShell } from '@/app/components/canvas/workflow-shell'

export const dynamic = 'force-dynamic'

export default async function WorkflowEditorPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ workflowId: string }>
  searchParams: Promise<{ new?: string }>
}) {
  const { userId } = await auth()
  if (!userId) {
    redirect('/')
  }

  const { workflowId } = await params
  const resolvedSearchParams = await searchParams
  const isNew = resolvedSearchParams.new === '1'

  const appUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true }
  })

  if (!appUser) {
    redirect('/workflow')
  }

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: {
      id: true,
      name: true,
      nodes: true,
      edges: true,
      userId: true,
    }
  })

  // Basic security - ensure workflow exists and belongs to the user
  if (!workflow || workflow.userId !== appUser.id) {
    redirect('/workflow')
  }

  // Convert Prisma JsonValue back to generic arrays
  // (the WorkflowShell handles specific RF formatting/sanitising)
  const initialData = {
    id: workflow.id,
    name: workflow.name,
    nodes: (workflow.nodes as any[]) ?? [],
    edges: (workflow.edges as any[]) ?? [],
  }

  return <WorkflowShell initialData={initialData} isNew={isNew} />
}
