import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { callback, login, seal, stripHtml, toEvents, unseal } from './google'
import type { ApiRequest } from './http'

const key = createHash('sha256').update('test-secret-test-secret').digest()
const req = (query: Record<string, string> = {}, cookies: Record<string, string> = {}): ApiRequest => ({
  method: 'GET',
  query: new URLSearchParams(query),
  cookies,
  origin: 'https://briefing.example',
})

describe('session cookie', () => {
  it('round-trips and rejects tampering or the wrong key', () => {
    const sealed = seal('1//refresh-token', key)
    expect(unseal(sealed, key)).toBe('1//refresh-token')
    expect(unseal(sealed.slice(0, -2) + 'AA', key)).toBeNull()
    expect(unseal(sealed, createHash('sha256').update('other').digest())).toBeNull()
  })
})

describe('toEvents', () => {
  const date = '2026-10-12'
  it('maps timed and all-day events, dropping cancelled, declined and other days', () => {
    const events = toEvents(
      [
        { summary: 'Standup', start: { dateTime: '2026-10-12T09:30:00-04:00' }, end: { dateTime: '2026-10-12T09:45:00-04:00' }, location: 'Zoom' },
        { summary: 'Holiday', start: { date: '2026-10-12' }, end: { date: '2026-10-13' } },
        { summary: 'Yesterday all day', start: { date: '2026-10-11' }, end: { date: '2026-10-12' } },
        { summary: 'Cancelled', status: 'cancelled', start: { dateTime: '2026-10-12T10:00:00Z' } },
        { summary: 'Declined', start: { dateTime: '2026-10-12T11:00:00Z' }, attendees: [{ self: true, responseStatus: 'declined' }] },
        { summary: 'Notes', start: { dateTime: '2026-10-12T15:00:00Z' }, description: 'Bring <b>the</b> book<br>Room&nbsp;4' },
      ],
      date,
    )
    expect(events.map((e) => e.title)).toEqual(['Standup', 'Holiday', 'Notes'])
    expect(events[0]).toMatchObject({ start: '2026-10-12T13:30:00.000Z', allDay: false, location: 'Zoom' })
    expect(events[1]).toMatchObject({ allDay: true, start: null })
    expect(events[2].notes).toBe('Bring the book\nRoom 4')
  })

  it('strips HTML', () => {
    expect(stripHtml('<p>One</p><p>Two &amp; three</p>')).toBe('One\nTwo & three\n')
  })
})

describe('OAuth handlers', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
    process.env.SESSION_SECRET = 'test-secret-test-secret'
  })
  afterEach(() => {
    process.env = { ...env }
  })

  it('sends the user to Google with read-only scope, offline access and a state cookie', async () => {
    const res = await login(req())
    const url = new URL(res.redirect!)
    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.readonly')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('redirect_uri')).toBe('https://briefing.example/api/google/callback')
    expect(res.cookies?.[0]).toContain(`g_state=${url.searchParams.get('state')}`)
    expect(res.cookies?.[0]).toContain('HttpOnly')
  })

  it('rejects a callback whose state does not match', async () => {
    const res = await callback(req({ code: 'x', state: 'abc' }, { g_state: 'xyz' }))
    expect(res.redirect).toBe('/?google=failed')
  })

  it('reports cancelled sign-in', async () => {
    expect((await callback(req({ error: 'access_denied' }))).redirect).toBe('/?google=cancelled')
  })

  it('explains missing configuration', async () => {
    delete process.env.GOOGLE_CLIENT_ID
    await expect(login(req())).rejects.toThrow(/GOOGLE_CLIENT_ID/)
  })
})
