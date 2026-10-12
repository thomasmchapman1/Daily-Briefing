// Cloud sync for the fitness log, so it survives a cleared browser and follows you
// between phone and laptop. Optional: without the environment below the app keeps
// everything on the device.
//
// The log is one JSON document, kept in whichever store the project has:
//   Vercel Blob (preferred)  BLOB_READ_WRITE_TOKEN, set by Storage → Create → Blob → Connect.
//                            Stored as a private blob, so it can't be read by URL.
//   Upstash Redis            KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN).
// And always:
//   SYNC_KEY                 a passphrase you also type into the app's settings
//
// GET  → { log }                  the whole log
// POST { log } → { log }          merges the days you send (newer updatedAt wins), returns the result
import { createHash, timingSafeEqual } from 'node:crypto'
import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import { isDatedLog, mergeLogs, type DatedLog } from '../src/fitness/merge.js'

export interface SyncResult {
  status: number
  json: unknown
}

/** Where the log lives. `version` lets a write fail if someone else wrote in between. */
export interface LogStore {
  read(): Promise<{ log: DatedLog; version: string | null }>
  /** Returns false if the stored log changed since `version` was read. */
  write(log: DatedLog, version: string | null): Promise<boolean>
}

const BLOB_PATH = 'training/log.json'
const REDIS_KEY = 'fitness:log'

const parse = (raw: string): DatedLog => {
  const parsed = JSON.parse(raw)
  return isDatedLog(parsed) ? parsed : {}
}

export function blobStore(token: string): LogStore {
  return {
    async read() {
      const res = await get(BLOB_PATH, { access: 'private', useCache: false, token })
      if (!res || res.statusCode !== 200) return { log: {}, version: null }
      return { log: parse(await new Response(res.stream).text()), version: res.blob.etag }
    },
    async write(log, version) {
      try {
        await put(BLOB_PATH, JSON.stringify(log), {
          access: 'private',
          token,
          contentType: 'application/json',
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 60,
          ...(version ? { ifMatch: version } : {}),
        })
        return true
      } catch (err) {
        if (err instanceof BlobPreconditionFailedError) return false
        throw err
      }
    },
  }
}

export function redisStore(url: string, token: string): LogStore {
  const redis = async (command: string[]): Promise<unknown> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    })
    const json = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string }
    if (!res.ok || json.error) throw new Error(`Redis error: ${json.error ?? res.status}`)
    return json.result
  }
  return {
    async read() {
      const raw = await redis(['GET', REDIS_KEY])
      return { log: typeof raw === 'string' ? parse(raw) : {}, version: null }
    },
    async write(log) {
      await redis(['SET', REDIS_KEY, JSON.stringify(log)])
      return true
    },
  }
}

export function storeFromEnv(): LogStore | null {
  const env = process.env
  if (env.BLOB_READ_WRITE_TOKEN) return blobStore(env.BLOB_READ_WRITE_TOKEN)
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? redisStore(url, token) : null
}

const digest = (s: string) => createHash('sha256').update(s).digest()

function keyMatches(given: string | undefined, expected: string): boolean {
  return given != null && timingSafeEqual(digest(given), digest(expected))
}

export async function handleSync(method: string, key: string | undefined, body: unknown, store = storeFromEnv()): Promise<SyncResult> {
  const syncKey = process.env.SYNC_KEY
  if (!store || !syncKey) {
    return { status: 503, json: { error: 'Cloud sync isn’t set up. Connect a Blob store and add SYNC_KEY in Vercel, then redeploy.' } }
  }
  if (!keyMatches(key, syncKey)) return { status: 401, json: { error: 'Wrong sync passcode' } }

  if (method === 'GET') return { status: 200, json: { log: (await store.read()).log } }
  if (method !== 'POST') return { status: 405, json: { error: 'Method not allowed' } }

  const incoming = (body as { log?: unknown } | null)?.log
  if (!isDatedLog(incoming)) return { status: 400, json: { error: 'Expected { log }' } }

  // Read, merge, write; if another device wrote in between, merge again on top of that.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { log, version } = await store.read()
    const merged = mergeLogs(log, incoming)
    if (await store.write(merged, version)) return { status: 200, json: { log: merged } }
  }
  return { status: 409, json: { error: 'Another device was syncing at the same time. Try again.' } }
}
