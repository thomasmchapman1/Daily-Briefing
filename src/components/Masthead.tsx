import { dayOfYear, toRoman } from '../lib/date'

// Volume numbering: Vol. XLII in 2026.
const VOLUME_EPOCH = 1984

export function Masthead({ today, city, onOpenSettings }: { today: Date; city: string; onOpenSettings: () => void }) {
  const weekday = today.toLocaleDateString('en-GB', { weekday: 'long' })
  const date = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <header className="masthead">
      <div className="masthead-vol">
        Vol. {toRoman(today.getFullYear() - VOLUME_EPOCH)} · No. {dayOfYear(today)}
      </div>
      <h1 style={{ margin: 0 }}>
        <button className="masthead-title" onClick={onOpenSettings} aria-label="The Morning — open settings">
          The Morning
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
