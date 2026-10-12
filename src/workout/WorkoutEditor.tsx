import { ArrowDown, ArrowUp, Download, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { addDays, fromIsoDate } from '../lib/date'
import { DAYS_PER_WEEK, normalizeProgram, type Exercise, type Program, type ProgramDay } from '.'
import { ImportPlan } from './ImportPlan'

interface Props {
  program: Program
  /** Day 1 of week 1; used to label days with their weekday. */
  programStart: string
  onSave: (next: Program) => void
  onReset: () => void
  onClose: () => void
}

const clone = (p: Program): Program => JSON.parse(JSON.stringify(p))

/** Edit the training plan: weeks of seven days, each with a title, length and exercises. */
export function WorkoutEditor({ program, programStart, onSave, onReset, onClose }: Props) {
  const [draft, setDraft] = useState(() => clone(program))
  const [week, setWeek] = useState(0)
  const [openDay, setOpenDay] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)
  const weekday = (day: number) =>
    addDays(fromIsoDate(programStart), day).toLocaleDateString('en-GB', { weekday: 'short' })

  const updateDay = (day: number, change: (d: ProgramDay) => ProgramDay) =>
    setDraft((p) => {
      const next = clone(p)
      next.weeks[week].days[day] = change(next.weeks[week].days[day])
      return next
    })
  const updateExercise = (day: number, index: number, patch: Partial<Exercise>) =>
    updateDay(day, (d) => ({ ...d, exercises: d.exercises.map((e, i) => (i === index ? { ...e, ...patch } : e)) }))
  const moveExercise = (day: number, index: number, by: number) =>
    updateDay(day, (d) => {
      const list = [...d.exercises]
      const [item] = list.splice(index, 1)
      list.splice(Math.max(0, Math.min(list.length, index + by)), 0, item)
      return { ...d, exercises: list }
    })

  const addWeek = () => {
    // The new week starts as a copy of the last one.
    setDraft((p) => ({ ...p, weeks: [...p.weeks, clone(p).weeks[p.weeks.length - 1]] }))
    setWeek(draft.weeks.length)
    setOpenDay(null)
  }
  const removeWeek = () => {
    if (draft.weeks.length < 2 || !window.confirm(`Remove week ${week + 1}?`)) return
    setDraft((p) => ({ ...p, weeks: p.weeks.filter((_, i) => i !== week) }))
    setWeek((w) => Math.max(0, w - 1))
  }
  const copyToAll = () => {
    if (!window.confirm(`Make every week the same as week ${week + 1}?`)) return
    setDraft((p) => ({ ...p, weeks: p.weeks.map(() => clone(p).weeks[week]) }))
  }

  const days = draft.weeks[week].days

  return (
    <Sheet label="Training plan" backLabel="Settings" aside={<span className="sheet-title">Training plan</span>} onClose={onClose}>
      <div className="settings">
        <div className="field">
          <button type="button" className="btn btn-secondary btn-wide" onClick={() => setImporting(true)}>
            <Download size={15} strokeWidth={1.5} aria-hidden="true" /> Import from Claude
          </button>
          {imported && <span className="field-hint">Imported. Look it over, then tap Save training plan at the bottom.</span>}
        </div>

        <div className="field">
          <label htmlFor="plan-week">Week</label>
          <div className="field-row">
            <select
              id="plan-week"
              className="input"
              value={week}
              onChange={(e) => {
                setWeek(Number(e.target.value))
                setOpenDay(null)
              }}
            >
              {draft.weeks.map((_, i) => (
                <option key={i} value={i}>
                  Week {i + 1} of {draft.weeks.length}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary btn-nowrap" onClick={addWeek}>
              Add week
            </button>
          </div>
          <span className="editor-actions">
            <button type="button" className="btn btn-ghost" onClick={copyToAll}>
              Copy to all weeks
            </button>
            <button type="button" className="btn btn-ghost" onClick={removeWeek} disabled={draft.weeks.length < 2}>
              Remove this week
            </button>
          </span>
        </div>

        {days.slice(0, DAYS_PER_WEEK).map((d, day) => {
          const open = openDay === day
          const rest = d.exercises.length === 0
          return (
            <div key={day} className="editor-day">
              <button type="button" className="editor-day-head tap" aria-expanded={open} onClick={() => setOpenDay(open ? null : day)}>
                <span className="editor-day-num">
                  Day {day + 1} · {weekday(week * DAYS_PER_WEEK + day)}
                </span>
                <span className="editor-day-title">
                  {d.title || (rest ? 'Rest day' : 'Workout')}
                  <span className="muted"> {rest ? '' : `· ${d.exercises.length}`}</span>
                </span>
                <span className={`chevron${open ? ' chevron--open' : ''}`} aria-hidden="true">
                  ›
                </span>
              </button>
              {open && (
                <div className="editor-day-body">
                  <div className="field-row">
                    <label className="editor-label" style={{ flex: 1 }}>
                      Title
                      <input
                        className="input"
                        value={d.title}
                        placeholder={rest ? 'Rest day' : 'Workout'}
                        onChange={(e) => updateDay(day, (x) => ({ ...x, title: e.target.value }))}
                      />
                    </label>
                    <label className="editor-label" style={{ width: 84 }}>
                      Minutes
                      <input
                        className="input"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={d.minutes || ''}
                        disabled={rest}
                        onChange={(e) => updateDay(day, (x) => ({ ...x, minutes: Number(e.target.value) }))}
                      />
                    </label>
                  </div>
                  {d.exercises.map((ex, i) => (
                    <div key={i} className="editor-exercise">
                      <input
                        className="input"
                        aria-label={`Exercise ${i + 1}`}
                        placeholder="Exercise"
                        value={ex.name}
                        onChange={(e) => updateExercise(day, i, { name: e.target.value })}
                      />
                      <input
                        className="input"
                        aria-label={`Exercise ${i + 1} sets and load`}
                        placeholder="3 × 10 · 50 lb"
                        value={ex.spec}
                        onChange={(e) => updateExercise(day, i, { spec: e.target.value })}
                      />
                      <span className="editor-exercise-tools">
                        <button type="button" className="btn btn-ghost btn-icon" aria-label="Move up" disabled={i === 0} onClick={() => moveExercise(day, i, -1)}>
                          <ArrowUp size={15} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          aria-label="Move down"
                          disabled={i === d.exercises.length - 1}
                          onClick={() => moveExercise(day, i, 1)}
                        >
                          <ArrowDown size={15} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          aria-label={`Remove ${ex.name || 'exercise'}`}
                          onClick={() => updateDay(day, (x) => ({ ...x, exercises: x.exercises.filter((_, j) => j !== i) }))}
                        >
                          <X size={15} strokeWidth={1.5} />
                        </button>
                      </span>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginTop: 10 }}
                    onClick={() =>
                      updateDay(day, (x) => ({
                        ...x,
                        title: rest && (!x.title || x.title === 'Rest day') ? '' : x.title,
                        exercises: [...x.exercises, { name: '', spec: '' }],
                      }))
                    }
                  >
                    <Plus size={15} strokeWidth={1.5} aria-hidden="true" /> Add exercise
                  </button>
                  {!rest && (
                    <span className="field-hint">Remove every exercise to make this a rest day.</span>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <div style={{ paddingTop: 20 }}>
          <button
            type="button"
            className="btn btn-primary btn-wide"
            onClick={() => {
              onSave(normalizeProgram(draft))
              onClose()
            }}
          >
            Save training plan
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-wide"
            style={{ marginTop: 10 }}
            onClick={() => {
              if (!window.confirm('Go back to the original plan? Your edits will be lost.')) return
              onReset()
              onClose()
            }}
          >
            Reset to the original plan
          </button>
        </div>
      </div>
      {importing && (
        <ImportPlan
          current={normalizeProgram(draft)}
          programStart={programStart}
          onUse={(p) => {
            setDraft(clone(p))
            setWeek(0)
            setOpenDay(null)
            setImported(true)
          }}
          onClose={() => setImporting(false)}
        />
      )}
    </Sheet>
  )
}
