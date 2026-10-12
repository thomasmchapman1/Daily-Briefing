import { describe, expect, it } from 'vitest'
import { handleSync } from './sync'

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
