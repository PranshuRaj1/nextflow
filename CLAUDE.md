# CLAUDE.md — NextFlow Implementation Context

This file provides complete context for AI coding agents (Claude Code, Cursor, Copilot) working on the NextFlow codebase. Read this entire file before making any changes.

---

## Project Overview

**NextFlow** is a pixel-perfect UI/UX clone of Krea.ai's workflow builder, scoped exclusively to LLM workflows. Users visually compose AI pipelines by connecting typed nodes on a React Flow canvas. Every node execution runs as a Trigger.dev background task.

**Non-negotiable architectural constraint:** ALL node execution (LLM calls, FFmpeg crop, frame extraction) MUST run as Trigger.dev background tasks. Never execute node logic inline inside Next.js API route handlers.

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 15+ | React framework with App Router |
| TypeScript | 5+ strict | Type safety throughout — zero suppressions |
| React Flow | latest | Visual workflow canvas |
| Zustand | latest | Client state management |
| Zod | latest | Schema validation at all API boundaries |
| Tailwind CSS | 3+ | Styling — all Krea.ai design tokens defined here |
| ShadCN/ui | latest | Compound components (Button, Select, Dialog, etc.) |
| Clerk | latest | Authentication — JWT middleware |
| Trigger.dev | v3 | Background task execution — ALL node ops |
| Transloadit + Uppy | latest | Browser-direct file uploads |
| Google Generative AI SDK | latest | `@google/generative-ai` — Gemini API |
| Prisma | latest | ORM — type-safe DB access |
| Neon PostgreSQL | latest | Serverless hosted Postgres |
| Lucide React | latest | Icon library |
| v0.dev | — | UI scaffolding (output must be reviewed + typed) |

---

## Coding Standards — ENFORCE THESE ON EVERY FILE

### TypeScript
- `strict: true` in tsconfig.json — always
- `noUncheckedIndexedAccess: true` — array access returns `T | undefined`
- `exactOptionalPropertyTypes: true` — optional props are truly optional
- **Zero tolerance:** no `as any`, no `@ts-ignore`, no `@ts-expect-error`
- All Prisma-generated types used directly — never re-declare them
- Zod schemas defined once in `lib/schemas/` — infer TypeScript types from them with `z.infer<typeof schema>`

### File & Naming Conventions
```
app/                          # Next.js App Router pages + layouts ONLY
app/api/                      # API routes — thin: validate → dispatch → respond
components/nodes/             # One file per node type
components/canvas/            # WorkflowCanvas, LeftSidebar, RightSidebar, TopBar
components/ui/                # ShadCN components (reviewed + typed)
lib/workflow/                 # DAG logic, topological sort, execution engine
lib/trigger/                  # Trigger.dev task definitions
lib/db/                       # Prisma singleton + typed query helpers
lib/schemas/                  # All Zod schemas — single source of truth
lib/transloadit/              # Uppy config + signature helpers
stores/                       # Zustand stores
types/                        # Shared TypeScript interfaces + enums
hooks/                        # Custom React hooks
```

| Item | Convention | Example |
|---|---|---|
| React components | PascalCase | `LLMNode.tsx` |
| Custom hooks | camelCase + `use` prefix | `useWorkflowExecution.ts` |
| Zustand stores | camelCase + `Store` suffix | `workflowStore.ts` |
| Zod schemas | camelCase + `Schema` suffix | `executeWorkflowSchema` |
| API routes | `route.ts` inside folder | `app/api/workflow/execute/route.ts` |
| Trigger.dev tasks | kebab-case ID | `run-llm-task` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE_MB` |
| TypeScript types | PascalCase, no `I` prefix | `NodeData`, `ExecutionResult` |

### Documentation
Every exported function, component, hook, and Trigger.dev task MUST have a JSDoc block:
```typescript
/**
 * Performs topological sort on the workflow DAG using Kahn's algorithm.
 * Returns nodes grouped into execution waves — nodes in the same wave
 * have no dependencies on each other and can be dispatched concurrently.
 *
 * Time complexity: O(V + E) where V = nodes, E = edges
 * Throws if a cycle is detected (DAG validation should prevent this).
 *
 * @param nodes - React Flow node array from Zustand workflowStore
 * @param edges - React Flow edge array from Zustand workflowStore
 * @returns Array of waves, each wave is an array of node IDs
 */
