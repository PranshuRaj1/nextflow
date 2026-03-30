/**
 * Transloadit browser-side upload helpers.
 *
 * Flow:
 *   1. Fetch signed params from /api/transloadit/params   (no file involved)
 *   2. POST file + params directly to Transloadit from the browser
 *   3. Poll the returned assembly URL until COMPLETED or FAILED
 *   4. Return the CDN ssl_url for the first result in the "optimise" step,
 *      falling back to the ":original" step if no optimise result exists.
 */

const TRANSLOADIT_API = 'https://api2.transloadit.com'
const POLL_INTERVAL_MS = 1_500
const POLL_TIMEOUT_MS = 120_000

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type UploadKind = 'image' | 'video'

export interface UploadResult {
  cdnUrl: string
  assemblyId: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload a single file through Transloadit from the browser.
 *
 * @param file   - The File object selected by the user.
 * @param kind   - `'image'` or `'video'` (controls which assembly template is applied).
 * @param signal - Optional AbortSignal for cancellation.
 * @returns      A stable HTTPS CDN URL once the assembly completes.
 * @throws       On network failure, Transloadit error, or timeout.
 */
export async function transloaditUpload(
  file: File,
  kind: UploadKind,
  signal?: AbortSignal,
): Promise<UploadResult> {
  // Step 1 – obtain signed params from our server (secret stays server-side)
  const { params, signature } = await fetchSignedParams(kind, signal)

  // Step 2 – POST file directly to Transloadit from the browser
  const assemblyUrl = await createAssembly(file, params, signature, signal)

  // Step 3 – poll until done
  const cdnUrl = await pollAssembly(assemblyUrl, signal)

  // Extract assembly ID from URL for diagnostics
  const assemblyId = assemblyUrl.split('/assemblies/')[1]?.split('?')[0] ?? ''

  return { cdnUrl, assemblyId }
}

// ---------------------------------------------------------------------------
// Internal – fetch signed params
// ---------------------------------------------------------------------------

interface SignedParams {
  params: string
  signature: string
}

async function fetchSignedParams(
  kind: UploadKind,
  signal?: AbortSignal,
): Promise<SignedParams> {
  const res = await fetch('/api/transloadit/params', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Failed to get Transloadit params: ${text}`)
  }

  return res.json() as Promise<SignedParams>
}

// ---------------------------------------------------------------------------
// Internal – create assembly (POST file directly to Transloadit)
// ---------------------------------------------------------------------------

async function createAssembly(
  file: File,
  params: string,
  signature: string,
  signal?: AbortSignal,
): Promise<string> {
  const form = new FormData()
  form.append('params', params)
  form.append('signature', signature)
  form.append('file', file, file.name)

  const res = await fetch(`${TRANSLOADIT_API}/assemblies`, {
    method: 'POST',
    body: form,
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Transloadit assembly creation failed: ${text}`)
  }

  const data = (await res.json()) as {
    assembly_ssl_url?: string
    error?: string
    message?: string
  }

  if (data.error) {
    throw new Error(
      `Transloadit error: ${data.error} — ${data.message ?? ''}`.trim(),
    )
  }

  if (!data.assembly_ssl_url) {
    throw new Error('Transloadit did not return an assembly URL.')
  }

  return data.assembly_ssl_url
}

// ---------------------------------------------------------------------------
// Internal – poll assembly until completion
// ---------------------------------------------------------------------------

type AssemblyStatus =
  | 'ASSEMBLY_UPLOADING'
  | 'ASSEMBLY_EXECUTING'
  | 'ASSEMBLY_COMPLETED'
  | 'ASSEMBLY_FAILED'
  | string

interface AssemblyResponse {
  ok: AssemblyStatus
  error?: string
  message?: string
  results?: Record<
    string,
    Array<{ ssl_url: string; url: string; name: string }>
  >
}

async function pollAssembly(
  assemblyUrl: string,
  signal?: AbortSignal,
): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError')

    await sleep(POLL_INTERVAL_MS)

    const res = await fetch(assemblyUrl, { signal })
    if (!res.ok) continue // transient network hiccup — retry

    const data = (await res.json()) as AssemblyResponse

    if (data.ok === 'ASSEMBLY_COMPLETED') {
      return extractCdnUrl(data)
    }

    if (data.ok === 'ASSEMBLY_FAILED') {
      throw new Error(
        `Transloadit assembly failed: ${data.error ?? ''} ${data.message ?? ''}`.trim(),
      )
    }

    // Still uploading / executing — keep polling
  }

  throw new Error('Transloadit upload timed out after 120 seconds.')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractCdnUrl(data: AssemblyResponse): string {
  const results = data.results ?? {}

  // Prefer the optimise step result; fall back to :original
  for (const key of ['optimise', ':original']) {
    const files = results[key]
    if (files && files.length > 0 && files[0]) {
      return files[0].ssl_url ?? files[0].url
    }
  }

  // Last resort: any result from any step
  for (const files of Object.values(results)) {
    if (files && files.length > 0 && files[0]) {
      return files[0].ssl_url ?? files[0].url
    }
  }

  throw new Error('Transloadit completed but returned no output files.')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
