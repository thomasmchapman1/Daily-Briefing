// The OKC Marathon 2027 plan: 28 weeks from Monday 12 Oct 2026 to race day,
// Sunday 25 Apr 2027. Two lifts (Mon lower, Wed upper) and three runs (Tue easy,
// Thu quality, Sat long) a week; Friday and Sunday off. Every main-lift weight
// and every run comes from the plan's week-by-week tables below.
import { addDays, daysBetween, fromIsoDate, isoDate } from '../lib/date'

export const PLAN_NAME = 'OKC Marathon 2027'
export const PLAN_START = '2026-10-12'
export const RACE_DAY = '2027-04-25'
export const PLAN_WEEKS = 28

export type Phase = 'Base' | 'Build' | 'Peak' | 'Taper'

export type LiftId =
  | 'squat'
  | 'deadlift'
  | 'rdl'
  | 'split_squat'
  | 'calf_raise'
  | 'plank'
  | 'bench'
  | 'row'
  | 'ohp'
  | 'pulldown'
  | 'curl'
  | 'triceps'

export const LIFT_NAMES: Record<LiftId, string> = {
  squat: 'Squat',
  deadlift: 'Deadlift',
  rdl: 'Romanian deadlift',
  split_squat: 'Split squat',
  calf_raise: 'Calf raise',
  plank: 'Plank',
  bench: 'Bench press',
  row: 'Barbell row',
  ohp: 'Overhead press',
  pulldown: 'Pull-ups or pulldowns',
  curl: 'Curls',
  triceps: 'Triceps pushdown',
}

/** The barbell lifts whose weights the plan sets week by week (and that get warm-up sets). */
export const MAIN_LIFTS: LiftId[] = ['squat', 'deadlift', 'bench', 'row', 'ohp', 'rdl']

export interface PlannedLift {
  id: LiftId
  name: string
  sets: number
  /** Reps per set, or seconds for a timed hold. */
  reps: number
  /** How the reps read in the plan, e.g. "8 per leg", "6–10", "50 sec". */
  repsLabel: string
  /** Planned load in lb; null for bodyweight or "pick a weight that leaves 1–2 reps". */
  weight: number | null
  /** Shown under the lift: what the weight means or how to progress it. */
  note?: string
  /** Ramp sets before the work sets, as [weight, reps]. */
  warmup?: [number, number][]
}

export interface PlannedRun {
  kind: 'easy' | 'quality' | 'long' | 'race'
  title: string
  /** Planned distance in miles when the plan states one. */
  miles: number | null
  detail: string
  optional?: boolean
}

export type SessionKind = 'lift' | 'run' | 'rest' | 'race' | 'before' | 'after'

export interface Session {
  date: string
  /** 1–28, or null outside the plan. */
  week: number | null
  phase: Phase | null
  kind: SessionKind
  title: string
  subtitle: string
  lifts: PlannedLift[]
  run?: PlannedRun
  notes: string[]
}

interface WeekRow {
  squat: number | null
  deadlift: number | null
  bench: number | null
  row: number | null
  ohp: number | null
  tue: number | null
  thu: string | null
  sat: string | null
  /** Planned long run and weekly total, as the plan's data log gives them. */
  long: number
  total: number
  note?: string
}

