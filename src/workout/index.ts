import { daysBetween, fromIsoDate } from '../lib/date'
import { load, save } from '../lib/storage'
import bundled from './program.json'

export interface Exercise {
  name: string
  spec: string
}

export interface ProgramDay {
  title: string
  minutes: number
  exercises: Exercise[]
}

export interface Program {
  name: string
  weeks: { days: ProgramDay[] }[]
}

export const DAYS_PER_WEEK = 7

/** The plan shipped with the app (src/workout/program.json). */
export const DEFAULT_PROGRAM: Program = bundled

/** Make any stored or edited plan safe to use: 1+ weeks of 7 days, named days, no blank exercises. */
export function normalizeProgram(input: unknown): Program {
  const p = (input ?? {}) as Partial<Program>
  const weeks = Array.isArray(p.weeks) ? p.weeks : []
  const out: Program = {
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'My plan',
    weeks: weeks.map((w) => {
      const days = Array.isArray(w?.days) ? w.days : []
      return {
        days: Array.from({ length: DAYS_PER_WEEK }, (_, i) => {
          const d = (days[i] ?? {}) as Partial<ProgramDay>
          const exercises = (Array.isArray(d.exercises) ? d.exercises : [])
            .map((e) => ({ name: String(e?.name ?? '').trim(), spec: String(e?.spec ?? '').trim() }))
            .filter((e) => e.name)
          const title = String(d.title ?? '').trim()
          const minutes = Math.max(0, Math.round(Number(d.minutes) || 0))
          return { title: title || (exercises.length ? 'Workout' : 'Rest day'), minutes: exercises.length ? minutes : 0, exercises }
        }),
      }
    }),
  }
  return out.weeks.length ? out : DEFAULT_PROGRAM
}

/** The plan in use: the one edited in settings, or the bundled default. */
export function loadProgram(): Program {
  const saved = load<Program | null>('program', null)
  return saved ? normalizeProgram(saved) : DEFAULT_PROGRAM
}

export function saveProgram(p: Program): Program {
  const clean = normalizeProgram(p)
  save('program', clean)
  return clean
}

/** Forget edits and go back to the bundled plan. */
export function resetProgram(): Program {
  save('program', null)
  return DEFAULT_PROGRAM
}

export interface TodayWorkout extends ProgramDay {
  week: number
  day: number
  rest: boolean
}

/** Current week/day of the programme, counted from its start date. Loops when it ends. */
export function getWorkout(date: Date, programStart: string, p: Program = DEFAULT_PROGRAM): TodayWorkout {
  const flat = p.weeks.flatMap((w, wi) => w.days.map((d, di) => ({ ...d, week: wi + 1, day: di + 1 })))
  const elapsed = daysBetween(fromIsoDate(programStart), date)
  const entry = flat[((elapsed % flat.length) + flat.length) % flat.length]
  return { ...entry, rest: entry.exercises.length === 0 }
}

export type WorkoutLog = Record<string, Record<number, true>>

export function loadWorkoutLog(): WorkoutLog {
  return load<WorkoutLog>('workoutLog', {})
}

export function toggleExercise(log: WorkoutLog, date: string, index: number): WorkoutLog {
  const day = { ...(log[date] ?? {}) }
  if (day[index]) delete day[index]
  else day[index] = true
  const next = { ...log, [date]: day }
  save('workoutLog', next)
  return next
}
