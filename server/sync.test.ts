import { describe, expect, it, vi } from 'vitest'
import { blobStore, handleSync, storeFromEnv, type LogStore } from './sync'

const blob = vi.hoisted(() => ({ stored: null as string | null, etag: 'e1', puts: [] as unknown[] }))
vi.mock('@vercel/blob', () => {
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobPreconditionFailedError,
    get: vi.fn(async () =>
      blob.stored == null
        ? null
        : { statusCode: 200, stream: new Response(blob.stored).body, blob: { etag: blob.etag } },
    ),
    put: vi.fn(async (_path: string, body: string, opts: { ifMatch?: string }) => {
      blob.puts.push(opts)
      if (opts.ifMatch && opts.ifMatch !== blob.etag) throw new BlobPreconditionFailedError()
      blob.stored = body
      blob.etag = `e${Number(blob.etag.slice(1)) + 1}`
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
      expect(blob.puts.at(-1)).toMatchObject({ access: 'private', addRandomSuffix: false, allowOverwrite: true })
      expect(JSON.parse(blob.stored!)).toEqual({ '2026-10-13': { updatedAt: 2 } })
      // A second write is conditional on the version just read.
      await handleSync('POST', 'k', { log: { '2026-10-14': { updatedAt: 3 } } })
      expect(blob.puts.at(-1)).toMatchObject({ ifMatch: 'e2' })
      expect(Object.keys(JSON.parse(blob.stored!))).toEqual(['2026-10-13', '2026-10-14'])
    } finally {
      delete process.env.BLOB_READ_WRITE_TOKEN
      delete process.env.SYNC_KEY
    }
  })

  it('reports a write conflict as false', async () => {
    const store = blobStore('t')
    expect(await store.write({}, 'stale')).toBe(false)
  })

  it('re-merges when another device wrote in between', async () => {
    let held: Record<string, { updatedAt: number }> = { a: { updatedAt: 1 } }
    let version = 1
    let raced = false
    const store: LogStore = {
      read: async () => ({ log: held, version: String(version) }),
      write: async (log, v) => {
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
      expect(Object.keys(held).sort()).toEqual(['2026-10-15', '2026-10-16', 'a'])
    } finally {
      delete process.env.SYNC_KEY
    }
  })
})
