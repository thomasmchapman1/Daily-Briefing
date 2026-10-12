// Google Calendar, read-only, via OAuth.
//
// There's no database: after sign-in, the refresh token is encrypted with
// SESSION_SECRET and kept in an HttpOnly cookie scoped to /api/google. Each
// request exchanges it for a short-lived access token and reads the calendar.
//
// Environment (set in Vercel → Settings → Environment Variables):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  OAuth "Web application" client
//   SESSION_SECRET                          any long random string
//   GOOGLE_REDIRECT_URI (optional)          defaults to <origin>/api/google/callback
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { HttpError, cookie, runNode, type ApiRequest, type Handler } from './http.js'
import { clean, sortEvents, type CalendarEvent } from './icsEvents.js'

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const SESSION_COOKIE = 'g_session'
const STATE_COOKIE = 'g_state'
const SESSION_MAX_AGE = 400 * 24 * 3600 // the most browsers allow

function config(req: ApiRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const secret = process.env.SESSION_SECRET
  if (!clientId || !clientSecret || !secret || secret.length < 16) {
    throw new HttpError(
      500,
      'Google sign-in isn’t set up yet. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SESSION_SECRET (16+ characters) in the Vercel project, then redeploy.',
    )
  }
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${req.origin}/api/google/callback`
  return { clientId, clientSecret, redirectUri, key: createHash('sha256').update(secret).digest() }
}

// ---------- Encrypted session cookie ----------

export function seal(plain: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')
}

export function unseal(sealed: string, key: Buffer): string | null {
  try {
    const raw = Buffer.from(sealed, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

// ---------- Google APIs ----------

async function tokenRequest(params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    // invalid_grant: the token was revoked or expired; the user must reconnect.
    if (json.error === 'invalid_grant') throw new HttpError(401, 'Google Calendar needs reconnecting')
    throw new HttpError(502, `Google token error: ${String(json.error ?? res.status)}`)
  }
  return json
}

async function accessToken(req: ApiRequest): Promise<string> {
  const { clientId, clientSecret, key } = config(req)
  const sealed = req.cookies[SESSION_COOKIE]
  const refreshToken = sealed ? unseal(sealed, key) : null
  if (!refreshToken) throw new HttpError(401, 'Google Calendar isn’t connected')
  const json = await tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  return String(json.access_token)
}

async function calendarApi<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = `https://www.googleapis.com/calendar/v3${path}?${new URLSearchParams(params)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) throw new HttpError(401, 'Google Calendar needs reconnecting')
  if (!res.ok) throw new HttpError(502, `Google Calendar responded ${res.status}`)
  return (await res.json()) as T
}

interface GoogleEvent {
  status?: string
  summary?: string
  location?: string
  description?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
  attendees?: { self?: boolean; responseStatus?: string }[]
}

/** Google descriptions can contain HTML; keep the text. */
export function stripHtml(s: string | undefined): string | undefined {
  if (!s) return undefined
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
}

/** Map Google events to ours; drop cancelled, declined, and all-day events not on `date`. */
export function toEvents(items: GoogleEvent[], date: string): CalendarEvent[] {
  const out: CalendarEvent[] = []
  for (const e of items) {
    if (e.status === 'cancelled') continue
    if (e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) continue
    const allDay = Boolean(e.start?.date)
    if (allDay) {
      const start = e.start!.date!
      const end = e.end?.date ?? start
      if (!(start <= date && (date < end || start === date))) continue
    } else if (!e.start?.dateTime) continue
    out.push({
      title: clean(e.summary, 200) ?? '(No title)',
      start: allDay ? null : new Date(e.start!.dateTime!).toISOString(),
      end: allDay || !e.end?.dateTime ? null : new Date(e.end.dateTime).toISOString(),
      allDay,
      location: clean(e.location, 200),
      notes: clean(stripHtml(e.description)),
    })
  }
  return out
}

// ---------- Handlers ----------

