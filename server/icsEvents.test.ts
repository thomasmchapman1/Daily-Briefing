import { describe, expect, it } from 'vitest'
import { eventsInRange, validateRequest } from './icsEvents'

const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//EN
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:DAYLIGHT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:service
DTSTART;TZID=America/New_York:20260104T093000
DTEND;TZID=America/New_York:20260104T110000
RRULE:FREQ=WEEKLY;BYDAY=SU
SUMMARY:Morning service
LOCATION:Grace Fellowship\\, 410 Union St
END:VEVENT
BEGIN:VEVENT
UID:lunch
DTSTART:20261011T163000Z
DTEND:20261011T180000Z
SUMMARY:Lunch with Sarah & Tom
LOCATION:Juniper Kitchen
END:VEVENT
BEGIN:VEVENT
UID:allday
DTSTART;VALUE=DATE:20261011
DTEND;VALUE=DATE:20261012
SUMMARY:Anniversary
END:VEVENT
BEGIN:VEVENT
UID:yesterday
DTSTART:20261010T160000Z
DTEND:20261010T170000Z
SUMMARY:Not today
END:VEVENT
BEGIN:VEVENT
UID:call
DTSTART;TZID=America/New_York:20260927T160000
DTEND;TZID=America/New_York:20260927T163000
RRULE:FREQ=WEEKLY;INTERVAL=2
EXDATE;TZID=America/New_York:20261011T160000
SUMMARY:Excluded call
END:VEVENT
BEGIN:VEVENT
UID:plan
DTSTART;TZID=America/New_York:20260913T190000
DTEND;TZID=America/New_York:20260913T193000
RRULE:FREQ=WEEKLY
SUMMARY:Plan the week
END:VEVENT
BEGIN:VEVENT
UID:plan
RECURRENCE-ID;TZID=America/New_York:20261011T190000
DTSTART;TZID=America/New_York:20261011T200000
DTEND;TZID=America/New_York:20261011T203000
SUMMARY:Plan the week (moved)
END:VEVENT
END:VCALENDAR`.replace(/\n/g, '\r\n')

// 11 Oct 2026 in New York (EDT, UTC-4).
const day = { start: '2026-10-11T04:00:00.000Z', end: '2026-10-12T04:00:00.000Z', date: '2026-10-11' }

describe('eventsInRange', () => {
  const events = eventsInRange(ics, day)

  it('returns only today, all-day first, then by time', () => {
    expect(events.map((e) => e.title)).toEqual(['Anniversary', 'Morning service', 'Lunch with Sarah & Tom', 'Plan the week (moved)'])
  })

  it('expands recurring events in their time zone', () => {
    const service = events.find((e) => e.title === 'Morning service')!
    expect(service.start).toBe('2026-10-11T13:30:00.000Z')
    expect(service.location).toBe('Grace Fellowship, 410 Union St')
  })

  it('marks all-day events', () => {
    expect(events[0]).toMatchObject({ allDay: true, start: null })
  })

  it('applies recurrence exceptions', () => {
    expect(events.find((e) => e.title.startsWith('Plan'))!.start).toBe('2026-10-12T00:00:00.000Z')
  })

  it('returns nothing on an empty day', () => {
    expect(eventsInRange(ics, { start: '2026-10-13T04:00:00.000Z', end: '2026-10-14T04:00:00.000Z', date: '2026-10-13' })).toEqual([])
  })
})

describe('validateRequest', () => {
  const ok = { start: day.start, end: day.end, date: day.date }
  it('accepts https and webcal links', () => {
    expect(validateRequest({ ...ok, url: 'webcal://p01-caldav.icloud.com/x.ics' }).url).toBe('https://p01-caldav.icloud.com/x.ics')
  })
  it('rejects http, IPs and localhost', () => {
    for (const url of ['http://example.com/a.ics', 'https://127.0.0.1/a.ics', 'https://localhost/a.ics', 'https://[::1]/a.ics']) {
      expect(() => validateRequest({ ...ok, url })).toThrow()
    }
  })
})
