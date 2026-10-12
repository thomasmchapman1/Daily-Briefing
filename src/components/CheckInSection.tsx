import { useId } from 'react'
import { BODY_LABELS, type BodyField, type BodyLog } from '../fitness/log'
import { NumInput } from './NumInput'

interface Props {
  body: BodyLog
  notes: string
  /** 7-day average weight up to this day, for the kicker. */
  avgWeight: number | null
  goalWeight: number
  onChange: (field: BodyField, value: number | null) => void
  onNotes: (notes: string) => void
}

const HINTS: Partial<Record<BodyField, string>> = {
  weight: 'Morning, after the bathroom',
  waist: 'At the navel, every 2 weeks',
  bodyFat: 'Same method, every 4 weeks',
  protein: 'Aim for 160–180 g',
}

const FIELDS: { field: BodyField; decimal: boolean }[] = [
  { field: 'weight', decimal: true },
  { field: 'waist', decimal: true },
  { field: 'bodyFat', decimal: true },
  { field: 'sleep', decimal: true },
  { field: 'restingHr', decimal: false },
  { field: 'calories', decimal: false },
  { field: 'protein', decimal: false },
]

function Metric({ field, decimal, value, onChange }: { field: BodyField; decimal: boolean; value: number | null | undefined; onChange: (v: number | null) => void }) {
  const id = useId()
  const { label, unit } = BODY_LABELS[field]
  return (
    <div className="metric">
      <label htmlFor={id} className="metric-label">
        {label}
      </label>
      <span className="run-input">
        <NumInput id={id} decimal={decimal} value={value} onChange={onChange} placeholder="—" />
        <span className="set-x unit">{unit}</span>
      </span>
      {HINTS[field] && <span className="metric-hint">{HINTS[field]}</span>}
    </div>
  )
}

export function CheckInSection({ body, notes, avgWeight, goalWeight, onChange, onNotes }: Props) {
  const notesId = useId()
  const toGo = avgWeight != null ? avgWeight - goalWeight : null
  return (
    <section className="section section--checkin" aria-label="Check-in">
      <div className="kicker-row">
        <span className="kicker">Check-in</span>
        {avgWeight != null && (
          <span className="kicker-meta">
            Avg {avgWeight.toFixed(1)} lb{toGo != null && toGo > 0 ? ` · ${toGo.toFixed(1)} to go` : ''}
          </span>
        )}
      </div>
      <div className="metric-grid">
        {FIELDS.map(({ field, decimal }) => (
          <Metric key={field} field={field} decimal={decimal} value={body[field]} onChange={(v) => onChange(field, v)} />
        ))}
      </div>
      <div className="metric metric--wide">
        <label htmlFor={notesId} className="metric-label">
          Notes
        </label>
        <textarea
          id={notesId}
          className="input checkin-notes"
          rows={2}
          placeholder="How you felt, aches, anything unusual"
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
        />
      </div>
    </section>
  )
}
