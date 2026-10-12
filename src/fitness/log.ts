// What you actually did and measured, one record per local date. Each day
// carries updatedAt so two devices can merge: the newer day wins.
import { isDatedLog } from './merge'
import type { LiftId } from './plan'

export interface SetLog {
  /** lb; null for bodyweight. */
  w: number | null
  /** Reps, or seconds for a timed hold. */
  r: number | null
}

export interface LiftLog {
  sets: SetLog[]
  done: boolean
}

export interface RunLog {
  miles: number | null
  /** Total time in seconds. */
  seconds: number | null
  /** Average heart rate. */
  hr: number | null
  /** How hard it felt, 1 (very easy) to 10 (all out). */
  effort: number | null
  done: boolean
}

export interface BodyLog {
  weight?: number | null
  waist?: number | null
  bodyFat?: number | null
  sleep?: number | null
  restingHr?: number | null
  calories?: number | null
  protein?: number | null
}

export interface DayLog {
  body?: BodyLog
  lifts?: Partial<Record<LiftId, LiftLog>>
  run?: RunLog
  notes?: string
  /** ms since epoch of the last edit. */
  updatedAt: number
}

export type FitnessLog = Record<string, DayLog>

export const BODY_FIELDS = ['weight', 'waist', 'bodyFat', 'sleep', 'restingHr', 'calories', 'protein'] as const
export type BodyField = (typeof BODY_FIELDS)[number]

export const BODY_LABELS: Record<BodyField, { label: string; unit: string }> = {
  weight: { label: 'Weight', unit: 'lb' },
  waist: { label: 'Waist', unit: 'in' },
  bodyFat: { label: 'Body fat', unit: '%' },
  sleep: { label: 'Sleep', unit: 'h' },
  restingHr: { label: 'Resting HR', unit: 'bpm' },
  calories: { label: 'Calories', unit: 'kcal' },
  protein: { label: 'Protein', unit: 'g' },
}

/** The plan's starting point (11 Oct 2026). updatedAt 1 so anything synced replaces it. */
export const SEED: FitnessLog = {
  '2026-10-11': { body: { weight: 195, waist: 36 }, notes: 'Starting point', updatedAt: 1 },
}

export const emptyRun = (): RunLog => ({ miles: null, seconds: null, hr: null, effort: null, done: false })

export { mergeLogs } from './merge'

export const isValidLog = (x: unknown): x is FitnessLog => isDatedLog(x)

/** "1:02:30" / "45:10" / "45" (minutes) → seconds. */
export function parseDuration(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return null
  const parts = t.split(':').map(Number)
  if (parts.length === 1) return parts[0] * 60
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

export function formatDuration(sec: number | null): string {
  if (sec == null) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** Minutes per mile as "9:45 /mi". */
export function formatPace(miles: number | null, seconds: number | null): string | null {
  if (!miles || !seconds) return null
  const per = Math.round(seconds / miles)
  return `${Math.floor(per / 60)}:${String(per % 60).padStart(2, '0')} /mi`
}
