// Your current maxes and run fitness, which the plan's weights and paces are worked out from.
// Update them after a test (the plan tests 5-rep maxes in January and March) and every
// week of the plan recalculates.

export interface Profile {
  /** One-rep maxes in lb. */
  benchMax: number
  squatMax: number
  deadliftMax: number
  /** Best recent 2-mile time, in seconds. */
  twoMileSeconds: number
}

/** As of 27 Oct 2026: bench 165, squat 185, deadlift 245; 2 miles in 15:28 (800 m split 3:36). */
export const DEFAULT_PROFILE: Profile = {
  benchMax: 165,
  squatMax: 185,
  deadliftMax: 245,
  twoMileSeconds: 15 * 60 + 28,
}

/**
 * The maxes the plan's week-by-week weight table was written for. Squat, bench and
 * deadlift scale by your max over these, and the Romanian deadlift follows the deadlift.
 */
export const TABLE_MAXES = { bench: 135, squat: 200, deadlift: 260 }

/** The plan's strength targets, as a share of the max they were set from (155/135, 225/200, 275/260). */
const TARGET_GAIN = { bench: 155 / 135, squat: 225 / 200, deadlift: 275 / 260 }

export const roundTo5 = (n: number) => Math.round(n / 5) * 5

export function liftRatios(p: Profile) {
  return {
    bench: p.benchMax / TABLE_MAXES.bench,
    squat: p.squatMax / TABLE_MAXES.squat,
    deadlift: p.deadliftMax / TABLE_MAXES.deadlift,
  }
}

export function strengthTargets(p: Profile) {
  return {
    bench: roundTo5(p.benchMax * TARGET_GAIN.bench),
    squat: roundTo5(p.squatMax * TARGET_GAIN.squat),
    deadlift: roundTo5(p.deadliftMax * TARGET_GAIN.deadlift),
  }
}

// ---------- Running paces (Jack Daniels' VDOT formulas) ----------

const MILE = 1609.344

/** Oxygen cost (ml/kg/min) of running at v metres per minute. */
const vo2At = (v: number) => -4.6 + 0.182258 * v + 0.000104 * v * v

/** Share of VO2max that can be held for a race lasting t minutes. */
const sustainable = (t: number) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t)

/** VDOT from a race: distance in metres, time in seconds. */
export function vdot(metres: number, seconds: number): number {
  const t = seconds / 60
  return vo2At(metres / t) / sustainable(t)
}

/** Speed (m/min) whose oxygen cost is `vo2`. */
function speedFor(vo2: number): number {
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - vo2
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
}

/** Predicted race time in seconds for a distance, from a VDOT. */
export function predictRace(v: number, metres: number): number {
  let lo = 1
  let hi = 600
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (vo2At(metres / mid) / sustainable(mid) > v) lo = mid
    else hi = mid
  }
  return ((lo + hi) / 2) * 60
}

/** Seconds per mile at a given share of VDOT. */
const paceAt = (v: number, share: number) => (MILE / speedFor(v * share)) * 60

export interface Paces {
  vdot: number
  /** Seconds per mile, fast end then slow end. */
  easy: [number, number]
  /** Tempo (threshold): comfortably hard, about an hour's race effort. */
  tempo: number
  /** Interval pace per mile, and the time for each 800 m at it. */
  interval: number
  interval800: number
  /** Marathon pace predicted from the 2-mile; provisional until the February 10K. */
  marathon: number
  marathonTime: number
}

export function pacesFor(p: Profile): Paces {
  const v = vdot(2 * MILE, p.twoMileSeconds)
  const interval = paceAt(v, 0.98)
  const marathonTime = predictRace(v, 42195)
  return {
    vdot: v,
    easy: [paceAt(v, 0.7), paceAt(v, 0.62)],
    tempo: paceAt(v, 0.88),
    interval,
    interval800: (interval * 800) / MILE,
    marathon: marathonTime / (42195 / MILE),
    marathonTime,
  }
}

/** 572 → "9:32". Rounded to 5 seconds: a pace isn't held more finely than that. */
export function formatPaceSeconds(sec: number, step = 5): string {
  const s = Math.round(sec / step) * step
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
