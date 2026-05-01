import { task } from "@trigger.dev/sdk/v3";
import { prisma } from "@/lib/db/prisma";
import { collectInputs } from "@/lib/workflow/dispatch-node-task";
import type { AppNode, AppEdge } from "@/types/workflow";
import { tasks } from "@trigger.dev/sdk/v3";
import type { runLlmTask } from "./run-llm-task";
import type { cropImageTask } from "./crop-image-task";
import type { extractFrameTask } from "./extract-frame-task";
import { NodeExecutionStatus, RunStatus } from "@prisma/client";

interface RunWorkflowPayload {
  runId: string;
  workflowId: string;
  waves: string[][];
  nodes: AppNode[];
  edges: AppEdge[];
}

export const runWorkflowTask = task({
  id: "run-workflow-task",
  maxDuration: 3600, // 1 hour max duration for worst-case workflows
  run: async (payload: RunWorkflowPayload) => {
    const { runId, waves, nodes, edges } = payload;
    
    // Heartbeat helper
    const updateHeartbeat = async () => {
      await prisma.workflowRun.update({
        where: { id: runId },
        data: { lastHeartbeatAt: new Date() }
      });
    };

    await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: RunStatus.RUNNING }
    });

    const resolvedMap = new Map<string, unknown>();
    const failedNodeIds = new Set<string>();

    for (const wave of waves) {
      await updateHeartbeat();

      for (const nodeId of wave) {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) {
          failedNodeIds.add(nodeId);
          continue;
        }

        // 1. Idempotency Check: Did this node already finish in a previous run attempt?
        const existing = await prisma.nodeExecution.findFirst({
          where: { 
            runId, 
            nodeId, 
            status: { in: ['COMPLETED', 'FAILED', 'SKIPPED'] } 
          }
        });

        if (existing) {
          if (existing.status === 'COMPLETED' && existing.output) {
            resolvedMap.set(nodeId, existing.output);
          } else if (existing.status === 'FAILED') {
            failedNodeIds.add(nodeId);
          }
          continue;
        }

        // 2. Dependency Check: Did any upstream dependency fail?
        const incomingEdges = edges.filter((e) => e.target === nodeId);
        const hasFailedDep = incomingEdges.some((e) => failedNodeIds.has(e.source));
        if (hasFailedDep) {
          await prisma.nodeExecution.create({
            data: {
              runId,
              nodeId,
              nodeType: node.type,
              status: NodeExecutionStatus.SKIPPED,
              inputs: {},
            }
          });
          failedNodeIds.add(nodeId); // Propagate skip/failure downstream
          continue;
        }

        // 3. Resolve Inputs
        const resolvedInputs = collectInputs(nodeId, edges, resolvedMap);

        // Mark as RUNNING
        await prisma.nodeExecution.create({
          data: {
            runId,
            nodeId,
            nodeType: node.type,
            status: NodeExecutionStatus.RUNNING,
            inputs: resolvedInputs as any,
          }
        });

        // 4. Execute Node
        try {
          let output: unknown = undefined;

          switch (node.type) {
            case 'text':
              output = (node.data as any).value ?? '';
              break;

            case 'uploadImage':
              output = (node.data as any).imageUrl;
              if (!output) throw new Error('Upload Image node has no uploaded image yet');
              break;

            case 'uploadVideo':
              output = (node.data as any).videoUrl;
              if (!output) throw new Error('Upload Video node has no uploaded video yet');
              break;

            case 'llm': {
              const data = node.data as any;
              const systemPrompt = (resolvedInputs['system_prompt'] as string | undefined) ?? data.systemPrompt;
              const userMessage = (resolvedInputs['user_message'] as string | undefined) ?? data.userMessage;
              
              if (!userMessage?.trim()) throw new Error('LLM node requires a user message');
              
              const rawImages = resolvedInputs['images'];
              const imageUrls = rawImages
                ? (Array.isArray(rawImages) ? rawImages : [rawImages]).filter((url): url is string => typeof url === 'string' && url.startsWith('http'))
                : [];
              
              const result = await tasks.triggerAndWait<typeof runLlmTask>('run-llm-task', {
                nodeId, runId, model: data.model, systemPrompt: systemPrompt || undefined, userMessage, imageUrls
              });
              
              if (result.ok) {
                output = result.output.text;
              } else {
                throw new Error(result.error?.message || 'LLM task failed');
              }
              break;
            }

            case 'cropImage': {
              const data = node.data as any;
              const imageUrl = resolvedInputs['image_url'] as string | undefined;
              if (!imageUrl) throw new Error('Crop Image node requires an image connected to the image_url handle');
              
              const xPercent = (resolvedInputs['x_percent'] as number | string | undefined) ?? data.xPercent;
              const yPercent = (resolvedInputs['y_percent'] as number | string | undefined) ?? data.yPercent;
              const widthPercent = (resolvedInputs['width_percent'] as number | string | undefined) ?? data.widthPercent;
              const heightPercent = (resolvedInputs['height_percent'] as number | string | undefined) ?? data.heightPercent;

              const result = await tasks.triggerAndWait<typeof cropImageTask>('crop-image-task', {
                nodeId, runId, imageUrl, xPercent, yPercent, widthPercent, heightPercent
              });

              if (result.ok) {
                output = result.output.cdnUrl;
              } else {
                throw new Error(result.error?.message || 'Crop Image task failed');
              }
              break;
            }

            case 'extractFrame': {
              const data = node.data as any;
              const videoUrl = resolvedInputs['video_url'] as string | undefined;
              if (!videoUrl) throw new Error('Extract Frame node requires a video connected to the video_url handle');
              
              const timestamp = (resolvedInputs['timestamp'] as number | string | undefined) ?? data.timestamp;

              const result = await tasks.triggerAndWait<typeof extractFrameTask>('extract-frame-task', {
                nodeId, runId, videoUrl, timestamp
              });

              if (result.ok) {
                output = result.output.cdnUrl;
              } else {
                throw new Error(result.error?.message || 'Extract Frame task failed');
              }
              break;
            }

            default:
              throw new Error(`Unknown node type: ${node.type}`);
          }

          resolvedMap.set(nodeId, output);

          // Mark as COMPLETED
          await prisma.nodeExecution.updateMany({
            where: { runId, nodeId },
            data: { 
              status: NodeExecutionStatus.COMPLETED, 
              output: output as any,
              executionMs: 0 // Could calculate this if needed
            }
          });

        } catch (err) {
          failedNodeIds.add(nodeId);
          const errorMessage = err instanceof Error ? err.message : 'Unknown error during node execution';
          
          await prisma.nodeExecution.updateMany({
            where: { runId, nodeId },
            data: { status: NodeExecutionStatus.FAILED, error: errorMessage as any }
          });
        }
      }
    }

    // 5. Finalize WorkflowRun
    const finalRun = await prisma.workflowRun.findUnique({ 
      where: { id: runId }, 
      include: { nodeExecutions: true } 
    });
    
    if (!finalRun) return;

    const failedCount = finalRun.nodeExecutions.filter(n => n.status === 'FAILED').length;
    const successCount = finalRun.nodeExecutions.filter(n => n.status === 'COMPLETED').length;
    
    const dbStatus = failedCount === 0 ? RunStatus.COMPLETED : successCount === 0 ? RunStatus.FAILED : RunStatus.PARTIAL;

    await prisma.workflowRun.update({
      where: { id: runId },
      data: { 
        status: dbStatus, 
        completedAt: new Date(), 
        durationMs: new Date().getTime() - finalRun.startedAt.getTime(), 
        lastHeartbeatAt: new Date() 
      }
    });
  }
});
