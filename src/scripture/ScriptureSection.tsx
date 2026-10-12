import { ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { isoDate } from '../lib/date'
import type { SectionState } from '../useBriefing'
import { displayReference, getPlanDay, loadReadLog, setRead, streak } from '.'
import type { ScriptureSettings, ScriptureToday } from './types'

interface Props {
  today: Date
  settings: ScriptureSettings
  state: SectionState<ScriptureToday>
  /** Where to do personal worship (e.g. familyworship.io). Empty hides the links. */
  worshipUrl?: string
}

/** The verse of the day, with links straight to personal worship. */
export function ScriptureSection({ today, settings, state, worshipUrl }: Props) {
  const [log, setLog] = useState(loadReadLog)
  const date = isoDate(today)
  const done = Boolean(log[date])
  const days = streak(log, today)

  // The verse list works offline, so the reference always shows even without text.
  const plan = useMemo(() => getPlanDay(today, settings), [today, settings])
  const data = state.data
  const reference = (data?.references ?? plan.references).map(displayReference).join(' · ')

  return (
    <section className="section section--scripture" aria-label="Scripture">
      <div className="kicker-row">
        <span className="kicker">Scripture</span>
        <span className="kicker-meta">{days}-day streak</span>
      </div>
      {worshipUrl ? (
        <a className="scripture-ref" href={worshipUrl} target="_blank" rel="noopener noreferrer">
          {reference}
        </a>
      ) : (
        <div className="scripture-ref">{reference}</div>
      )}
      {data?.excerpt ? (
        <>
          <blockquote className="scripture-quote">“{data.excerpt}”</blockquote>
          <div className="scripture-attr">{data.attribution}</div>
        </>
      ) : (
        <div className="scripture-attr" style={{ marginTop: 10 }}>
          {state.error ? 'Text unavailable right now' : 'Loading the verse…'}
        </div>
      )}
      {worshipUrl && (
        <a className="btn btn-primary btn-wide" href={worshipUrl} target="_blank" rel="noopener noreferrer">
          Personal worship
          <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
        </a>
      )}
      <button
        className={`btn btn-wide ${done || worshipUrl ? 'btn-secondary' : 'btn-primary'}`}
        style={worshipUrl ? { marginTop: 10 } : undefined}
        aria-pressed={done}
        onClick={() => setLog((l) => setRead(l, date, !done))}
      >
        {done ? '✓ Worship done today' : 'Mark worship done'}
      </button>
    </section>
  )
}
