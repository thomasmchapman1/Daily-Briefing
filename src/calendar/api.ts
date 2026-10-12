import { addDays, isoDate, startOfDay } from '../lib/date'
import type { Settings } from '../settings'

// Mirrors server/icsEvents.ts CalendarEvent (kept separate so the client
// bundle doesn't pull in the server code).
export interface CalendarEvent {
  title: string
  start: string | null
  end: string | null
  allDay: boolean
  location?: string
  notes?: string
}

export interface GoogleCalendar {
  id: string
  name: string
  primary: boolean
}

/** Google said the session is missing or expired: the user needs to (re)connect. */
export class CalendarAuthError extends Error {}

type CalendarSettings = Pick<Settings, 'calendarSource' | 'googleCalendars' | 'icsUrl'>

export function calendarConfigured(s: CalendarSettings): boolean {
  return s.calendarSource === 'google' || Boolean(s.icsUrl)
}

/** Identifies which calendar(s) a cached day of events came from. */
export function calendarKey(s: CalendarSettings): string {
  return s.calendarSource === 'google' ? `google:${s.googleCalendars.join(',')}` : `ics:${s.icsUrl}`
}

function dayRange(day: Date) {
  const start = startOfDay(day)
  return { start: start.toISOString(), end: addDays(start, 1).toISOString(), date: isoDate(start) }
}

async function errorMessage(res: Response): Promise<string> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null
  return json?.error ?? `Calendar ${res.status}`
}

export async function getTodaysEvents(s: CalendarSettings, day: Date, signal?: AbortSignal): Promise<CalendarEvent[]> {
  const range = dayRange(day)
  const res =
    s.calendarSource === 'google'
      ? await fetch(`/api/google/events?${new URLSearchParams({ ...range, calendars: s.googleCalendars.join(',') })}`, { signal })
      : await fetch('/api/ics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: s.icsUrl, ...range }),
          signal,
        })
  if (res.status === 401) throw new CalendarAuthError(await errorMessage(res))
  if (!res.ok) throw new Error(await errorMessage(res))
  return ((await res.json()) as { events: CalendarEvent[] }).events
}

/** The signed-in user's calendars, or null when Google isn't connected. */
export async function listGoogleCalendars(): Promise<GoogleCalendar[] | null> {
  const res = await fetch('/api/google/calendars')
  if (res.status === 401) return null
  if (!res.ok) throw new Error(await errorMessage(res))
  return ((await res.json()) as { calendars: GoogleCalendar[] }).calendars
}

export function connectGoogle(): void {
  window.location.href = '/api/google/login'
}

export async function disconnectGoogle(): Promise<void> {
  await fetch('/api/google/logout', { method: 'POST' })
}