// prettier-ignore
const WEEKS: WeekRow[] = [
  /* 1  Oct 12 */ { squat: 155, deadlift: null, bench: 105, row: 85, ohp: null, tue: null, thu: null, sat: '3 optional', long: 3, total: 3, note: 'Field week: one full-body lift on Tuesday' },
  /* 2  Oct 19 */ { squat: 160, deadlift: 195, bench: 110, row: 85, ohp: 55, tue: 3, thu: '4 easy + strides', sat: '5', long: 5, total: 12 },
  /* 3  Oct 26 */ { squat: 165, deadlift: 200, bench: 115, row: 90, ohp: 55, tue: 4, thu: '4 easy + strides', sat: '6', long: 6, total: 14 },
  /* 4  Nov 2  */ { squat: 150, deadlift: 185, bench: 105, row: 80, ohp: 50, tue: 3, thu: '3 easy + strides', sat: '5', long: 5, total: 11 },
  /* 5  Nov 9  */ { squat: 170, deadlift: 205, bench: 115, row: 95, ohp: 60, tue: 4, thu: '4 easy + strides', sat: '7', long: 7, total: 15 },
  /* 6  Nov 16 */ { squat: 175, deadlift: 210, bench: 120, row: 100, ohp: 60, tue: 4, thu: '5 easy + strides', sat: '8', long: 8, total: 17 },
  /* 7  Nov 23 */ { squat: 160, deadlift: 190, bench: 110, row: 90, ohp: 55, tue: 3, thu: '4 easy + strides', sat: '6', long: 6, total: 13 },
  /* 8  Nov 30 */ { squat: 180, deadlift: 215, bench: 120, row: 105, ohp: 65, tue: 4, thu: '5 easy + strides', sat: '9', long: 9, total: 18 },
  /* 9  Dec 7  */ { squat: 185, deadlift: 220, bench: 125, row: 110, ohp: 65, tue: 5, thu: '5 easy + strides', sat: '10', long: 10, total: 20 },
  /* 10 Dec 14 */ { squat: 165, deadlift: 200, bench: 115, row: 95, ohp: 55, tue: 4, thu: '4 easy + strides', sat: '7', long: 7, total: 15 },
  /* 11 Dec 21 */ { squat: 190, deadlift: 225, bench: 125, row: 115, ohp: 70, tue: 5, thu: '6 easy + strides', sat: '11', long: 11, total: 22 },
  /* 12 Dec 28 */ { squat: 195, deadlift: 230, bench: 130, row: 120, ohp: 70, tue: 6, thu: '6 easy + strides', sat: '12', long: 12, total: 24 },
  /* 13 Jan 4  */ { squat: 175, deadlift: 205, bench: 120, row: 105, ohp: 60, tue: 4, thu: '5 easy + strides', sat: '8', long: 8, total: 17, note: 'Base phase done: test your 5-rep maxes this week' },
  /* 14 Jan 11 */ { squat: 195, deadlift: 235, bench: 130, row: 120, ohp: 70, tue: 6, thu: '2 easy, 20 min tempo, 2 easy', sat: '13', long: 13, total: 26, note: 'Tempo runs start' },
  /* 15 Jan 18 */ { squat: 200, deadlift: 240, bench: 135, row: 125, ohp: 75, tue: 6, thu: '2 easy, 25 min tempo, 2 easy', sat: '14', long: 14, total: 28 },
  /* 16 Jan 25 */ { squat: 180, deadlift: 215, bench: 120, row: 110, ohp: 65, tue: 5, thu: '5 easy + strides', sat: '10', long: 10, total: 20 },
  /* 17 Feb 1  */ { squat: 200, deadlift: 240, bench: 135, row: 125, ohp: 75, tue: 7, thu: '2 easy, 5 × 800 hard, 2 easy', sat: '15', long: 15, total: 30, note: 'Hold these lifting weights through week 21' },
  /* 18 Feb 8  */ { squat: 200, deadlift: 245, bench: 135, row: 130, ohp: 75, tue: 8, thu: '2 easy, 30 min tempo, 1.5 easy', sat: '16', long: 16, total: 32 },
  /* 19 Feb 15 */ { squat: 180, deadlift: 220, bench: 120, row: 115, ohp: 65, tue: 6, thu: '6 easy + strides', sat: '11, or 10K tune-up race', long: 11, total: 23, note: '10K tune-up race sets your goal marathon pace' },
  /* 20 Feb 22 */ { squat: 200, deadlift: 245, bench: 135, row: 130, ohp: 75, tue: 8, thu: '2 easy, 6 × 800 hard, 2 easy', sat: '17', long: 17, total: 33 },
  /* 21 Mar 1  */ { squat: 200, deadlift: 245, bench: 135, row: 130, ohp: 75, tue: 8, thu: '2 easy, 35 min tempo, 2 easy', sat: '18', long: 18, total: 35 },
  /* 22 Mar 8  */ { squat: 180, deadlift: 220, bench: 120, row: 115, ohp: 65, tue: 6, thu: '7 easy + strides', sat: '12', long: 12, total: 25 },
  /* 23 Mar 15 */ { squat: 190, deadlift: 235, bench: 135, row: 130, ohp: 75, tue: 8, thu: '2.5 easy, 4 at marathon pace, 2.5 easy', sat: '18', long: 18, total: 35, note: 'Peak: 2 sets per lift. Test your 5-rep maxes this week' },
  /* 24 Mar 22 */ { squat: 190, deadlift: 225, bench: 135, row: 130, ohp: 75, tue: 8, thu: '2.5 easy, 30 min tempo, 2.5 easy', sat: '20 (peak)', long: 20, total: 37, note: '2 sets per lift; 20-mile peak run Saturday' },
  /* 25 Mar 29 */ { squat: 180, deadlift: 205, bench: 125, row: 120, ohp: 70, tue: 6, thu: '2 easy, 20 min tempo, 2 easy', sat: '16, last 6 at marathon pace', long: 16, total: 30, note: '2 sets per lift' },
  /* 26 Apr 5  */ { squat: 145, deadlift: 175, bench: 95, row: 95, ohp: 55, tue: 6, thu: '6 easy + strides', sat: '12', long: 12, total: 24, note: 'Taper: 2 light sets, no new heavy loads' },
  /* 27 Apr 12 */ { squat: 135, deadlift: 155, bench: 90, row: 85, ohp: 50, tue: 4, thu: '4 easy + strides', sat: '8', long: 8, total: 16, note: 'Taper: 2 light sets, no new heavy loads' },
  /* 28 Apr 19 */ { squat: null, deadlift: null, bench: null, row: null, ohp: null, tue: 3, thu: '3 easy + 4 strides', sat: null, long: 26.2, total: 32.2, note: 'Race week: no lifting, rest and walk' },
]

