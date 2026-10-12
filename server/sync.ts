// Cloud sync for the fitness log, so it survives a cleared browser and follows you
// between phone and laptop. Optional: without the environment below the app keeps
// everything on the device.
//
// Storage is one JSON document in Upstash Redis, over its REST API (no client library).
// Environment (set in Vercel; adding Upstash Redis from Vercel's Storage tab sets the first two):
//   KV_REST_API_URL, KV_REST_API_TOKEN   (or UPSTASH_REDIS_REST_URL / _TOKEN)
//   SYNC_KEY                             a passphrase you also type into the app's settings
//
// GET  → { log }                  the whole log
// POST { log } → { log }          merges the days you send (newer updatedAt wins), returns the result
import { createHash, timingSafeEqual } from 'node:crypto'
import { isDatedLog, mergeLogs, type DatedLog } from '../src/fitness/merge.js'

const KEY = 'fitness:log'

export interface SyncResult {
  status: number
  json: unknown
}

function env() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  const syncKey = process.env.SYNC_KEY
  return { url, token, syncKey }
}

const digest = (s: string) => createHash('sha256').update(s).digest()

function keyMatches(given: string | undefined, expected: string): boolean {
  return given != null && timingSafeEqual(digest(given), digest(expected))
}

async function redis(url: string, token: string, command: string[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  })
  const json = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string }
  if (!res.ok || json.error) throw new Error(`Redis error: ${json.error ?? res.status}`)
  return json.result
}

async function readLog(url: string, token: string): Promise<DatedLog> {
  const raw = await redis(url, token, ['GET', KEY])
  if (typeof raw !== 'string') return {}
  const parsed = JSON.parse(raw)
  return isDatedLog(parsed) ? parsed : {}
}

export async function handleSync(method: string, key: string | undefined, body: unknown): Promise<SyncResult> {
  const { url, token, syncKey } = env()
  if (!url || !token || !syncKey) {
    return { status: 503, json: { error: 'Cloud sync isn’t set up. Add Upstash Redis and SYNC_KEY in Vercel, then redeploy.' } }
  }
  if (!keyMatches(key, syncKey)) return { status: 401, json: { error: 'Wrong sync passcode' } }

  if (method === 'GET') return { status: 200, json: { log: await readLog(url, token) } }
  if (method !== 'POST') return { status: 405, json: { error: 'Method not allowed' } }

  const incoming = (body as { log?: unknown } | null)?.log
  if (!isDatedLog(incoming)) return { status: 400, json: { error: 'Expected { log }' } }
  const merged = mergeLogs(await readLog(url, token), incoming)
  await redis(url, token, ['SET', KEY, JSON.stringify(merged)])
  return { status: 200, json: { log: merged } }
}
