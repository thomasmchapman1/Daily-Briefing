import { ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { isoDate } from '../lib/date'
import type { SectionState } from '../useBriefing'
import { displayReference, getPlanDay, loadReadLog, setRead, streak } from '.'
import { Reader } from './Reader'
import type { ScriptureSettings, ScriptureToday } from './types'

interface Props {
  today: Date
  settings: ScriptureSettings
  state: SectionState<ScriptureToday>
  /** Where to finish personal worship (e.g. familyworship.io). Empty hides the link. */
  worshipUrl?: string
}

function pairs<T>(items: T[]): T[][] {
  return items.length > 2 ? Array.from({ length: Math.ceil(items.length / 2) }, (_, i) => items.slice(i * 2, i * 2 + 2)) : [items]
}

export function ScriptureSection({ today, settings, state, worshipUrl }: Props) {
  const [log, setLog] = useState(loadReadLog)
  const [readerOpen, setReaderOpen] = useState(false)
  const date = isoDate(today)
  const read = Boolean(log[date])
  const days = streak(log, today)

  // The plan works offline, so the reference always shows even without text.
  const plan = useMemo(() => getPlanDay(today, settings), [today, settings])
  const data = state.data
  const references = (data?.references ?? plan.references).map(displayReference)
  // With a worship link, the check marks worship as done; otherwise it marks the reading read.
  const [doneLabel, todoLabel] = worshipUrl ? ['✓ Worship done today', 'Mark worship done'] : ['✓ Read today', 'Mark as read']

  return (
    <section className="section section--scripture" aria-label="Scripture">
      <div className="kicker-row">
        <span className="kicker">Scripture · Day {data?.planDay ?? plan.planDay}</span>
        <span className="kicker-meta">{days}-day streak</span>
      </div>
      <button className="scripture-ref" onClick={() => setReaderOpen(true)}>
        {/* Two readings per line: M'Cheyne pairs them (family, then private). */}
        {pairs(references).map((pair) => (
          <span key={pair.join()} style={{ display: 'block' }}>
            {pair.join(' · ')}
          </span>
        ))}
      </button>
      {data?.excerpt ? (
        <>
          <blockquote className="scripture-quote">“{data.excerpt}”</blockquote>
          <div className="scripture-attr">{data.attribution}</div>
        </>
      ) : (
        <div className="scripture-attr" style={{ marginTop: 10 }}>
          {state.error ? 'Text unavailable right now' : 'Loading the text…'}
        </div>
      )}
      {worshipUrl && (
        <a className="btn btn-primary btn-wide" href={worshipUrl} target="_blank" rel="noopener noreferrer">
          Personal worship
          <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
        </a>
      )}
      <button
        className={`btn btn-wide ${read || worshipUrl ? 'btn-secondary' : 'btn-primary'}`}
        style={worshipUrl ? { marginTop: 10 } : undefined}
        aria-pressed={read}
        onClick={() => setLog((l) => setRead(l, date, !read))}
      >
        {read ? doneLabel : todoLabel}
      </button>
      {readerOpen && <Reader references={references} passages={data?.passages ?? null} onClose={() => setReaderOpen(false)} />}
    </section>
  )
}