export function topologicalSort(nodes: Node[], edges: Edge[]): string[][] {
```

### v0.dev Generated Code Gate
When using v0.dev output, apply this checklist before committing:
- [ ] All props have explicit TypeScript types
- [ ] No implicit `any` anywhere
- [ ] JSDoc added to component and all props
- [ ] No hardcoded values that should be props or env vars
- [ ] Loading state handled
- [ ] Error state handled
- [ ] `tsc --noEmit` passes with zero errors

---

## Environment Variables

```bash
# .env.local

# Clerk — auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database — Neon PostgreSQL
DATABASE_URL=postgresql://...?sslmode=require

# Trigger.dev — background tasks
TRIGGER_SECRET_KEY=tr_...
TRIGGER_API_URL=https://api.trigger.dev

# Transloadit — file uploads
NEXT_PUBLIC_TRANSLOADIT_KEY=3c7804176485a1bd01d9c90e397c1fdf
TRANSLOADIT_SECRET=YOUR_SECRET_HERE
NEXT_PUBLIC_IMAGE_TEMPLATE_ID=<your-image-template-id>
NEXT_PUBLIC_VIDEO_TEMPLATE_ID=<your-video-template-id>

# Gemini — LLM (NEVER prefix with NEXT_PUBLIC_ — server/Trigger.dev only)
GEMINI_API_KEY=AIza...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**SECURITY RULES:**
- `GEMINI_API_KEY` — server/Trigger.dev only. NEVER `NEXT_PUBLIC_`.
- `TRANSLOADIT_SECRET` — server only. Used only in `/api/transloadit/signature`.
- `CLERK_SECRET_KEY` — server only.
- Only `NEXT_PUBLIC_TRANSLOADIT_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_IMAGE_TEMPLATE_ID`, `NEXT_PUBLIC_VIDEO_TEMPLATE_ID` are safe to expose to the browser.

---

## Database Schema

```prisma
// prisma/schema.prisma

enum RunStatus {
  pending
  running
  success
  failed
  partial
}

enum RunScope {
  full
  partial
  single
}

enum NodeStatus {
  pending
  running
  success
  failed
  skipped
}

model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  email     String   @unique
  createdAt DateTime @default(now())

  workflows     Workflow[]
  workflowRuns  WorkflowRun[]
}

model Workflow {
  id        String   @id @default(cuid())
  userId    String
  name      String   @default("Untitled Workflow")
  nodes     Json     // React Flow node array (position, type, data)
  edges     Json     // React Flow edge array (source, target, handles)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  runs        WorkflowRun[]
  nodeResults NodeResult[]
}

model WorkflowRun {
  id          String    @id @default(cuid())
  workflowId  String
  userId      String
  status      RunStatus @default(pending)
  scope       RunScope
  durationMs  Int?
  startedAt   DateTime  @default(now())
  completedAt DateTime?

  workflow   Workflow        @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  user       User            @relation(fields: [userId], references: [id])
  executions NodeExecution[]
}

model NodeExecution {
  id          String     @id @default(cuid())
  runId       String
  nodeId      String
  nodeType    String
  status      NodeStatus @default(pending)
  inputs      Json?
  output      Json?
  error       String?
  executionMs Int?
  createdAt   DateTime   @default(now())

  run WorkflowRun @relation(fields: [runId], references: [id], onDelete: Cascade)
}

model NodeResult {
  id         String   @id @default(cuid())
  workflowId String
  nodeId     String
  output     Json
  updatedAt  DateTime @updatedAt

  workflow Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  @@unique([workflowId, nodeId])
}
```

---

## Node Types — Complete Specification

### Handle Type System
```typescript
// types/handles.ts
export type HandleDataType = 'text' | 'image' | 'video' | 'number'

export interface HandleMeta {
  id: string
  dataType: HandleDataType
  label: string
  required: boolean
}
```

### Type-Safe Connection Rules
| Source output type | Allowed target handles | Blocked |
|---|---|---|
| `text` | `system_prompt`, `user_message`, `timestamp`, `x_percent`, `y_percent`, `width_percent`, `height_percent` | `image_url`, `video_url`, `images` |
| `image` | `image_url`, `images` (multi) | `system_prompt`, `user_message`, `video_url` |
| `video` | `video_url` | all image + text handles |
| `number` | `x_percent`, `y_percent`, `width_percent`, `height_percent`, `timestamp` | all text + image handles |

Enforce in `isValidConnection` callback on `<ReactFlow>`. Return `false` for blocked pairs. Show red connector line during invalid drag.

### 1. Text Node
- **Inputs:** none
- **Output handle:** `output` (type: `text`)
- **UI:** auto-resize `<Textarea>` (ShadCN), value stored in Zustand node data
- **Execution:** resolves immediately client-side, no Trigger.dev task

### 2. Upload Image Node
- **Inputs:** none
- **Output handle:** `output` (type: `image`)
- **UI:** Uppy + Transloadit widget, image preview after upload
- **Accepted:** `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` — max 50MB
- **Template settings:** Reject non-image files ON, Reject malware ON
- **Execution:** browser → Transloadit CDN directly. Node stores CDN URL.

### 3. Upload Video Node
- **Inputs:** none
- **Output handle:** `output` (type: `video`)
- **UI:** Uppy + Transloadit widget, HTML5 `<video>` preview after upload
- **Accepted:** `.mp4`, `.mov`, `.webm`, `.m4v` — max 200MB
- **Template settings:** Reject non-video files ON, Reject malware ON. All processing steps OFF.
- **Execution:** browser → Transloadit CDN directly. Node stores CDN URL.

### 4. Run LLM Node
- **Input handles:**
  - `system_prompt` (type: `text`, optional) — from Text Node
  - `user_message` (type: `text`, required) — from Text Node
  - `images` (type: `image`, optional, accepts multiple) — from Image Node(s)
- **Output handle:** `output` (type: `text`)
- **UI:** ShadCN `<Select>` for model dropdown, result displayed inline on node after execution
- **Visual:** pulsating glow CSS animation on node border during `running` state
- **Result:** displayed directly on the node — do NOT create a separate output node
- **Execution:** `run-llm-task` Trigger.dev task

### 5. Crop Image Node
- **Input handles:**
  - `image_url` (type: `image`, required)
  - `x_percent` (type: `number`, optional, default: 0)
  - `y_percent` (type: `number`, optional, default: 0)
  - `width_percent` (type: `number`, optional, default: 100)
  - `height_percent` (type: `number`, optional, default: 100)
- **Output handle:** `output` (type: `image`)
- **UI:** manual number inputs for each param. When a handle has an active edge connection, disable (grey out) the corresponding manual input — value comes from connected node.
- **Execution:** `crop-image-task` Trigger.dev task (FFmpeg + Transloadit re-upload)

### 6. Extract Frame from Video Node
- **Input handles:**
  - `video_url` (type: `video`, required)
  - `timestamp` (type: `text` or `number`, optional, default: 0) — accepts seconds (`30`) or percentage (`"50%"`)
- **Output handle:** `output` (type: `image`)
- **Execution:** `extract-frame-task` Trigger.dev task (FFmpeg + Transloadit re-upload)

---

## Trigger.dev Tasks

### `run-llm-task`
```typescript
// src/trigger/run-llm-task.ts
import { task } from '@trigger.dev/sdk/v3'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runLlmTask = task({
  id: 'run-llm-task',
  maxDuration: 120, // seconds
  retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 200 },
  run: async (payload: RunLlmPayload): Promise<RunLlmResult> => {
    // 1. Init Gemini with GEMINI_API_KEY (server-side only)
    // 2. Build content array: system instructions + user message + base64 images
    // 3. Call generateContent
    // 4. Return { text, model, usage }
  }
})
```

### `crop-image-task`
```typescript
// src/trigger/crop-image-task.ts
export const cropImageTask = task({
  id: 'crop-image-task',
  maxDuration: 60,
  run: async (payload: CropImagePayload): Promise<CropImageResult> => {
    // 1. Download image from Transloadit CDN URL
    // 2. Get image dimensions
    // 3. Convert percentage params to pixel values:
    //    x_px = Math.round((x_percent / 100) * width)
    //    y_px = Math.round((y_percent / 100) * height)
    //    w_px = Math.round((width_percent / 100) * width)
    //    h_px = Math.round((height_percent / 100) * height)
    // 4. Run: ffmpeg -i input.jpg -vf "crop=w_px:h_px:x_px:y_px" output.jpg
    // 5. Re-upload output to Transloadit using SDK (server-side)
    // 6. Return { cdnUrl }
  }
})
```

### `extract-frame-task`
```typescript
// src/trigger/extract-frame-task.ts
export const extractFrameTask = task({
  id: 'extract-frame-task',
  maxDuration: 60,
  run: async (payload: ExtractFramePayload): Promise<ExtractFrameResult> => {
    // 1. Download video from CDN URL
    // 2. Parse timestamp:
    //    - If string ending in '%': get video duration, calculate seek position
    //    - If number or numeric string: use directly as seconds
    // 3. Run: ffmpeg -ss {seekSeconds} -i input.mp4 -frames:v 1 output.jpg
    // 4. Re-upload output to Transloadit using SDK (server-side)
    // 5. Return { cdnUrl }
  }
})
```

### Task Payload Types
```typescript
// types/tasks.ts

export interface RunLlmPayload {
  runId: string
  nodeId: string
  model: string
  systemPrompt?: string
  userMessage: string
  imageUrls?: string[] // CDN URLs — task fetches and base64 encodes
}

export interface CropImagePayload {
  runId: string
  nodeId: string
  imageUrl: string
  xPercent: number   // 0-100, default 0
  yPercent: number   // 0-100, default 0
  widthPercent: number  // 0-100, default 100
  heightPercent: number // 0-100, default 100
}

export interface ExtractFramePayload {
  runId: string
  nodeId: string
  videoUrl: string
  timestamp: number | string // seconds or "50%"
}
```

---

## Execution Engine

### Topological Sort + Parallel Wave Dispatch
```typescript
// lib/workflow/execute.ts

/**
 * Groups nodes into execution waves using Kahn's algorithm.
 * Nodes in the same wave have no mutual dependencies and are
 * dispatched concurrently via Promise.all.
 */
export function buildExecutionWaves(nodes: Node[], edges: Edge[]): string[][] {
  // 1. Build in-degree map for each node
  // 2. Initialize queue with all zero in-degree nodes (Wave 0)
  // 3. Process queue: add node to current wave, decrement neighbor in-degrees
  // 4. When queue empties, start next wave with newly zero in-degree nodes
  // 5. Throw CycleDetectedError if not all nodes processed (cycle exists)
}

/**
 * Dispatches workflow execution.
 * Source nodes (Text, Upload) resolve immediately from stored values.
 * Processing nodes (LLM, Crop, Extract) dispatch as Trigger.dev tasks.
 * Convergence nodes wait for all upstream dependencies automatically
 * because each wave only starts after the previous wave's Promise.all resolves.
 */
export async function executeWorkflow(
  workflowId: string,
  runId: string,
  nodeIds: string[], // subset for partial/single execution
  resolvedOutputs: Map<string, NodeOutput>
): Promise<void>
```

### Execution Flow (per "Run" click)
1. Frontend: topological sort → build waves → POST `/api/workflow/execute`
2. API route: Clerk auth → Zod validate → create `WorkflowRun` (status: `pending`)
3. Execution engine: wave 0 dispatched. Each task creates `NodeExecution` (status: `running`)
4. Trigger.dev: task runs → on complete, calls `POST /api/trigger/webhook`
5. Webhook: verify HMAC → update `NodeExecution` → upsert `NodeResult` → check if all nodes settled
6. Frontend: polling `/api/workflow/execute/[runId]` every 1.5s → update Zustand → re-render nodes with outputs

---

## Transloadit Integration

### Browser Upload (Uppy) — Upload Image Node & Upload Video Node
```typescript
// lib/transloadit/uppy-config.ts
import Uppy from '@uppy/core'
import Transloadit from '@uppy/transloadit'

export function createImageUppy() {
  return new Uppy({
    restrictions: {
      allowedFileTypes: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      maxFileSize: 50 * 1024 * 1024,
    },
  }).use(Transloadit, {
    assemblyOptions: async () => {
      const { signature, params } = await fetchSignature('image')
      return { params, signature }
    },
  })
}

export function createVideoUppy() {
  return new Uppy({
    restrictions: {
      allowedFileTypes: ['.mp4', '.mov', '.webm', '.m4v'],
      maxFileSize: 200 * 1024 * 1024,
    },
  }).use(Transloadit, {
    assemblyOptions: async () => {
      const { signature, params } = await fetchSignature('video')
      return { params, signature }
    },
  })
}

async function fetchSignature(type: 'image' | 'video') {
  const res = await fetch('/api/transloadit/signature', {
    method: 'POST',
    body: JSON.stringify({ type }),
    headers: { 'Content-Type': 'application/json' },
  })
  return res.json()
}
```

### Signature API Route (Protects authSecret)
```typescript
// app/api/transloadit/signature/route.ts
import { auth } from '@clerk/nextjs/server'
import { createHmac } from 'crypto'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const { type } = await req.json()

  const params = JSON.stringify({
    auth: {
      key: process.env.TRANSLOADIT_KEY,
      expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    },
    template_id: type === 'video'
      ? process.env.VIDEO_TEMPLATE_ID
      : process.env.IMAGE_TEMPLATE_ID,
  })

  const signature = `sha384:${createHmac('sha384', process.env.TRANSLOADIT_SECRET!)
    .update(Buffer.from(params, 'utf-8'))
    .digest('hex')}`

  return Response.json({ signature, params: JSON.parse(params) })
}
```

### Transloadit Template Settings
**Image template:** Reject non-image files ON, Reject malware ON. Nothing else.

**Video template:** Reject non-video files ON, Reject malware ON. All encoding/processing/thumbnail steps OFF — FFmpeg in Trigger.dev handles the only video processing needed.

---

## API Routes Reference

All routes are in `app/api/`. All protected by Clerk middleware via `middleware.ts` except the Trigger.dev webhook.

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/workflow` | GET | Clerk | List all workflows for userId |
| `/api/workflow` | POST | Clerk | Create new workflow |
| `/api/workflow/[id]` | GET | Clerk | Load workflow + latest NodeResults |
| `/api/workflow/[id]` | PUT | Clerk | Save/upsert nodes + edges |
| `/api/workflow/[id]` | DELETE | Clerk | Delete workflow + cascade |
| `/api/workflow/execute` | POST | Clerk | Create WorkflowRun + dispatch tasks |
| `/api/workflow/execute/[runId]` | GET | Clerk | Poll execution status |
| `/api/history` | GET | Clerk | Paginated WorkflowRun list |
| `/api/history/[runId]` | GET | Clerk | NodeExecution tree for a run |
| `/api/transloadit/signature` | POST | Clerk | Generate upload signature |
| `/api/trigger/webhook` | POST | HMAC | Trigger.dev task result callback |

### Every API route must follow this pattern:
```typescript
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { NextResponse } from 'next/server'

const requestSchema = z.object({ /* ... */ })

export async function POST(req: Request) {
  // 1. Auth check
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Parse + validate body
  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // 3. Business logic (call lib/ functions, never inline)
  // 4. Return typed response
}
```

---

## Zustand Stores

### workflowStore
```typescript
// stores/workflowStore.ts
interface WorkflowState {
  workflowId: string | null
  workflowName: string
  nodes: Node<NodeData>[]
  edges: Edge[]
  past: { nodes: Node<NodeData>[]; edges: Edge[] }[] // undo history
  future: { nodes: Node<NodeData>[]; edges: Edge[] }[] // redo history
  isDirty: boolean // unsaved changes

  // Actions
  setNodes: (nodes: Node<NodeData>[]) => void
  setEdges: (edges: Edge[]) => void
  addNode: (node: Node<NodeData>) => void
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void
  removeNode: (nodeId: string) => void
  undo: () => void
  redo: () => void
  loadWorkflow: (id: string, nodes: Node<NodeData>[], edges: Edge[]) => void
  markSaved: () => void
}
```

### executionStore
```typescript
// stores/executionStore.ts
interface ExecutionState {
  isRunning: boolean
  currentRunId: string | null
  nodeStatuses: Record<string, NodeStatus> // nodeId → status
  nodeOutputs: Record<string, NodeOutput>  // nodeId → output
  nodeErrors: Record<string, string>        // nodeId → error message

  // Actions
  startRun: (runId: string) => void
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void
  setNodeOutput: (nodeId: string, output: NodeOutput) => void
  setNodeError: (nodeId: string, error: string) => void
  finishRun: () => void
}
```

---

## Zod Schemas

```typescript
// lib/schemas/workflow.ts

export const executeWorkflowSchema = z.object({
  workflowId: z.string().cuid(),
  scope: z.enum(['full', 'partial', 'single']),
  selectedNodeIds: z.array(z.string()).optional(), // for partial/single
})

export const saveWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  nodes: z.array(z.any()), // React Flow nodes — validated deeper in lib/
  edges: z.array(z.any()), // React Flow edges
})

