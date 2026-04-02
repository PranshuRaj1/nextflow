'use client'

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, useCallback, useRef, useState } from 'react'
import { useWorkflowStore } from '@/stores/workflow-store'
import type { UploadImageNodeData } from '@/types/workflow'
import { SOURCE_HANDLE_ID } from '@/types/workflow'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { transloaditUpload } from '@/lib/transloadit/upload'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif'

/**
 * Upload Image node — browser → Transloadit CDN.
 *
 * On file pick:
 *   1. Validates extension client-side for fast feedback.
 *   2. Calls `transloaditUpload` which:
 *        • Fetches HMAC-signed params from /api/transloadit/params (server only).
 *        • POSTs the file directly from the browser to Transloadit (no Next body).
 *        • Polls until ASSEMBLY_COMPLETED, then resolves with the CDN ssl_url.
 *   3. Stores the stable HTTPS URL in node data (`imageUrl`).
 */
function UploadImageNodeInner(props: NodeProps<Node<UploadImageNodeData, 'uploadImage'>>) {
  const { id, data, selected } = props
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'polling'>('idle')

  const onFile = useCallback(
    async (file: File | null) => {
      if (!file) return

      const ok = /\.(jpe?g|png|webp|gif)$/i.test(file.name)
      if (!ok) {
        updateNodeData(id, { status: 'error', errorMessage: 'Use jpg, png, webp, or gif.' })
        return
      }

      // Cancel any previous in-flight upload
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      // Optimistic preview — show local blob while uploading
      const localUrl = URL.createObjectURL(file)
      updateNodeData(id, {
        imageUrl: localUrl,
        fileName: file.name,
        status: 'uploading',
        errorMessage: undefined,
      })
      setUploadProgress('polling')

      try {
        const { cdnUrl } = await transloaditUpload(file, 'image', ctrl.signal)

        // Replace blob with stable CDN URL
        URL.revokeObjectURL(localUrl)
        updateNodeData(id, {
          imageUrl: cdnUrl,
          status: 'idle',
          errorMessage: undefined,
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const msg = err instanceof Error ? err.message : 'Upload failed.'
        updateNodeData(id, { status: 'error', errorMessage: msg })
      } finally {
        setUploadProgress('idle')
      }
    },
    [id, updateNodeData],
  )

  const isUploading = data.status === 'uploading'

  return (
    <div
      className={cn(
        'min-w-[240px] max-w-[280px] rounded-xl border border-[var(--node-border)] bg-[var(--node-bg)] p-3 shadow-lg transition-shadow',
        selected && 'ring-1 ring-[var(--accent)]',
      )}
    >
      {/* Header */}
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
        Upload image
      </p>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />

      {/* Upload button */}
      <Button
        variant="outline"
        size="sm"
        type="button"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'mb-2 w-full border-dashed text-xs text-zinc-300 font-medium transition',
          isUploading
            ? 'cursor-not-allowed border-zinc-700 text-zinc-500'
            : 'border-zinc-600 hover:border-[var(--accent)] hover:text-white',
        )}
      >
        {isUploading ? (
          <span className="flex items-center justify-center gap-1.5">
            <Spinner />
            {uploadProgress === 'polling' ? 'Processing…' : 'Uploading…'}
          </span>
        ) : (
          'Choose file'
        )}
      </Button>

      {/* Error message */}
      {data.errorMessage ? (
        <p className="mb-1 text-xs text-red-400">{data.errorMessage}</p>
      ) : null}

      {/* Preview */}
      <div className="relative mt-1 aspect-video w-full overflow-hidden rounded-lg bg-zinc-900">
        {data.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- CDN URL (arbitrary domain; not using next/image to avoid remotePatterns config)
          <img
            src={data.imageUrl}
            alt={data.fileName ?? 'Image preview'}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-500">
            No preview
          </div>
        )}

        {/* Uploading overlay */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center">
              <Spinner size="lg" />
              <p className="mt-1 text-[10px] text-zinc-300">Uploading to CDN…</p>
            </div>
          </div>
        )}
      </div>

      {/* CDN URL badge */}
      {data.imageUrl && !isUploading && (
        <p className="mt-1 truncate text-[10px] text-zinc-500">
          {data.imageUrl.startsWith('https://') ? '✓ CDN URL ready' : data.fileName ?? ''}
        </p>
      )}

      <Handle
        id={SOURCE_HANDLE_ID}
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-[var(--handle-image)] !bg-zinc-950"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Utility: inline spinner (no extra dep)
// ---------------------------------------------------------------------------

function Spinner({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'h-5 w-5' : 'h-3 w-3'
  return (
    <svg
      className={cn(cls, 'animate-spin text-[var(--accent)]')}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

export const UploadImageNode = memo(UploadImageNodeInner)
