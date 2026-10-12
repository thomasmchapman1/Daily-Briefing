import { daysBetween, fromIsoDate } from '../lib/date'
import { load, save } from '../lib/storage'
import program from './program.json'

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

export interface TodayWorkout extends ProgramDay {
  week: number
  day: number
  rest: boolean
}

/** Current week/day of the programme, counted from its start date. Loops when it ends. */
export function getWorkout(date: Date, programStart: string, p: Program = program): TodayWorkout {
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