export const webhookPayloadSchema = z.object({
  runId: z.string().cuid(),
  nodeId: z.string(),
  status: z.enum(['success', 'failed']),
  output: z.any().optional(),
  error: z.string().optional(),
  executionMs: z.number().int().nonneg(),
})
```

---

## Prisma Client Singleton

```typescript
// lib/db/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Never** call `new PrismaClient()` anywhere else. Always import from `lib/db/prisma.ts`.

---

## Clerk Middleware

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher([
  '/workflow(.*)',
  '/api/workflow(.*)',
  '/api/history(.*)',
  '/api/transloadit(.*)',
])

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) auth().protect()
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
```

The `/api/trigger/webhook` route is intentionally excluded — it uses HMAC signature verification instead of Clerk JWT.

---

## Tailwind Design Tokens (Krea.ai)

Extract exact values from Krea.ai using DevTools before defining these. These are placeholders — replace with actual extracted values:

```typescript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      'canvas-bg': '#0d0d0d',        // Main canvas background
      'node-bg': '#1a1a1a',          // Node card background
      'node-border': '#2a2a2a',      // Node card border
      'node-border-hover': '#3a3a3a',
      'sidebar-bg': '#111111',       // Both sidebars
      'accent-purple': '#7c3aed',    // Primary accent — edges, handles
      'handle-text': '#4a90d9',      // Text handle dot color
      'handle-image': '#48bb78',     // Image handle dot color
      'handle-video': '#ed8936',     // Video handle dot color
      'handle-number': '#9f7aea',    // Number handle dot color
    },
    boxShadow: {
      'node': '0 4px 24px rgba(0,0,0,0.4)',
      'node-hover': '0 8px 32px rgba(0,0,0,0.5)',
      'glow-purple': '0 0 20px rgba(124,58,237,0.6)',  // LLM node running state
    },
    keyframes: {
      'glow-pulse': {
        '0%, 100%': { boxShadow: '0 0 8px rgba(124,58,237,0.4)' },
        '50%': { boxShadow: '0 0 24px rgba(124,58,237,0.9)' },
      },
    },
    animation: {
      'glow-pulse': 'glow-pulse 1.5s ease-in-out infinite',
    },
  },
}
```

---

## ShadCN Components to Install

```bash
npx shadcn@latest add button input textarea select dialog tooltip badge \
  scroll-area separator dropdown-menu skeleton sonner
