// Merging and validating the fitness log. No imports, so the server (server/sync.ts) can share it.

export type DatedLog = Record<string, { updatedAt: number }>

/** Per-day merge: the newer record wins. */
export function mergeLogs<L extends DatedLog>(a: L, b: L): L {
  const out: DatedLog = { ...a }
  for (const [date, day] of Object.entries(b)) {
    if (!out[date] || day.updatedAt > out[date].updatedAt) out[date] = day
  }
  return out as L
}

export function isDatedLog(x: unknown): x is DatedLog {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false
  return Object.entries(x).every(
    ([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && v != null && typeof v === 'object' && typeof (v as { updatedAt?: unknown }).updatedAt === 'number',
  )
}

/**
 * One week from Garmin's weekly email reports (Monday to Sunday, like the plan's weeks).
 * Garmin only emails weekly totals, so this sits beside the daily log instead of in it.
 */
export interface GarminWeek {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string
  runs: number
  miles: number
  /** Total running time. */
  seconds: number | null
  /** Average resting heart rate for the week. */
  restingHr: number | null
  /** ms since epoch when it was imported. */
  importedAt: number
}

export type GarminWeeks = Record<string, GarminWeek>

const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const isNumOrNull = (v: unknown) => v === null || isNum(v)

export function isGarminWeek(x: unknown): x is GarminWeek {
  const w = x as GarminWeek
  return (
    !!w &&
    typeof w === 'object' &&
    typeof w.weekStart === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(w.weekStart) &&
    isNum(w.runs) &&
    isNum(w.miles) &&
    isNumOrNull(w.seconds) &&
    isNumOrNull(w.restingHr) &&
    isNum(w.importedAt)
  )
}

export function isGarminWeeks(x: unknown): x is GarminWeeks {
  return !!x && typeof x === 'object' && !Array.isArray(x) && Object.entries(x).every(([k, w]) => isGarminWeek(w) && w.weekStart === k)
}

/** Weeks are keyed by their Monday, so importing a week again replaces it rather than adding a copy. */
export function upsertGarminWeeks(existing: GarminWeeks, incoming: GarminWeek[]): GarminWeeks {
  const out = { ...existing }
  for (const w of incoming) out[w.weekStart] = w
  return out
}
