// Derived numbers for the progress page: averages, rates, estimated maxes, mileage.
import { addDays, daysBetween, fromIsoDate } from '../lib/date'
import type { BodyField, FitnessLog } from './log'
import type { GarminWeeks } from './merge'
import { PLAN, PLAN_START, weekOf, type LiftId } from './plan'

export interface Point {
  date: string
  value: number
}

export function bodySeries(log: FitnessLog, field: BodyField): Point[] {
  return Object.entries(log)
    .flatMap(([date, day]) => {
      const v = day.body?.[field]
      return typeof v === 'number' && Number.isFinite(v) ? [{ date, value: v }] : []
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Trailing average over the last `days` calendar days (inclusive) at each point. */
export function movingAverage(points: Point[], days = 7): Point[] {
  return points.map((p, i) => {
    const end = fromIsoDate(p.date)
    let sum = 0
    let n = 0
    for (let j = i; j >= 0; j--) {
      if (daysBetween(fromIsoDate(points[j].date), end) >= days) break
      sum += points[j].value
      n++
    }
    return { date: p.date, value: sum / n }
  })
}

function meanBetween(points: Point[], from: Date, to: Date): number | null {
  const inRange = points.filter((p) => {
    const d = fromIsoDate(p.date)
    return d >= from && d <= to
  })
  return inRange.length ? inRange.reduce((a, p) => a + p.value, 0) / inRange.length : null
}

/**
 * Weekly change judged on 2-week averages, as the plan asks: the mean of the last
 * 14 days against the 14 days before, halved. Positive is a loss. Null without
 * weigh-ins in both windows.
 */
export function weeklyLoss(points: Point[], today: Date): number | null {
  const recent = meanBetween(points, addDays(today, -13), today)
  const before = meanBetween(points, addDays(today, -27), addDays(today, -14))
  if (recent == null || before == null) return null
  return (before - recent) / 2
}

/** Epley estimate of a one-rep max. Sets over 10 reps aren't used: the estimate drifts. */
export function estimatedMax(weight: number, reps: number): number {
  if (reps <= 1) return weight
  return weight * (1 + reps / 30)
}

export interface LiftPoint {
  date: string
  /** Heaviest set that day. */
  top: { w: number; r: number }
  /** Best estimated 1RM from that day's sets. */
  e1rm: number
}

export function liftHistory(log: FitnessLog, id: LiftId): LiftPoint[] {
  const out: LiftPoint[] = []
  for (const [date, day] of Object.entries(log)) {
    const sets = (day.lifts?.[id]?.sets ?? []).filter((s): s is { w: number; r: number } => s.w != null && s.r != null && s.r > 0 && s.w > 0)
    if (!sets.length) continue
    const top = sets.reduce((a, s) => (s.w > a.w || (s.w === a.w && s.r > a.r) ? s : a))
    const e1rm = Math.max(...sets.filter((s) => s.r <= 10).map((s) => estimatedMax(s.w, s.r)), 0)
    out.push({ date, top, e1rm })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** The most recent logged sets for a lift before a date, to prefill and to show "last time". */
export function lastSets(log: FitnessLog, id: LiftId, before: string) {
  const dates = Object.keys(log)
    .filter((d) => d < before && log[d].lifts?.[id]?.sets.some((s) => s.r != null))
    .sort()
  const date = dates.at(-1)
  return date ? { date, sets: log[date].lifts![id]!.sets } : null
}

export interface RunPoint {
  date: string
  miles: number
  seconds: number | null
  hr: number | null
  effort: number | null
}

export function runHistory(log: FitnessLog): RunPoint[] {
  return Object.entries(log)
    .flatMap(([date, day]) =>
      day.run?.miles ? [{ date, miles: day.run.miles, seconds: day.run.seconds, hr: day.run.hr, effort: day.run.effort }] : [],
    )
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface WeekMiles {
  week: number
  start: string
  planned: number
  /** Miles counted for the week: the larger of the logged runs and Garmin's total, never both. */
  actual: number
  /** Miles from runs logged in the app. */
  logged: number
  /** Garmin's weekly total, when an email report was imported for this week. */
  garmin: number | null
  plannedLong: number
  actualLong: number
}

/**
 * Logged runs and Garmin's weekly report describe the same runs, so a week counts
 * whichever is larger rather than adding them: a run logged in the app and also
 * recorded by the watch is counted once, and one you forgot to log still counts.
 */
export function weekActual(logged: number, garmin: number | null): number {
  return Math.max(logged, garmin ?? 0)
}

export function weeklyMiles(log: FitnessLog, garmin: GarminWeeks = {}): WeekMiles[] {
  const runs = runHistory(log)
  return PLAN.map((w) => {
    const inWeek = runs.filter((r) => weekOf(fromIsoDate(r.date)) === w.week)
    const logged = inWeek.reduce((a, r) => a + r.miles, 0)
    const g = garmin[w.start]?.miles ?? null
    return {
      week: w.week,
      start: w.start,
      planned: w.plannedTotal,
      actual: weekActual(logged, g),
      logged,
      garmin: g,
      plannedLong: w.plannedLong,
      actualLong: Math.max(0, ...inWeek.map((r) => r.miles)),
    }
  })
}

/** Garmin's weekly average resting heart rate, oldest first, as points on each week's Monday. */
export function garminRestingHr(garmin: GarminWeeks): Point[] {
  return Object.values(garmin)
    .flatMap((w) => (w.restingHr != null ? [{ date: w.weekStart, value: w.restingHr }] : []))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * The plan's straight line for weight: from the start (195 lb on 11 Oct) down to
 * the goal by 4 April, then holding through race day.
 */
export function plannedWeight(date: Date, start: number, goal: number): number {
  const from = addDays(fromIsoDate(PLAN_START), -1)
  const reach = fromIsoDate('2027-04-04')
  const t = Math.min(1, Math.max(0, daysBetween(from, date) / daysBetween(from, reach)))
  return start + (goal - start) * t
}

export interface Advice {
  tone: 'good' | 'warning'
  text: string
}

/** The plan's adjustment rules, applied to the weigh-ins. */
export function nutritionAdvice(weights: Point[], today: Date): Advice | null {
  const now = weeklyLoss(weights, today)
  if (now == null) return null
  const slowFor3Weeks = [0, 7, 14].every((back) => {
    const r = weeklyLoss(weights, addDays(today, -back))
    return r != null && r < 0.3
  })
  if (slowFor3Weeks) {
    return { tone: 'warning', text: 'Weight loss has been under 0.3 lb a week for three weeks. Trim about 150–200 calories a day.' }
  }
  if (now > 1) {
    return { tone: 'warning', text: `You’re losing ${now.toFixed(1)} lb a week, faster than 1 lb. Add some food: fast loss costs muscle and slows recovery.` }
  }
  if (now >= 0.5) return { tone: 'good', text: `Losing ${now.toFixed(1)} lb a week, inside the plan’s 0.5–1 lb range.` }
  return { tone: 'good', text: `Losing ${now.toFixed(1)} lb a week on 2-week averages. The plan aims for 0.5–1 lb; give it time before changing calories.` }
}

export function latest(points: Point[]): Point | null {
  return points.at(-1) ?? null
}
