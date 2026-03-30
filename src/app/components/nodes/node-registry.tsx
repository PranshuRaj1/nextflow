'use client'

import type { NodeTypes } from '@xyflow/react'
import { CropImageNode } from '@/app/components/nodes/crop-image-node'
import { ExtractFrameNode } from '@/app/components/nodes/extract-frame-node'
import { LlmNode } from '@/app/components/nodes/llm-node'
import { TextNode } from '@/app/components/nodes/text-node'
import { UploadImageNode } from '@/app/components/nodes/upload-image-node'
import { UploadVideoNode } from '@/app/components/nodes/upload-video-node'

/** Stable reference for React Flow — avoids unnecessary re-renders. */
export const workflowNodeTypes = {
  text: TextNode,
  uploadImage: UploadImageNode,
  uploadVideo: UploadVideoNode,
  llm: LlmNode,
  cropImage: CropImageNode,
  extractFrame: ExtractFrameNode,
} satisfies NodeTypes