```

Use `sonner` for toast notifications (replaces the older `toast` component).

---

## React Flow Configuration

```typescript
// components/canvas/WorkflowCanvas.tsx

const isValidConnection = useCallback((connection: Connection): boolean => {
  // Get source and target handle types from node data
  // Return false for any blocked type combination
  // See type-safe connection rules table above
}, [nodes])

<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  isValidConnection={isValidConnection}
  nodeTypes={nodeTypes}          // Register all 6 custom node components
  edgeTypes={edgeTypes}          // Animated purple edge component
  connectionLineStyle={{ stroke: '#7c3aed', strokeWidth: 2 }}
  defaultEdgeOptions={{ animated: true, style: { stroke: '#7c3aed' } }}
>
  <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a2a2a" />
  <MiniMap position="bottom-right" />
  <Controls position="bottom-left" />
</ReactFlow>
```

---

## Workflow History Panel

The right sidebar shows all `WorkflowRun` records for the current user. Each entry displays:
- Run number + timestamp
- Scope badge: `Full` / `Partial` / `Single`
- Status badge: green = success, red = failed, yellow = running
- Duration in ms

Clicking a run expands a tree view showing each `NodeExecution`:
```
Run #123 — Jan 14, 2026 3:45 PM (Full Workflow)
├── Text Node (node-1)  ✓  0.1s
│   └── Output: "Generate a product description..."
├── Upload Image (node-2)  ✓  2.3s
│   └── Output: https://cdn.transloadit.com/...
├── Crop Image (node-3)  ✓  1.8s
│   └── Output: https://cdn.transloadit.com/...
├── LLM Node (node-4)  ✓  4.2s
│   └── Output: "Introducing our premium..."
└── Extract Frame (node-5)  ✗  Failed
    └── Error: "Invalid timestamp parameter"