const CUTBACK_WEEKS = new Set([4, 7, 10, 13, 16, 19, 22])

export function phaseOf(week: number): Phase {
  if (week <= 13) return 'Base'
  if (week <= 22) return 'Build'
  if (week <= 25) return 'Peak'
  return 'Taper'
}

export const isCutback = (week: number) => CUTBACK_WEEKS.has(week)

export interface WeekPlan {
  week: number
  start: string
  phase: Phase
  cutback: boolean
  plannedLong: number
  plannedTotal: number
  note?: string
}

export const PLAN: WeekPlan[] = WEEKS.map((w, i) => ({
  week: i + 1,
  start: isoDate(addDays(fromIsoDate(PLAN_START), i * 7)),
  phase: phaseOf(i + 1),
  cutback: isCutback(i + 1),
  plannedLong: w.long,
  plannedTotal: w.total,
  note: w.note,
}))

/** Plan week (1–28) for a date, or null before the start / after race week. */
export function weekOf(date: Date): number | null {
  const d = daysBetween(fromIsoDate(PLAN_START), date)
  if (d < 0) return null
  const week = Math.floor(d / 7) + 1
  return week <= PLAN_WEEKS ? week : null
}

const roundTo5 = (n: number) => Math.round(n / 5) * 5

/** 3 ramp sets at about 40%, 60% and 80% of the work weight for 5, 3 and 2 reps; never below the empty bar. */
export function warmupSets(work: number): [number, number][] {
  return ([
    [0.4, 5],
    [0.6, 3],
    [0.8, 2],
  ] as const).map(([pct, reps]) => [Math.max(45, roundTo5(work * pct)), reps])
}

/** Work sets for a lift that the plan gives 3 sets: one-third fewer on cutbacks, 2 from the peak on. */
function setsFor(week: number, base: number): number {
  if (base === 1) return 1
  if (week >= 23 || isCutback(week)) return Math.max(1, base - Math.ceil(base / 3))
  return base
}

function plankSeconds(week: number): number {
  return Math.min(60, 40 + 10 * (week - 1))
}

function lift(
  id: LiftId,
  week: number,
  baseSets: number,
  reps: number,
  weight: number | null,
  extra: Partial<PlannedLift> = {},
): PlannedLift {
  const main = MAIN_LIFTS.includes(id) && weight != null
  return {
    id,
    name: LIFT_NAMES[id],
    sets: setsFor(week, baseSets),
    reps,
    repsLabel: String(reps),
    weight,
    ...(main ? { warmup: warmupSets(weight) } : {}),
    ...extra,
  }
}

