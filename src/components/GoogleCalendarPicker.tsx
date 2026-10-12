import { useEffect, useState } from 'react'
import { disconnectGoogle, listGoogleCalendars, type GoogleCalendar } from '../calendar/api'

interface Props {
  /** Selected calendar ids; empty means the primary calendar. */
  selected: string[]
  onChange: (ids: string[]) => void
  onConnect: () => void
  /** Outcome of a sign-in that just returned, if any. */
  result: string | null
}

type State = { kind: 'loading' } | { kind: 'disconnected' } | { kind: 'error'; message: string } | { kind: 'ready'; calendars: GoogleCalendar[] }

const RESULTS: Record<string, string> = {
  connected: 'Connected. Choose which calendars to show, then tap Save.',
  cancelled: 'Google sign-in was cancelled.',
  failed: 'Google sign-in didn’t finish. Try again.',
}

/** Connect/disconnect Google Calendar and choose which calendars appear in The Day. */
export function GoogleCalendarPicker({ selected, onChange, onConnect, result }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let live = true
    listGoogleCalendars()
      .then((calendars) => live && setState(calendars ? { kind: 'ready', calendars } : { kind: 'disconnected' }))
      .catch((err: Error) => live && setState({ kind: 'error', message: err.message }))
    return () => {
      live = false
    }
  }, [])

  const note = result ? RESULTS[result] : null

  if (state.kind === 'loading') return <span className="field-hint">Checking Google Calendar…</span>
  if (state.kind === 'error') return <span className="field-hint">{state.message}</span>
  if (state.kind === 'disconnected') {
    return (
      <>
        {note && result !== 'connected' && <span className="field-hint" style={{ marginBottom: 8 }}>{note}</span>}
        <button type="button" className="btn btn-primary btn-wide" onClick={onConnect}>
          Connect Google Calendar
        </button>
        <span className="field-hint">Read-only access. You’ll sign in with Google and come straight back here.</span>
      </>
    )
  }

  const effective = selected.length ? selected : state.calendars.filter((c) => c.primary).map((c) => c.id)
  const toggle = (id: string) => {
    const next = effective.includes(id) ? effective.filter((x) => x !== id) : [...effective, id]
    onChange(next)
  }
  return (
    <>
      {note && <span className="field-hint" style={{ marginTop: 0, marginBottom: 8 }}>{note}</span>}
      {state.calendars.map((c) => (
        <label key={c.id} className="checkbox" style={{ padding: '5px 0' }}>
          <input type="checkbox" checked={effective.includes(c.id)} onChange={() => toggle(c.id)} />
          {c.name}
          {c.primary && <span className="muted"> · main</span>}
        </label>
      ))}
      <button
        type="button"
        className="btn btn-ghost"
        style={{ marginTop: 8, alignSelf: 'flex-start' }}
        onClick={async () => {
          await disconnectGoogle()
          setState({ kind: 'disconnected' })
        }}
      >
        Disconnect Google
      </button>
    </>
  )
}