```

---

## Required Sample Workflow — Product Marketing Kit Generator

This workflow must be pre-seeded in the database and automatically available for new users. It demonstrates all 6 node types and parallel execution.

### Branch A (runs concurrently with Branch B)
1. Upload Image Node → user uploads product photo
2. Crop Image Node → center crop at 80% width/height
3. Text Node #1 (system prompt) → "You are a professional marketing copywriter..."
4. Text Node #2 (product details) → "Product: Wireless Bluetooth Headphones..."
5. LLM Node #1 → receives crop output + both text nodes → outputs product description

### Branch B (runs concurrently with Branch A)
1. Upload Video Node → user uploads product demo video
2. Extract Frame Node → timestamp "50%" → outputs frame image

### Convergence Point
LLM Node #2 → waits for BOTH branches → receives:
- `system_prompt` ← Text Node #3 ("You are a social media manager...")
- `user_message` ← LLM Node #1 output (product description)
- `images` ← Crop Image Node (Branch A) + Extract Frame Node (Branch B)
- Outputs: final marketing tweet/post displayed inline

---

## Testing Requirements

### Before Any Commit
```bash
npx tsc --noEmit    # Must pass with zero errors
npx eslint .        # Must pass with zero errors
```

### Before Deployment
All P0 tests must pass on the production URL:

| Test | Expected |
|---|---|
| All 6 node types add to canvas | Render correctly with handles |
| Text → LLM system_prompt connection | Edge animates, manual input greys out |
| Image → system_prompt (invalid) | Connection rejected, red feedback |
| Full workflow end-to-end | All nodes execute, LLM result inline |
| Save → reload → restore | Canvas restores with outputs |
| Cycle attempt | Connection rejected |
| Parallel branch timing | Branches A and B dispatch simultaneously |
| Upload image (Transloadit) | Preview shows, CDN URL in node |
| Upload video (Transloadit) | Video player shows, CDN URL in node |
| Crop image | Cropped CDN URL returned |
| Extract frame at "50%" | Frame CDN URL returned |
| Task failure | Error on node, history shows failed |

---

## Common Mistakes to Avoid

1. **Never call Gemini API from a Next.js API route** — only inside Trigger.dev tasks
2. **Never upload files through the Next.js server** — browser → Transloadit directly
3. **Never use `new PrismaClient()` in route handlers** — import the singleton
4. **Never expose `GEMINI_API_KEY` or `TRANSLOADIT_SECRET` to the browser**
5. **Never skip the v0.dev review gate** — always type + document before committing
6. **Never allow `as any`** — fix the types
7. **Never create a separate output node for LLM results** — display inline on the LLM node
8. **Never render all workflow history in one query** — paginate WorkflowRun list
9. **Always verify Trigger.dev webhook HMAC signature** before processing
10. **Always scope every DB query to `userId`** — never query without user scoping

---

## Quick Commands

```bash
# Development
npm run dev

# Type check
npx tsc --noEmit

# Lint
npx eslint .

# Database
npx prisma migrate dev --name <migration-name>
npx prisma generate
npx prisma studio

# Trigger.dev (local dev)
npx trigger.dev@latest dev

# Production DB migration
npx prisma migrate deploy
```

---

*Last updated: March 2026 — NextFlow v1.0*