import { describe, expect, it, vi } from 'vitest'
import { blobStore, handleSync, storeFromEnv, type LogStore } from './sync'

// A fake Blob store: one document per path, each with its own ETag.
const blob = vi.hoisted(() => ({ docs: {} as Record<string, { body: string; etag: string }>, n: 1, puts: [] as unknown[] }))
vi.mock('@vercel/blob', () => {
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobPreconditionFailedError,
    get: vi.fn(async (path: string) => {
      const doc = blob.docs[path]
      return doc ? { statusCode: 200, stream: new Response(doc.body).body, blob: { etag: doc.etag } } : null
    }),
    put: vi.fn(async (path: string, body: string, opts: { ifMatch?: string }) => {
      blob.puts.push({ path, ...opts })
      if (opts.ifMatch && opts.ifMatch !== blob.docs[path]?.etag) throw new BlobPreconditionFailedError()
      blob.docs[path] = { body, etag: `e${++blob.n}` }
      return {}
    }),
  }
})

describe('sync endpoint', () => {
  it('is off without its environment and checks the passcode', async () => {
    expect((await handleSync('GET', 'x', null)).status).toBe(503)
    process.env.KV_REST_API_URL = 'https://example.invalid'
    process.env.KV_REST_API_TOKEN = 't'
    process.env.SYNC_KEY = 'correct horse'
    try {
      expect((await handleSync('GET', 'wrong', null)).status).toBe(401)
      expect((await handleSync('POST', 'correct horse', { log: 'nope' })).status).toBe(400)
    } finally {
      delete process.env.KV_REST_API_URL
      delete process.env.KV_REST_API_TOKEN
      delete process.env.SYNC_KEY
    }
  })
})

describe('sync merge', () => {
  it('merges what the device sends into what the cloud holds, newer day wins', async () => {
    let stored: string | null = JSON.stringify({ '2026-10-12': { body: { weight: 195 }, updatedAt: 5 } })
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (_url: string, init: { body: string }) => {
      const [cmd, , value] = JSON.parse(init.body)
      if (cmd === 'SET') stored = value
      return new Response(JSON.stringify({ result: cmd === 'GET' ? stored : 'OK' }))
    }) as unknown as typeof fetch
    Object.assign(process.env, { KV_REST_API_URL: 'https://redis.test', KV_REST_API_TOKEN: 't', SYNC_KEY: 'k' })
    try {
      const out = await handleSync('POST', 'k', {
        log: { '2026-10-12': { body: { weight: 194 }, updatedAt: 3 }, '2026-10-13': { body: { weight: 194.5 }, updatedAt: 9 } },
      })
      expect(out.status).toBe(200)
      expect(JSON.parse(stored!)).toEqual({
        '2026-10-12': { body: { weight: 195 }, updatedAt: 5 },
        '2026-10-13': { body: { weight: 194.5 }, updatedAt: 9 },
      })
    } finally {
      globalThis.fetch = realFetch
      delete process.env.KV_REST_API_URL
      delete process.env.KV_REST_API_TOKEN
      delete process.env.SYNC_KEY
    }
  })
})

describe('sync with Vercel Blob', () => {
  it('is chosen when the Blob token is set, and keeps the log private', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_x'
    process.env.SYNC_KEY = 'k'
    try {
      expect(storeFromEnv()).not.toBeNull()
      const out = await handleSync('POST', 'k', { log: { '2026-10-13': { updatedAt: 2 } } })
      expect(out.status).toBe(200)
      expect(blob.puts.at(-1)).toMatchObject({ path: 'training/log.json', access: 'private', addRandomSuffix: false, allowOverwrite: true })
      expect(JSON.parse(blob.docs['training/log.json'].body)).toEqual({ '2026-10-13': { updatedAt: 2 } })
      // A second write is conditional on the version just read.
      const etag = blob.docs['training/log.json'].etag
      await handleSync('POST', 'k', { log: { '2026-10-14': { updatedAt: 3 } } })
      expect(blob.puts.at(-1)).toMatchObject({ ifMatch: etag })
      expect(Object.keys(JSON.parse(blob.docs['training/log.json'].body))).toEqual(['2026-10-13', '2026-10-14'])
    } finally {
      delete process.env.BLOB_READ_WRITE_TOKEN
      delete process.env.SYNC_KEY
    }
  })

  it('uses the deployment’s Vercel login when only BLOB_STORE_ID is set', async () => {
    process.env.BLOB_STORE_ID = 'store_abc'
    try {
      expect(storeFromEnv()).not.toBeNull()
      await blobStore().write('log', {}, null)
      expect(blob.puts.at(-1)).not.toHaveProperty('token')
    } finally {
      delete process.env.BLOB_STORE_ID
    }
  })

  it('reports a write conflict as false', async () => {
    const store = blobStore('t')
    expect(await store.write('log', {}, 'stale')).toBe(false)
  })

  it('re-merges when another device wrote in between', async () => {
    let held: Record<string, unknown> = { '2026-10-01': { updatedAt: 1 } }
    let version = 1
    let raced = false
    const store: LogStore = {
      read: async (doc) => (doc === 'log' ? { data: held, version: String(version) } : { data: {}, version: null }),
      write: async (doc, log, v) => {
        if (doc !== 'log') return true
        if (!raced) {
          // Another device lands a day between our read and our write.
          raced = true
          held = { ...held, '2026-10-15': { updatedAt: 5 } }
          version++
        }
        if (v !== String(version)) return false
        held = log
        version++
        return true
      },
    }
    process.env.SYNC_KEY = 'k'
    try {
      const out = await handleSync('POST', 'k', { log: { '2026-10-16': { updatedAt: 6 } } }, store)
      expect(out.status).toBe(200)
      expect(Object.keys(held).sort()).toEqual(['2026-10-01', '2026-10-15', '2026-10-16'])
    } finally {
      delete process.env.SYNC_KEY
    }
  })
})

describe('Garmin weeks', () => {
  const week = (weekStart: string, miles: number, importedAt = 1) => ({ weekStart, runs: 1, miles, seconds: 2276, restingHr: 70, importedAt })

  it('stores imported weeks beside the log, and importing a week again replaces it', async () => {
    process.env.BLOB_STORE_ID = 'store_abc'
    process.env.SYNC_KEY = 'k'
    try {
      await handleSync('POST', 'k', { garmin: [week('2026-09-28', 4.01), week('2026-10-05', 3)] })
      const again = await handleSync('POST', 'k', { garmin: [week('2026-10-05', 6.2, 2)] })
      expect(again.status).toBe(200)
      const garmin = (again.json as { garmin: Record<string, { miles: number }> }).garmin
      expect(Object.keys(garmin).sort()).toEqual(['2026-09-28', '2026-10-05'])
      expect(garmin['2026-10-05'].miles).toBe(6.2)
      // The daily log is untouched by a Garmin import.
      const got = await handleSync('GET', 'k', null)
      expect((got.json as { log: object }).log).not.toHaveProperty('2026-10-05')
    } finally {
      delete process.env.BLOB_STORE_ID
      delete process.env.SYNC_KEY
    }
  })

  it('rejects weeks that aren’t in the expected shape', async () => {
    process.env.BLOB_STORE_ID = 'store_abc'
    process.env.SYNC_KEY = 'k'
    try {
      expect((await handleSync('POST', 'k', { garmin: [{ weekStart: 'Oct 5', miles: 3 }] })).status).toBe(400)
      expect((await handleSync('POST', 'k', {})).status).toBe(400)
    } finally {
      delete process.env.BLOB_STORE_ID
      delete process.env.SYNC_KEY
    }
  })
})
