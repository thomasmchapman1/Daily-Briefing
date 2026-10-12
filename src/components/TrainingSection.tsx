import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { emptyRun, formatDuration, formatPace, parseDuration, type DayLog, type FitnessLog, type LiftLog, type RunLog } from '../fitness/log'
import { MAIN_LIFTS, type PlannedLift, type PlannedRun, type Session } from '../fitness/plan'
import { lastSets } from '../fitness/stats'
import { NumInput } from './NumInput'

interface Props {
  date: Date
  isToday: boolean
  onStep: (days: number) => void
  onToday: () => void
  session: Session
  day: DayLog | undefined
  log: FitnessLog
  onUpdate: (change: (day: DayLog) => Omit<DayLog, 'updatedAt'>) => void
  onOpenProgress: () => void
}

function dayLabel(date: Date, isToday: boolean) {
  if (isToday) return 'Today'
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function TrainingSection({ date, isToday, onStep, onToday, session, day, log, onUpdate, onOpenProgress }: Props) {
  const lifts = session.lifts
  const doneCount = lifts.filter((l) => day?.lifts?.[l.id]?.done).length + (session.run && day?.run?.done ? 1 : 0)
  const total = lifts.length + (session.run ? 1 : 0)

  return (
    <section className="section section--training" aria-label="Training">
      <div className="kicker-row">
        <span className="kicker">Training</span>
        <span className="day-nav">
          <button className="day-nav-btn" onClick={() => onStep(-1)} aria-label="Previous day">
            <ChevronLeft size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button className="kicker-meta day-nav-label" onClick={onToday} disabled={isToday}>
            {dayLabel(date, isToday)}
          </button>
          <button className="day-nav-btn" onClick={() => onStep(1)} aria-label="Next day">
            <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </span>
      </div>
      <div className="training-title">{session.title}</div>
      <div className="training-meta">
        {session.subtitle}
        {total > 0 && ` · ${doneCount} of ${total} done`}
      </div>
      {session.notes.map((n) => (
        <p key={n} className="training-note">
          {n}
        </p>
      ))}

      {lifts.map((l) => (
        <LiftRow
          key={l.id}
          plan={l}
          logged={day?.lifts?.[l.id]}
          last={lastSets(log, l.id, session.date)}
          onChange={(next) => onUpdate((d) => ({ ...d, lifts: { ...d.lifts, [l.id]: next } }))}
        />
      ))}

      {session.run ? (
        <RunRow plan={session.run} logged={day?.run} onChange={(run) => onUpdate((d) => ({ ...d, run }))} />
      ) : (
        session.kind !== 'before' && <ExtraRun logged={day?.run} onChange={(run) => onUpdate((d) => ({ ...d, run }))} />
      )}

      <button className="btn btn-secondary btn-wide training-progress" onClick={onOpenProgress}>
        Progress & plan
      </button>
    </section>
  )
}

// ---------- Lifts ----------

function specOf(plan: PlannedLift) {
  return `${plan.sets} × ${plan.repsLabel}${plan.weight != null ? ` · ${plan.weight} lb` : ''}`
}

const isTimed = (plan: PlannedLift) => plan.id === 'plank'

/** The weight to suggest: the plan's for the barbell lifts, else what you used last time. */
function suggestedWeight(plan: PlannedLift, last: ReturnType<typeof lastSets>): number | null {
  if (MAIN_LIFTS.includes(plan.id) || isTimed(plan)) return plan.weight
  const lastW = last?.sets.map((s) => s.w).filter((w): w is number => w != null)
  return lastW?.length ? Math.max(...lastW) : plan.weight
}

function LiftRow({
  plan,
  logged,
  last,
  onChange,
}: {
  plan: PlannedLift
  logged: LiftLog | undefined
  last: ReturnType<typeof lastSets>
  onChange: (next: LiftLog) => void
}) {
  const [open, setOpen] = useState(false)
  const done = Boolean(logged?.done)
  const weight = suggestedWeight(plan, last)
  const sets = logged?.sets ?? Array.from({ length: plan.sets }, () => ({ w: null, r: null }))
  const timed = isTimed(plan)

  const toggle = () => {
    if (done) return onChange({ sets, done: false })
    // Ticking a lift off fills any blank set with the planned numbers.
    onChange({ done: true, sets: sets.map((s) => ({ w: s.w ?? (timed ? null : weight), r: s.r ?? plan.reps })) })
  }
  const setSet = (i: number, patch: Partial<LiftLog['sets'][number]>) =>
    onChange({ done, sets: sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  const lastText = last && last.sets.some((s) => s.r != null)
    ? `Last time: ${last.sets
        .filter((s) => s.r != null)
        .map((s) => (s.w != null ? `${s.w}×${s.r}` : `${s.r}${timed ? 's' : ''}`))
        .join(', ')}`
    : null

  return (
    <div className={`exercise-block${done ? ' exercise--done' : ''}`}>
      <div className="exercise">
        <button className="check tap-check" role="checkbox" aria-checked={done} aria-label={`${plan.name} done`} onClick={toggle}>
          {done ? '✓' : ''}
        </button>
        <button className="exercise-main" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="exercise-name">{plan.name}</span>
          <span className="exercise-spec">{specOf(plan)}</span>
          <span className={`chevron${open ? ' chevron--open' : ''}`} aria-hidden="true">
            ›
          </span>
        </button>
      </div>
      {open && (
        <div className="exercise-detail">
          {plan.warmup && (
            <div className="exercise-hint tnum">Warm-up: {plan.warmup.map(([w, r]) => `${w}×${r}`).join(', ')}</div>
          )}
          {plan.note && <div className="exercise-hint">{plan.note}</div>}
          {lastText && <div className="exercise-hint tnum">{lastText}</div>}
          <div className="set-grid">
            {sets.map((s, i) => (
              <div key={i} className="set-row">
                <span className="set-label">Set {i + 1}</span>
                {!timed && (
                  <>
                    <NumInput
                      className="set-input"
                      value={s.w}
                      placeholder={weight != null ? String(weight) : 'BW'}
                      onChange={(w) => setSet(i, { w })}
                      aria-label={`Set ${i + 1} weight in pounds`}
                    />
                    <span className="set-x">lb ×</span>
                  </>
                )}
                <NumInput
                  className="set-input"
                  decimal={false}
                  value={s.r}
                  placeholder={String(plan.reps)}
                  onChange={(r) => setSet(i, { r })}
                  aria-label={`Set ${i + 1} ${timed ? 'seconds' : 'reps'}`}
                />
                <span className="set-x">{timed ? 'sec' : 'reps'}</span>
              </div>
            ))}
          </div>
          <div className="set-actions">
            <button className="btn btn-ghost" onClick={() => onChange({ done, sets: [...sets, { ...(sets.at(-1) ?? { w: null, r: null }) }] })}>
              Add set
            </button>
            {sets.length > 1 && (
              <button className="btn btn-ghost" onClick={() => onChange({ done, sets: sets.slice(0, -1) })}>
                Remove set
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Runs ----------

function RunForm({ run, plannedMiles, onChange }: { run: RunLog; plannedMiles: number | null; onChange: (run: RunLog) => void }) {
  const [time, setTime] = useState(formatDuration(run.seconds))
  const pace = formatPace(run.miles, run.seconds)
  return (
    <div className="run-form">
      <label className="run-field">
        <span>Distance</span>
        <span className="run-input">
          <NumInput value={run.miles} placeholder={plannedMiles != null ? String(plannedMiles) : '0'} onChange={(miles) => onChange({ ...run, miles })} aria-label="Distance in miles" />
          <span className="set-x">mi</span>
        </span>
      </label>
      <label className="run-field">
        <span>Time</span>
        <input
          className={`input tnum${time && parseDuration(time) == null ? ' input--invalid' : ''}`}
          inputMode="numeric"
          placeholder="h:mm:ss"
          value={time}
          onChange={(e) => {
            setTime(e.target.value)
            const s = parseDuration(e.target.value)
            if (s != null || !e.target.value.trim()) onChange({ ...run, seconds: s })
          }}
          aria-label="Time, as h:mm:ss or mm:ss"
        />
      </label>
      <label className="run-field">
        <span>Avg heart rate</span>
        <span className="run-input">
          <NumInput decimal={false} value={run.hr} placeholder="—" onChange={(hr) => onChange({ ...run, hr })} aria-label="Average heart rate" />
          <span className="set-x">bpm</span>
        </span>
      </label>
      <label className="run-field">
        <span>Effort</span>
        <select
          className="input"
          value={run.effort ?? ''}
          onChange={(e) => onChange({ ...run, effort: e.target.value ? Number(e.target.value) : null })}
          aria-label="Effort from 1 to 10"
        >
          <option value="">—</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? '· very easy' : n === 4 ? '· easy' : n === 7 ? '· hard' : n === 10 ? '· all out' : ''}
            </option>
          ))}
        </select>
      </label>
      {pace && <div className="run-pace tnum">Pace {pace}</div>}
    </div>
  )
}

function RunRow({ plan, logged, onChange }: { plan: PlannedRun; logged: RunLog | undefined; onChange: (run: RunLog) => void }) {
  const [open, setOpen] = useState(false)
  const run = logged ?? emptyRun()
  const toggle = () => onChange(run.done ? { ...run, done: false } : { ...run, done: true, miles: run.miles ?? plan.miles })
  const summary = run.done || run.miles
    ? [run.miles != null && `${run.miles} mi`, run.seconds != null && formatDuration(run.seconds), formatPace(run.miles, run.seconds)].filter(Boolean).join(' · ')
    : null

  return (
    <div className={`exercise-block${run.done ? ' exercise--done' : ''}`}>
      <div className="exercise">
        <button className="check tap-check" role="checkbox" aria-checked={run.done} aria-label={`${plan.title} done`} onClick={toggle}>
          {run.done ? '✓' : ''}
        </button>
        <button className="exercise-main" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="exercise-name">{plan.title}</span>
          <span className={`chevron${open ? ' chevron--open' : ''}`} aria-hidden="true">
            ›
          </span>
        </button>
      </div>
      {summary && !open && <div className="run-summary tnum">{summary}</div>}
      {open && (
        <div className="exercise-detail">
          <div className="exercise-hint">{plan.detail}</div>
          <RunForm run={run} plannedMiles={plan.miles} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

/** On a rest day: room to log a run you did anyway. */
function ExtraRun({ logged, onChange }: { logged: RunLog | undefined; onChange: (run: RunLog) => void }) {
  const [open, setOpen] = useState(Boolean(logged?.miles))
  if (!open) {
    return (
      <button className="btn btn-ghost extra-run" onClick={() => setOpen(true)}>
        Ran anyway? Log a run
      </button>
    )
  }
  const run = logged ?? emptyRun()
  return (
    <div className="exercise-block">
      <div className="exercise-detail">
        <RunForm run={run} plannedMiles={null} onChange={(r) => onChange({ ...r, done: r.miles != null })} />
      </div>
    </div>
  )
}
