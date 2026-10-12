import { useState } from 'react'
import type { CalendarEvent } from '../calendar/api'
import { clockTime } from '../lib/date'
import type { SectionState } from '../useBriefing'
import { Kicker, Skeleton } from './Kicker'

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function DaySection({ state, linked }: { state: SectionState<CalendarEvent[]>; linked: boolean }) {
  const [openEventIndex, setOpenEventIndex] = useState<number | null>(null)
  const events = state.data

  let body
  if (!linked) {
    body = <p className="empty-note">No calendar linked. Tap the title above to add one.</p>
  } else if (events) {
    body = events.length ? (
      <div className="events">
        {events.map((e, i) => {
          const open = openEventIndex === i
          const hasDetail = Boolean(e.location || e.notes)
          return (
            <button
              key={`${e.start}-${e.title}-${i}`}
              className="event tap"
              aria-expanded={open}
              onClick={() => setOpenEventIndex(open ? null : i)}
            >
              <span className="event-time">{e.allDay || !e.start ? 'All day' : clockTime(new Date(e.start))}</span>
              <span>
                <span className="event-title">{e.title}</span>
                {open && (
                  <span className="event-detail" style={{ display: 'block' }}>
                    {e.location && <span style={{ display: 'block' }}>{e.location}</span>}
                    {e.notes && <span style={{ display: 'block', whiteSpace: 'pre-line' }}>{e.notes}</span>}
                    {!hasDetail && <span style={{ display: 'block' }}>No details</span>}
                  </span>
                )}
              </span>
              <span className={`chevron${open ? ' chevron--open' : ''}`} aria-hidden="true">
                ›
              </span>
            </button>
          )
        })}
      </div>
    ) : (
      <p className="empty-note">Nothing scheduled. An open day.</p>
    )
  } else if (state.error) {
    body = <p className="section-error">Calendar couldn’t be reached</p>
  } else {
    body = <Skeleton rows={3} />
  }

  return (
    <section className="section" aria-label="The Day">
      <Kicker label="The Day" meta={linked && events ? plural(events.length, 'engagement') : undefined} />
      {body}
    </section>
  )
}