function liftA(week: number, w: WeekRow): PlannedLift[] {
  return [
    lift('squat', week, 3, 5, w.squat),
    lift('deadlift', week, 1, 5, w.deadlift),
    lift('split_squat', week, 3, 8, 25, { repsLabel: '8 per leg', note: 'Dumbbell in each hand. Add 5 lb per hand when every rep is clean.' }),
    lift('calf_raise', week, 3, 12, null, { note: 'Bodyweight on a step. Add a 25 lb dumbbell when it feels easy.' }),
    lift('plank', week, 3, plankSeconds(week), null, { repsLabel: `${plankSeconds(week)} sec` }),
  ]
}

function liftB(week: number, w: WeekRow): PlannedLift[] {
  return [
    lift('bench', week, 3, 5, w.bench),
    lift('row', week, 3, 8, w.row),
    lift('ohp', week, 3, 8, w.ohp),
    lift('pulldown', week, 3, 8, 110, { repsLabel: '6–10', note: 'Pulldown at 110 lb, or pull-ups once you can do 6. Add 5 lb when every rep is clean.' }),
    lift('curl', week, 2, 12, 20, { note: '20 lb dumbbells.' }),
    lift('triceps', week, 2, 12, 40),
  ]
}

/** One full-body lift for weeks when only one day is free (week 1 is one). */
export function fieldDay(week: number, rdlWeight = 135): PlannedLift[] {
  const w = WEEKS[week - 1]
  return [
    lift('squat', week, 3, 5, w.squat),
    lift('bench', week, 3, 5, w.bench),
    lift('rdl', week, 3, 8, rdlWeight, { note: 'Add 10 lb each field day, up to 185 lb.' }),
    lift('row', week, 3, 8, w.row),
    lift('plank', week, 3, plankSeconds(week), null, { repsLabel: `${plankSeconds(week)} sec` }),
  ]
}

const STRIDES = '6 × 20 s fast but relaxed, with 60–90 s of walking or jogging between, at the end.'
const EASY = 'Conversational pace: you can speak full sentences (heart-rate zone 2).'
const TEMPO = 'Tempo is comfortably hard: a pace you could hold for about an hour.'
const INTERVALS = 'Each 800 m at about 5K effort with a 400 m jog between.'
const MARATHON_PACE = 'Goal marathon pace comes from your February 10K, not from guessing.'
const LONG =
  'Easy pace, first 2 miles slower. After 75 minutes take 30–60 g of carbs an hour plus fluids and electrolytes; practise your race fuel.'

function qualityRun(text: string): PlannedRun {
  const easy = text.match(/^(\d+(?:\.\d+)?) easy \+ (\d+ )?strides$/)
  if (easy) {
    const n = easy[2] ? easy[2].trim() : '6'
    return {
      kind: 'quality',
      title: `${easy[1]} mi easy + strides`,
      miles: Number(easy[1]),
      detail: `${EASY} Then ${STRIDES.replace(/^6/, n)}`,
    }
  }
  const detail = /800/.test(text) ? INTERVALS : /marathon pace/.test(text) ? MARATHON_PACE : TEMPO
  const miles = text.match(/\d+(?:\.\d+)?(?= easy| at marathon)/g)?.reduce((a, b) => a + Number(b), 0) ?? null
  return { kind: 'quality', title: text.replace(/(\d) easy/g, '$1 mi easy').replace(/^./, (c) => c.toUpperCase()), miles: /min/.test(text) || /800/.test(text) ? null : miles, detail }
}

function longRun(text: string): PlannedRun {
  const miles = Number(text.match(/^\d+(?:\.\d+)?/)?.[0])
  if (/optional/.test(text)) return { kind: 'easy', title: `${miles} mi easy (optional)`, miles, detail: EASY, optional: true }
  const extra = text.replace(/^\d+(?:\.\d+)?/, '').replace(/^,\s*/, '').replace(/^\s*\((.*)\)$/, '$1')
  return {
    kind: 'long',
    title: `${miles} mi long run${extra ? `, ${extra}` : ''}`,
    miles,
    detail: /10K/.test(text) ? `${LONG} Or race a 10K with a warm-up and cool-down; that result sets your marathon pace.` : LONG,
  }
}

