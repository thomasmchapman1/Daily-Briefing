import { daysBetween, fromIsoDate, toRoman } from '../lib/date'

/** Vol. I · No. 1 is this date. Issues count up daily; a new volume starts each anniversary. */
export const FIRST_ISSUE = '2026-10-12'

export function issueLabel(today: Date, firstIssue = FIRST_ISSUE): string {
  const first = fromIsoDate(firstIssue)
  const issue = daysBetween(first, today) + 1
  if (issue < 1) return 'Vol. I · Preview'
  let years = today.getFullYear() - first.getFullYear()
  if (today < new Date(today.getFullYear(), first.getMonth(), first.getDate())) years--
  return `Vol. ${toRoman(years + 1)} · No. ${issue}`
}

export function Masthead({ today, city, onOpenSettings }: { today: Date; city: string; onOpenSettings: () => void }) {
  const weekday = today.toLocaleDateString('en-GB', { weekday: 'long' })
  const date = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <header className="masthead">
      <div className="masthead-vol">{issueLabel(today)}</div>
      <h1 style={{ margin: 0 }}>
        <button className="masthead-title" onClick={onOpenSettings} aria-label="The Morning Briefing — open settings">
          The Morning Briefing
        </button>
      </h1>
      <div className="masthead-line">
        <span>{weekday}</span>
        <span>{date}</span>
        <span>{city}</span>
      </div>
    </header>
  )
}
