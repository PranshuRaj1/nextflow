import { createHmac } from 'crypto'
import { NextResponse } from 'next/server'

/**
 * POST /api/transloadit/params
 *
 * Body: { kind: 'image' | 'video' }
 *
 * Returns signed Transloadit assembly params for the browser to POST directly.
 * The file never touches this Next.js process.
 *
 * Transloadit rules enforced here:
 *   - `/upload/handle` robot is ONLY valid on the `:original` step.
 *   - For images: a second `/image/optimize` step strips metadata.
 *   - For videos (Phase 3): only `:original` — no transcode needed yet.
 *
 * Signature format: `sha384:<hex>` as required by Transloadit.
 */
export async function POST(req: Request) {
  const key = process.env.TRANSLOADIT_KEY
  const secret = process.env.TRANSLOADIT_SECRET

  if (!key || !secret) {
    return NextResponse.json(
      { error: 'Transloadit credentials not configured on the server.' },
      { status: 500 },
    )
  }

  let kind: 'image' | 'video' = 'image'
  try {
    const body = (await req.json()) as { kind?: unknown }
    if (body.kind === 'video') kind = 'video'
  } catch {
    // default to image if body is missing / malformed
  }

  // 30-minute window — short enough to be secure, long enough for slow uploads.
  const expires = new Date(Date.now() + 30 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, '+00:00')

  const params = buildParams(kind, key, expires)
  const paramsJson = JSON.stringify(params)

  const signature =
    'sha384:' + createHmac('sha384', secret).update(paramsJson).digest('hex')

  return NextResponse.json({ params: paramsJson, signature })
}

// ---------------------------------------------------------------------------
// Assembly params builders
// ---------------------------------------------------------------------------

/** Image: accept the raw file + strip metadata with /image/optimize.
 *  The /upload/handle robot is implicit (":original" is reserved for it)
 *  and the optimise step reads from it via `use: ':original'`.
 */
function buildImageParams(key: string, expires: string) {
  return {
    auth: { key, expires },
    steps: {
      optimise: {
        robot: '/image/optimize',
        use: ':original',
        progressive: true,
        preserve_meta_data: false,
      },
    },
  }
}

/** Video (Phase 3): accept the raw file with no transcoding.
 *  Transloadit REQUIRES the /upload/handle robot to be named ':original'.
 *  The uploaded file URL will appear in the assembly's `uploads[]` array
 *  (not `results{}`), which our extractCdnUrl handles via fallback.
 */
function buildVideoParams(key: string, expires: string) {
  return {
    auth: { key, expires },
    steps: {
      ':original': { robot: '/upload/handle' },
    },
  }
}

function buildParams(kind: 'image' | 'video', key: string, expires: string) {
  return kind === 'image'
    ? buildImageParams(key, expires)
    : buildVideoParams(key, expires)
}
