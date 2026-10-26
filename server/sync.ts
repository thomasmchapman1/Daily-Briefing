// Cloud sync for the fitness log, so it survives a cleared browser and follows you
// between phone and laptop. Optional: without the environment below the app keeps
// everything on the device.
//
// The log is one JSON document, kept in whichever store the project has:
//   Vercel Blob (preferred)  BLOB_STORE_ID, set by Storage → Create → Blob → Connect; the function
//                            signs in with the deployment's own Vercel identity (OIDC). Older
//                            stores set BLOB_READ_WRITE_TOKEN instead; either works.
//                            Stored as a private blob, so it can't be read by URL.
//   Upstash Redis            KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN).
// And always:
//   SYNC_KEY                 a passphrase you also type into the app's settings
//
// GET  → { log, garmin }
// POST { log?, garmin? } → { log, garmin }
//   log:    days from a device, merged by day (newer updatedAt wins)
//   garmin: GarminWeek[] from the weekly Garmin email import; a week replaces the same week
//           already stored, so importing twice never duplicates it
import { createHash, timingSafeEqual } from 'node:crypto'
import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import {
  isDatedLog,
  isGarminWeek,
  isGarminWeeks,
  mergeLogs,
  upsertGarminWeeks,
  type GarminWeek,
  type GarminWeeks,
} from '../src/fitness/merge.js'

export interface SyncResult {
  status: number
  json: unknown
}

/** The stored documents: the daily log and the Garmin weeks. */
export type Doc = 'log' | 'garmin'

/** Where the documents live. `version` lets a write fail if someone else wrote in between. */
export interface LogStore {
  read(doc: Doc): Promise<{ data: Record<string, unknown>; version: string | null }>
  /** Returns false if the stored document changed since `version` was read. */
  write(doc: Doc, data: Record<string, unknown>, version: string | null): Promise<boolean>
}

const blobPath = (doc: Doc) => `training/${doc}.json`
const redisKey = (doc: Doc) => `fitness:${doc}`

const parse = (raw: string): Record<string, unknown> => {
  const parsed = JSON.parse(raw)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

/** With no token, @vercel/blob signs in with the deployment's Vercel OIDC token and BLOB_STORE_ID. */
export function blobStore(token?: string): LogStore {
  const auth = token ? { token } : {}
  return {
    async read(doc) {
      const res = await get(blobPath(doc), { access: 'private', useCache: false, ...auth })
      if (!res || res.statusCode !== 200) return { data: {}, version: null }
      return { data: parse(await new Response(res.stream).text()), version: res.blob.etag }
    },
    async write(doc, data, version) {
      try {
        await put(blobPath(doc), JSON.stringify(data), {
          access: 'private',
          ...auth,
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
    async read(doc) {
      const raw = await redis(['GET', redisKey(doc)])
      return { data: typeof raw === 'string' ? parse(raw) : {}, version: null }
    },
    async write(doc, data) {
      await redis(['SET', redisKey(doc), JSON.stringify(data)])
      return true
    },
  }
}

export function storeFromEnv(): LogStore | null {
  const env = process.env
  if (env.BLOB_STORE_ID || env.BLOB_READ_WRITE_TOKEN) return blobStore(env.BLOB_READ_WRITE_TOKEN)
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

  const readLog = async () => {
    const { data, version } = await store.read('log')
    return { data: isDatedLog(data) ? data : {}, version }
  }
  const readGarmin = async () => {
    const { data, version } = await store.read('garmin')
    return { data: isGarminWeeks(data) ? data : ({} as GarminWeeks), version }
  }

  if (method === 'GET') return { status: 200, json: { log: (await readLog()).data, garmin: (await readGarmin()).data } }
  if (method !== 'POST') return { status: 405, json: { error: 'Method not allowed' } }

  const { log: incomingLog, garmin: incomingGarmin } = (body ?? {}) as { log?: unknown; garmin?: unknown }
  if (incomingLog === undefined && incomingGarmin === undefined) return { status: 400, json: { error: 'Expected { log } or { garmin }' } }
  if (incomingLog !== undefined && !isDatedLog(incomingLog)) return { status: 400, json: { error: 'log must map dates to days' } }
  if (incomingGarmin !== undefined && !(Array.isArray(incomingGarmin) && incomingGarmin.every(isGarminWeek))) {
    return { status: 400, json: { error: 'garmin must be a list of weeks' } }
  }

  // Read, merge, write; if another device wrote in between, merge again on top of that.
  async function save<T extends Record<string, unknown>>(doc: Doc, read: () => Promise<{ data: T; version: string | null }>, merge: (stored: T) => T) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, version } = await read()
      const merged = merge(data)
      if (await store!.write(doc, merged, version)) return merged
    }
    return null
  }

  const log = isDatedLog(incomingLog) ? await save('log', readLog, (stored) => mergeLogs(stored, incomingLog)) : (await readLog()).data
  const garmin = Array.isArray(incomingGarmin)
    ? await save('garmin', readGarmin, (stored) => upsertGarminWeeks(stored, incomingGarmin as GarminWeek[]))
    : (await readGarmin()).data
  if (!log || !garmin) return { status: 409, json: { error: 'Another device was syncing at the same time. Try again.' } }
  return { status: 200, json: { log, garmin } }
}