const REST_NOTES: Record<number, string> = {
  5: 'Friday is a rest day. Sleep 7+ hours and keep protein at 160–180 g.',
  0: 'Sunday is always off.',
}

/** Today's session from the plan. Day of week: Mon lift A, Tue easy, Wed lift B, Thu quality, Fri off, Sat long, Sun off. */
export function getSession(date: Date): Session {
  const iso = isoDate(date)
  const week = weekOf(date)
  const dow = date.getDay()
  const base = { date: iso, lifts: [] as PlannedLift[], notes: [] as string[] }

  if (week == null) {
    if (daysBetween(fromIsoDate(PLAN_START), date) < 0) {
      return { ...base, week: null, phase: null, kind: 'before', title: 'Plan starts Monday 12 October', subtitle: '28 weeks to the OKC Marathon' }
    }
    return {
      ...base,
      week: null,
      phase: null,
      kind: 'after',
      title: 'Recovery',
      subtitle: 'The marathon plan is complete',
      notes: ['Easy walking and short easy runs for two weeks. Keep logging your weight and waist.'],
    }
  }

  const w = WEEKS[week - 1]
  const phase = phaseOf(week)
  const weekLabel = `Week ${week} of ${PLAN_WEEKS} · ${phase}${isCutback(week) ? ' · cutback' : ''}`
  const notes = w.note ? [w.note] : []
  const rest = (why?: string): Session => ({
    ...base,
    week,
    phase,
    kind: 'rest',
    title: 'Rest day',
    subtitle: weekLabel,
    notes: [...new Set([why, ...notes].filter((n): n is string => Boolean(n)))],
  })

  if (iso === RACE_DAY) {
    return {
      ...base,
      week,
      phase,
      kind: 'race',
      title: 'OKC Marathon',
      subtitle: 'Race day · 26.2 miles',
      run: { kind: 'race', title: 'OKC Marathon, 26.2 mi', miles: 26.2, detail: 'Start slower than goal pace for the first miles, fuel every 30–45 minutes from early on, and run your own race.' },
      notes,
    }
  }

  // Week 1 is a field week: one full-body lift on Tuesday, an optional easy 3 on Saturday.
  if (week === 1) {
    if (dow === 2) return { ...base, week, phase, kind: 'lift', title: 'Field-day lift', subtitle: weekLabel, lifts: fieldDay(1), notes }
    if (dow === 6) return { ...base, week, phase, kind: 'run', title: 'Easy run', subtitle: weekLabel, run: longRun(w.sat!), notes }
    return rest(REST_NOTES[dow])
  }

  switch (dow) {
    case 1:
      if (w.squat == null) return rest('Race week: no lifting. Rest and walk.')
      return { ...base, week, phase, kind: 'lift', title: 'Lift A · Lower body', subtitle: weekLabel, lifts: liftA(week, w), notes }
    case 2:
      return {
        ...base,
        week,
        phase,
        kind: 'run',
        title: 'Easy run',
        subtitle: weekLabel,
        run: { kind: 'easy', title: `${w.tue} mi easy`, miles: w.tue, detail: EASY },
        notes,
      }
    case 3:
      if (w.bench == null) return rest('Race week: no lifting. Rest and walk.')
      return { ...base, week, phase, kind: 'lift', title: 'Lift B · Upper body', subtitle: weekLabel, lifts: liftB(week, w), notes }
    case 4:
      return { ...base, week, phase, kind: 'run', title: week >= 14 ? 'Quality run' : 'Easy run + strides', subtitle: weekLabel, run: qualityRun(w.thu!), notes }
    case 6:
      if (w.sat == null) return rest('Rest before Sunday’s race. Lay out your kit and fuel.')
      return { ...base, week, phase, kind: 'run', title: 'Long run', subtitle: weekLabel, run: longRun(w.sat), notes }
    default:
      return rest(REST_NOTES[dow])
  }
}
