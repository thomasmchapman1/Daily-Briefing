// Shared ICS logic, used by the Vercel function (api/ics.ts) and the Vite dev
// server middleware. Fetches a private iCal link and returns only the events
// that overlap the requested window, never the raw calendar.
import ICAL from 'ical.js'

export interface CalendarEvent {
  title: string
  /** ISO timestamp (UTC) for timed events; null for all-day events. */
  start: string | null
  end: string | null
  allDay: boolean
  location?: string
  notes?: string
}

export interface IcsRequest {
  url: string
  /** Window to return, as ISO timestamps. Normally the caller's local day. */
  start: string
  end: string
  /** The caller's local date (YYYY-MM-DD), used to match all-day events. */
  date: string
}

const MAX_BYTES = 5 * 1024 * 1024
const MAX_OCCURRENCES = 20000

export class IcsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}

export function validateRequest(body: unknown): IcsRequest {
  const b = (body ?? {}) as Record<string, unknown>
  const { url, start, end, date } = b
  if (typeof url !== 'string' || typeof start !== 'string' || typeof end !== 'string' || typeof date !== 'string') {
    throw new IcsError('Expected { url, start, end, date }')
  }
  if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new IcsError('Bad date range')
  }
  let parsed: URL
  try {
    parsed = new URL(url.replace(/^webcals?:\/\//i, 'https://'))
  } catch {
    throw new IcsError('Bad calendar URL')
  }
  if (parsed.protocol !== 'https:') throw new IcsError('Calendar URL must be https')
  const host = parsed.hostname
  if (host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new IcsError('Calendar host not allowed')
  }
  return { url: parsed.toString(), start, end, date }
}

export async function fetchIcs(url: string): Promise<string> {
  const res = await fetch(url, { headers: { Accept: 'text/calendar, */*' }, redirect: 'follow' })
  if (!res.ok) throw new IcsError(`Calendar responded ${res.status}`, 502)
  const text = await res.text()
  if (text.length > MAX_BYTES) throw new IcsError('Calendar too large', 502)
  if (!text.includes('BEGIN:VCALENDAR')) throw new IcsError('Not an iCal feed', 502)
  return text
}

function clean(s: unknown, max = 400): string | undefined {
  if (typeof s !== 'string') return undefined
  const t = s.replace(/\r/g, '').trim()
  if (!t) return undefined
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function toEvent(summary: unknown, location: unknown, description: unknown, start: ICAL.Time, end: ICAL.Time): CalendarEvent {
  const allDay = start.isDate
  return {
    title: clean(summary, 200) ?? '(No title)',
    start: allDay ? null : start.toJSDate().toISOString(),
    end: allDay ? null : end.toJSDate().toISOString(),
    allDay,
    location: clean(location, 200),
    notes: clean(description),
  }
}

/** Parse ICS text and return the events overlapping [start, end), sorted. */
export function eventsInRange(ics: string, req: Pick<IcsRequest, 'start' | 'end' | 'date'>): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(ics))
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    const tzid = tz.getFirstPropertyValue('tzid')
    if (typeof tzid === 'string' && !ICAL.TimezoneService.has(tzid)) ICAL.TimezoneService.register(tz)
  }

  const rangeStart = Date.parse(req.start)
  const rangeEnd = Date.parse(req.end)
  // All-day events are matched by calendar date, independent of time zone.
  const dayStart = ICAL.Time.fromDateString(req.date)
  const dayEnd = dayStart.clone()
  dayEnd.adjust(1, 0, 0, 0)

  const overlaps = (s: ICAL.Time, e: ICAL.Time): boolean => {
    if (s.isDate) return s.compare(dayEnd) < 0 && (e.compare(dayStart) > 0 || s.compare(dayStart) === 0)
    const sm = s.toJSDate().getTime()
    const em = Math.max(e.toJSDate().getTime(), sm)
    return sm < rangeEnd && (em > rangeStart || sm === rangeStart)
  }

  // Group recurrence exceptions with their master event.
  const masters = new Map<string, ICAL.Event>()
  const exceptions: ICAL.Component[] = []
  const singles: ICAL.Event[] = []
  for (const vevent of root.getAllSubcomponents('vevent')) {
    if (vevent.getFirstPropertyValue('status') === 'CANCELLED') continue
    if (vevent.hasProperty('recurrence-id')) {
      exceptions.push(vevent)
      continue
    }
    const ev = new ICAL.Event(vevent)
    if (ev.isRecurring()) masters.set(ev.uid, ev)
    else singles.push(ev)
  }
  for (const ex of exceptions) {
    const ev = new ICAL.Event(ex)
    const master = masters.get(ev.uid)
    if (master) master.relateException(ev)
    else singles.push(ev)
  }

  const out: CalendarEvent[] = []
  for (const ev of singles) {
    if (!ev.startDate) continue
    const end = ev.endDate ?? ev.startDate
    if (overlaps(ev.startDate, end)) out.push(toEvent(ev.summary, ev.location, ev.description, ev.startDate, end))
  }

  // Iterate a little past the window so moved exceptions are still found.
  const iterLimit = rangeEnd + 2 * 86400000
  for (const ev of masters.values()) {
    const it = ev.iterator()
    let n = 0
    for (let next = it.next(); next && n < MAX_OCCURRENCES; next = it.next(), n++) {
      if (next.toJSDate().getTime() > iterLimit) break
      const occ = ev.getOccurrenceDetails(next)
      if (occ.item.component.getFirstPropertyValue('status') === 'CANCELLED') continue
      if (overlaps(occ.startDate, occ.endDate)) {
        out.push(toEvent(occ.item.summary, occ.item.location, occ.item.description, occ.startDate, occ.endDate))
      }
    }
  }

  return out.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    return (a.start ?? '').localeCompare(b.start ?? '') || a.title.localeCompare(b.title)
  })
}

export async function handleIcsRequest(body: unknown): Promise<{ events: CalendarEvent[] }> {
  const req = validateRequest(body)
  const ics = await fetchIcs(req.url)
  return { events: eventsInRange(ics, req) }
}
