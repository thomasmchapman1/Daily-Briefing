import { addDays, isoDate, startOfDay } from '../lib/date'

// Mirrors server/icsEvents.ts CalendarEvent (kept separate so the client
// bundle doesn't pull in the server's ICS parser).
export interface CalendarEvent {
  title: string
  start: string | null
  end: string | null
  allDay: boolean
  location?: string
  notes?: string
}

export async function getTodaysEvents(icsUrl: string, day: Date, signal?: AbortSignal): Promise<CalendarEvent[]> {
  const start = startOfDay(day)
  const res = await fetch('/api/ics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: icsUrl,
      start: start.toISOString(),
      end: addDays(start, 1).toISOString(),
      date: isoDate(start),
    }),
    signal,
  })
  if (!res.ok) throw new Error(`Calendar ${res.status}`)
  const json = (await res.json()) as { events: CalendarEvent[] }
  return json.events
}
