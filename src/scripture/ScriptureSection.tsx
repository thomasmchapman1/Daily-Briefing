import { useMemo, useState } from 'react'
import { isoDate } from '../lib/date'
import type { SectionState } from '../useBriefing'
import { getPlanDay, loadReadLog, setRead, streak } from '.'
import { Reader } from './Reader'
import type { ScriptureSettings, ScriptureToday } from './types'

interface Props {
  today: Date
  settings: ScriptureSettings
  state: SectionState<ScriptureToday>
}

export function ScriptureSection({ today, settings, state }: Props) {
  const [log, setLog] = useState(loadReadLog)
  const [readerOpen, setReaderOpen] = useState(false)
  const date = isoDate(today)
  const read = Boolean(log[date])
  const days = streak(log, today)

  // The plan works offline, so the reference always shows even without text.
  const plan = useMemo(() => getPlanDay(today, settings), [today, settings])
  const data = state.data
  const references = data?.references ?? plan.references

  return (
    <section className="section section--scripture" aria-label="Scripture">
      <div className="kicker-row">
        <span className="kicker">Scripture · Day {data?.planDay ?? plan.planDay}</span>
        <span className="kicker-meta">{days}-day streak</span>
      </div>
      <button className="scripture-ref" onClick={() => setReaderOpen(true)}>
        {references.join(' · ')}
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
      <button
        className={`btn ${read ? 'btn-secondary' : 'btn-primary'}`}
        aria-pressed={read}
        onClick={() => setLog((l) => setRead(l, date, !read))}
      >
        {read ? '✓ Read today' : 'Mark as read'}
      </button>
      {readerOpen && <Reader references={references} passages={data?.passages ?? null} onClose={() => setReaderOpen(false)} />}
    </section>
  )
}