/** GET /api/google/login → Google's consent screen. */
export const login: Handler = async (req) => {
  const { clientId, redirectUri } = config(req)
  const state = randomBytes(16).toString('base64url')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // always return a refresh token
    include_granted_scopes: 'true',
    state,
  })
  return {
    status: 302,
    redirect: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    cookies: [cookie(STATE_COOKIE, state, 600)],
  }
}

/** GET /api/google/callback?code&state → store the refresh token, back to the app. */
export const callback: Handler = async (req) => {
  const { clientId, clientSecret, redirectUri, key } = config(req)
  const back = (result: string) => ({
    status: 302,
    redirect: `/?google=${result}`,
    cookies: [cookie(STATE_COOKIE, '', 0)],
  })
  if (req.query.get('error')) return back('cancelled')
  const state = Buffer.from(req.query.get('state') ?? '')
  const expected = Buffer.from(req.cookies[STATE_COOKIE] ?? '')
  if (!state.length || state.length !== expected.length || !timingSafeEqual(state, expected)) {
    return back('failed')
  }
  const json = await tokenRequest({
    code: req.query.get('code') ?? '',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  if (typeof json.refresh_token !== 'string') return back('failed')
  const res = back('connected')
  res.cookies.push(cookie(SESSION_COOKIE, seal(json.refresh_token, key), SESSION_MAX_AGE))
  return res
}

/** GET /api/google/calendars → the user's calendars, or 401 when not connected. */
export const calendars: Handler = async (req) => {
  const token = await accessToken(req)
  const json = await calendarApi<{ items?: { id: string; summary?: string; summaryOverride?: string; primary?: boolean }[] }>(
    token,
    '/users/me/calendarList',
    { minAccessRole: 'reader', maxResults: '250' },
  )
  const items = (json.items ?? []).map((c) => ({ id: c.id, name: c.summaryOverride ?? c.summary ?? c.id, primary: Boolean(c.primary) }))
  return { status: 200, json: { calendars: items.sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name)) } }
}

/** GET /api/google/events?start&end&date&calendars=a,b → today's events across calendars. */
export const events: Handler = async (req) => {
  const start = req.query.get('start') ?? ''
  const end = req.query.get('end') ?? ''
  const date = req.query.get('date') ?? ''
  if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'Expected start, end and date')
  }
  const ids = (req.query.get('calendars') || 'primary').split(',').filter(Boolean).slice(0, 20)
  const token = await accessToken(req)
  const lists = await Promise.all(
    ids.map((id) =>
      calendarApi<{ items?: GoogleEvent[] }>(token, `/calendars/${encodeURIComponent(id)}/events`, {
        timeMin: start,
        timeMax: end,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '100',
      }),
    ),
  )
  return { status: 200, json: { events: sortEvents(lists.flatMap((l) => toEvents(l.items ?? [], date))) } }
}

/** POST /api/google/logout → forget (and revoke) the stored token. */
export const logout: Handler = async (req) => {
  const sealed = req.cookies[SESSION_COOKIE]
  const secret = process.env.SESSION_SECRET
  const token = sealed && secret ? unseal(sealed, createHash('sha256').update(secret).digest()) : null
  if (token) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {})
  }
  return { status: 200, json: { ok: true }, cookies: [cookie(SESSION_COOKIE, '', 0)] }
}

const routes: Record<string, { method: string; handler: Handler }> = {
  login: { method: 'GET', handler: login },
  callback: { method: 'GET', handler: callback },
  calendars: { method: 'GET', handler: calendars },
  events: { method: 'GET', handler: events },
  logout: { method: 'POST', handler: logout },
}

export type GoogleRoute = 'login' | 'callback' | 'calendars' | 'events' | 'logout'

/** Run one /api/google/<route> endpoint on a Node request (Vercel or the Vite dev server). */
export function handleGoogle(route: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const r = routes[route]
  if (!r) return runNode(async () => ({ status: 404, json: { error: 'Not found' } }), req, res)
  if (req.method !== r.method) return runNode(async () => ({ status: 405, json: { error: 'Method not allowed' } }), req, res)
  return runNode(r.handler, req, res)
}
