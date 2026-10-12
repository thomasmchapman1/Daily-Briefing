import { describe, expect, it } from 'vitest'
import { mergeLogs, parseDuration, formatDuration, formatPace, type FitnessLog } from './log'
import { PLAN, getSession, warmupSets, weekOf } from './plan'
import { estimatedMax, liftHistory, movingAverage, nutritionAdvice, plannedWeight, weeklyLoss, weeklyMiles } from './stats'

const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

describe('plan schedule', () => {
  it('numbers weeks from Monday 12 October and stops after race week', () => {
    expect(weekOf(day('2026-10-11'))).toBeNull()
    expect(weekOf(day('2026-10-12'))).toBe(1)
    expect(weekOf(day('2026-10-19'))).toBe(2)
    expect(weekOf(day('2027-04-25'))).toBe(28)
    expect(weekOf(day('2027-04-26'))).toBeNull()
    expect(PLAN[23].start).toBe('2027-03-22')
  })

  it('week 1 is a field week: one full-body lift on Tuesday', () => {
    expect(getSession(day('2026-10-12')).kind).toBe('rest')
    const tue = getSession(day('2026-10-13'))
    expect(tue.title).toBe('Field-day lift')
    expect(tue.lifts.map((l) => [l.id, l.sets, l.reps, l.weight])).toEqual([
      ['squat', 3, 5, 155],
      ['bench', 3, 5, 105],
      ['rdl', 3, 8, 135],
      ['row', 3, 8, 85],
      ['plank', 3, 40, null],
    ])
    expect(getSession(day('2026-10-17')).run?.optional).toBe(true)
  })

  it('gives the week’s lifting weights on Monday and Wednesday', () => {
    const mon = getSession(day('2026-10-19'))
    expect(mon.title).toBe('Lift A · Lower body')
    expect(mon.lifts.find((l) => l.id === 'squat')).toMatchObject({ sets: 3, reps: 5, weight: 160 })
    expect(mon.lifts.find((l) => l.id === 'deadlift')).toMatchObject({ sets: 1, weight: 195 })
    expect(mon.lifts.find((l) => l.id === 'plank')?.repsLabel).toBe('50 sec')
    const wed = getSession(day('2026-10-21'))
    expect(wed.lifts.map((l) => l.weight)).toEqual([110, 85, 55, 110, 20, 40])
  })

  it('cuts sets on cutback and peak weeks and drops lifting in race week', () => {
    const cut = getSession(day('2026-11-02'))
    expect(cut.subtitle).toContain('cutback')
    expect(cut.lifts.find((l) => l.id === 'squat')).toMatchObject({ sets: 2, weight: 150 })
    expect(getSession(day('2027-03-15')).lifts.find((l) => l.id === 'squat')?.sets).toBe(2)
    expect(getSession(day('2027-04-19')).kind).toBe('rest')
  })

  it('schedules the runs', () => {
    expect(getSession(day('2026-10-20')).run).toMatchObject({ kind: 'easy', miles: 3 })
    expect(getSession(day('2026-10-22')).run).toMatchObject({ title: '4 mi easy + strides', miles: 4 })
    expect(getSession(day('2027-01-14')).run?.title).toBe('2 mi easy, 20 min tempo, 2 mi easy')
    expect(getSession(day('2027-03-18')).run?.miles).toBe(9)
    expect(getSession(day('2027-03-27')).run).toMatchObject({ kind: 'long', miles: 20 })
    expect(getSession(day('2027-04-22')).run?.title).toContain('3 mi easy')
    expect(getSession(day('2027-04-24')).kind).toBe('rest')
    expect(getSession(day('2027-04-25'))).toMatchObject({ kind: 'race', title: 'OKC Marathon' })
    expect(getSession(day('2026-10-23')).kind).toBe('rest')
    expect(getSession(day('2026-10-25')).kind).toBe('rest')
  })

  it('ramps warm-ups at 40/60/80% and never below the bar', () => {
    expect(warmupSets(160)).toEqual([
      [65, 5],
      [95, 3],
      [130, 2],
    ])
    expect(warmupSets(55)[0][0]).toBe(45)
  })
})

describe('log', () => {
  it('merges by day, newer edit wins', () => {
    const a: FitnessLog = { '2026-10-12': { body: { weight: 195 }, updatedAt: 5 }, '2026-10-13': { updatedAt: 9 } }
    const b: FitnessLog = { '2026-10-12': { body: { weight: 194 }, updatedAt: 7 }, '2026-10-13': { notes: 'old', updatedAt: 1 } }
    const m = mergeLogs(a, b)
    expect(m['2026-10-12'].body?.weight).toBe(194)
    expect(m['2026-10-13'].notes).toBeUndefined()
  })

  it('parses and formats run times', () => {
    expect(parseDuration('45')).toBe(2700)
    expect(parseDuration('45:30')).toBe(2730)
    expect(parseDuration('1:02:03')).toBe(3723)
    expect(parseDuration('abc')).toBeNull()
    expect(formatDuration(3723)).toBe('1:02:03')
    expect(formatDuration(2730)).toBe('45:30')
    expect(formatPace(3, 1755)).toBe('9:45 /mi')
  })
})

describe('stats', () => {
  const pts = (pairs: [string, number][]) => pairs.map(([date, value]) => ({ date, value }))

  it('averages over the trailing 7 days', () => {
    const avg = movingAverage(pts([['2026-10-01', 200], ['2026-10-05', 198], ['2026-10-08', 196]]))
    expect(avg.map((p) => p.value)).toEqual([200, 199, 197])
  })

  it('judges weekly loss on 2-week averages and applies the plan’s rules', () => {
    const today = day('2026-11-28')
    const steady: [string, number][] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(2026, 9, 18 + i)
      steady.push([`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, 195 - i * (1.5 / 7)])
    }
    expect(weeklyLoss(pts(steady), today)).toBeCloseTo(1.5, 1)
    expect(nutritionAdvice(pts(steady), today)?.tone).toBe('warning')
    const flat = steady.map(([d]) => [d, 190] as [string, number])
    expect(nutritionAdvice(pts(flat), today)?.text).toMatch(/Trim/)
    expect(nutritionAdvice(pts(flat.slice(-5)), today)).toBeNull()
  })

  it('estimates one-rep maxes from logged sets', () => {
    expect(estimatedMax(150, 5)).toBe(175)
    const log: FitnessLog = {
      '2026-10-19': { lifts: { squat: { done: true, sets: [{ w: 160, r: 5 }, { w: 160, r: 4 }, { w: null, r: null }] } }, updatedAt: 1 },
    }
    expect(liftHistory(log, 'squat')).toEqual([{ date: '2026-10-19', top: { w: 160, r: 5 }, e1rm: 160 * (1 + 5 / 30) }])
  })

  it('totals miles by plan week', () => {
    const log: FitnessLog = {
      '2026-10-20': { run: { miles: 3, seconds: null, hr: null, effort: null, done: true }, updatedAt: 1 },
      '2026-10-24': { run: { miles: 5.5, seconds: null, hr: null, effort: null, done: true }, updatedAt: 1 },
    }
    const w2 = weeklyMiles(log)[1]
    expect(w2).toMatchObject({ week: 2, planned: 12, actual: 8.5, actualLong: 5.5 })
  })

  it('draws the plan’s weight line from the start to the goal by 4 April', () => {
    expect(plannedWeight(day('2026-10-11'), 195, 180)).toBe(195)
    expect(plannedWeight(day('2027-04-04'), 195, 180)).toBe(180)
    expect(plannedWeight(day('2027-04-20'), 195, 180)).toBe(180)
  })
})
