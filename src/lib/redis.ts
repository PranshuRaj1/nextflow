// Upstash Redis client — single shared instance for the whole app.
// We use @upstash/redis (HTTP-based) — works in serverless, edge, and
// Trigger.dev workers with zero cold-start overhead.
 
import { Redis } from '@upstash/redis'
 
// Throws at startup if env vars are missing — better to fail loudly.
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error(
    'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN env vars. ' +
    'Create a free database at https://console.upstash.com'
  )
}
 
export const redis = Redis.fromEnv()
 
// ── Key helpers ───────────────────────────────────────────────────────────────
// Centralised so key format never drifts between writer and reader.
 
/** Stores the full workflow graph (waves, nodes, edges) for a run. TTL: 2h */
export const graphKey   = (runId: string) => `run:${runId}:graph`
 
/** Stores one node's resolved output. TTL: 2h */
export const outputKey  = (runId: string, nodeId: string) => `run:${runId}:output:${nodeId}`
 
/** Stores the set of node IDs that failed, as a JSON array. TTL: 2h */
export const failedKey  = (runId: string) => `run:${runId}:failed`
 
/** TTL in seconds for all run-scoped keys (2 hours is generous for any workflow) */
export const RUN_TTL    = 60 * 60 * 2