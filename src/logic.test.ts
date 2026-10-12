import { describe, expect, it } from 'vitest'
import { issueLabel } from './components/Masthead'
import { dayOfYear, toRoman, clockTime } from './lib/date'
import { buildToday, dailyVerseSettings, displayReference, getPlanDay, streak } from './scripture'
import { splitReference } from './scripture/refs'
import type { Passage } from './scripture/types'
import { firstHourIndex, toForecast, type OpenMeteo } from './weather/api'
import { compass } from './weather/summary'
import { DEFAULT_PROGRAM, getWorkout, normalizeProgram, parsePlanText, planPrompt } from './workout'

describe('dates', () => {
  it('numbers the masthead', () => {
    expect(dayOfYear(new Date(2026, 9, 11))).toBe(284)
    expect(toRoman(2026 - 1984)).toBe('XLII')
    expect(clockTime(new Date(2026, 9, 11, 16, 0))).toBe('4:00')
    expect(clockTime(new Date(2026, 9, 11, 0, 5))).toBe('12:05')
  })
})

describe('masthead issue numbers', () => {
  it('starts at Vol. I, No. 1 on 12 October 2026', () => {
    expect(issueLabel(new Date(2026, 9, 11))).toBe('Vol. I · Preview')
    expect(issueLabel(new Date(2026, 9, 12))).toBe('Vol. I · No. 1')
    expect(issueLabel(new Date(2026, 9, 13))).toBe('Vol. I · No. 2')
    expect(issueLabel(new Date(2027, 9, 11))).toBe('Vol. I · No. 365')
    expect(issueLabel(new Date(2027, 9, 12))).toBe('Vol. II · No. 366')
  })
})

describe('scripture', () => {
  const verse = (y: number, m: number, d: number) => getPlanDay(new Date(y, m, d), dailyVerseSettings(new Date(y, m, d), 'kjv'))

  it('picks the verse by calendar date, every year', () => {
    expect(verse(2026, 0, 1).references).toEqual(['Genesis 1:1'])
    expect(verse(2026, 11, 25).references).toEqual(['Luke 2:11'])
    expect(verse(2027, 11, 31).references).toEqual(['Revelation 22:20'])
    expect(verse(2028, 11, 25).references).toEqual(['Luke 2:11'])
    expect(verse(2026, 9, 12).planDay).toBe(285)
  })

  it('repeats 28 February on 29 February', () => {
    expect(verse(2028, 1, 29).references).toEqual(verse(2028, 1, 28).references)
    expect(verse(2028, 2, 1).references).toEqual(verse(2026, 2, 1).references)
  })

  it('shows a verse of the day in full', () => {
    const passage: Passage = {
      reference: 'Romans 8:38–39',
      book: 'Romans',
      translation: 'KJV',
      verses: [
        { chapter: 8, verse: 38, text: 'For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,' },
        { chapter: 8, verse: 39, text: 'Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.' },
      ],
    }
    const today = buildToday(1, ['Romans 8:38–39'], [passage], 'verse')
    expect(today.excerpt.endsWith('Christ Jesus our Lord.')).toBe(true)
    expect(today.attribution).toBe('Romans 8:38–39 · KJV')
    expect(verse(2026, 0, 1).kind).toBe('verse')
  })

  it('names a single psalm "Psalm"', () => {
    expect(displayReference('Psalms 23:1')).toBe('Psalm 23:1')
    expect(displayReference('Psalms 121:1–2')).toBe('Psalm 121:1–2')
    expect(displayReference('Psalms 99–101')).toBe('Psalms 99–101')
    expect(displayReference('John 3:16')).toBe('John 3:16')
  })

  it('splits references into fetchable pieces', () => {
    expect(splitReference('Psalms 52–54')).toEqual(['Psalms 52', 'Psalms 53', 'Psalms 54'])
    expect(splitReference('Exodus 11; Exodus 12:1–21')).toEqual(['Exodus 11', 'Exodus 12:1-21'])
    expect(splitReference('Luke 1:39–80')).toEqual(['Luke 1:39-80'])
    expect(splitReference('Song of Solomon 3')).toEqual(['Song of Solomon 3'])
  })

  it('builds excerpt and attribution', () => {
    const psalm: Passage = {
      reference: 'Psalm 23',
      book: 'Psalms',
      translation: 'KJV',
      verses: [
        { chapter: 23, verse: 1, text: 'The LORD is my shepherd; I shall not want.' },
        { chapter: 23, verse: 2, text: 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.' },
        { chapter: 23, verse: 3, text: 'He restoreth my soul: he leadeth me in the paths of righteousness for his name’s sake.' },
        { chapter: 23, verse: 4, text: 'Yea, though I walk through the valley…' },
      ],
    }
    const today = buildToday(284, ['Psalm 23'], [psalm])
    expect(today.excerpt).toBe(
      'The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul.',
    )
    expect(today.attribution).toBe('Psalm 23:1–3 · KJV · about 1 min')
  })

  it('counts the streak', () => {
    const log = { '2026-10-08': true, '2026-10-09': true, '2026-10-10': true } as const
    const today = new Date(2026, 9, 11)
    expect(streak(log, today)).toBe(3)
    expect(streak({ ...log, '2026-10-11': true }, today)).toBe(4)
    expect(streak({ '2026-10-01': true }, today)).toBe(0)
  })
})

describe('workout', () => {
  it('computes week and day from the start date', () => {
    const w = getWorkout(new Date(2026, 9, 11), '2026-09-04')
    expect([w.week, w.day, w.title, w.exercises.length]).toEqual([6, 3, 'Lower body', 4])
    expect(w.exercises[0].spec).toBe('4 × 6 · 185 lb')
    expect(getWorkout(new Date(2026, 9, 12), '2026-09-04').rest).toBe(false)
    expect(getWorkout(new Date(2026, 9, 10), '2026-09-04').rest).toBe(true)
  })
})

describe('training plan edits', () => {
  it('cleans an edited plan: blank exercises dropped, 7 days a week, rest days named', () => {
    const p = normalizeProgram({
      name: ' Strength ',
      weeks: [{ days: [{ title: '', minutes: 40.4, exercises: [{ name: ' Squat ', spec: '5 × 5' }, { name: '  ', spec: 'x' }] }, { title: '', minutes: 30, exercises: [] }] }],
    })
    expect(p.name).toBe('Strength')
    expect(p.weeks[0].days).toHaveLength(7)
    expect(p.weeks[0].days[0]).toEqual({ title: 'Workout', minutes: 40, exercises: [{ name: 'Squat', spec: '5 × 5' }] })
    expect(p.weeks[0].days[1]).toEqual({ title: 'Rest day', minutes: 0, exercises: [] })
    expect(p.weeks[0].days[6].title).toBe('Rest day')
  })

  it('falls back to the bundled plan when nothing usable is stored', () => {
    expect(normalizeProgram(null)).toBe(DEFAULT_PROGRAM)
    expect(normalizeProgram({ weeks: [] })).toBe(DEFAULT_PROGRAM)
  })

  it('follows an edited plan, looping over its weeks', () => {
    const p = normalizeProgram({ weeks: [{ days: [{ title: 'Run', minutes: 30, exercises: [{ name: 'Easy run', spec: '5 km' }] }] }] })
    expect(getWorkout(new Date(2026, 9, 12), '2026-10-12', p)).toMatchObject({ week: 1, day: 1, title: 'Run', rest: false })
    expect(getWorkout(new Date(2026, 9, 19), '2026-10-12', p)).toMatchObject({ week: 1, day: 1, title: 'Run' })
    expect(getWorkout(new Date(2026, 9, 13), '2026-10-12', p).rest).toBe(true)
  })
})

describe('importing a plan from a Claude chat', () => {
  const plan = { name: 'Upper/lower', weeks: [{ days: [{ title: 'Upper', minutes: 45, exercises: [{ name: 'Bench', spec: '3 × 8' }] }, { title: 'Rest day', minutes: 0, exercises: [] }] }] }

  it('finds the plan in a reply with a code block and other text', () => {
    const reply = `Here's your plan!\n\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\nLet me know if you want changes.`
    const parsed = parsePlanText(reply)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.program.name).toBe('Upper/lower')
      expect(parsed.program.weeks[0].days).toHaveLength(7)
      expect(parsed.program.weeks[0].days[0].exercises).toEqual([{ name: 'Bench', spec: '3 × 8' }])
    }
  })

  it('accepts bare JSON, or just a list of weeks', () => {
    expect(parsePlanText(JSON.stringify(plan)).ok).toBe(true)
    expect(parsePlanText(`Sure: ${JSON.stringify(plan.weeks)}`).ok).toBe(true)
  })

  it('explains what is wrong', () => {
    expect(parsePlanText('Sounds good, I will write it next.')).toMatchObject({ ok: false, error: expect.stringMatching(/No plan found/) })
    expect(parsePlanText('```json\n{"weeks": [{"days": [\n```')).toMatchObject({ ok: false, error: expect.stringMatching(/cut off/) })
    expect(parsePlanText('{"name": "x"}')).toMatchObject({ ok: false, error: expect.stringMatching(/weeks/) })
    expect(parsePlanText('{"weeks": [{"days": [{"title": "Rest day", "exercises": []}]}]}')).toMatchObject({ ok: false, error: expect.stringMatching(/no exercises/) })
  })

  it('writes a prompt that names the first weekday and can carry the current plan', () => {
    const prompt = planPrompt('2026-10-12', normalizeProgram(plan))
    expect(prompt).toContain('Day 1 is a Monday')
    expect(prompt).toContain('"name":"Upper/lower"')
    expect(planPrompt('2026-10-12')).not.toContain('current plan')
    // The format example in the prompt is itself a valid plan.
    expect(parsePlanText(planPrompt('2026-10-12')).ok).toBe(true)
  })
})

describe('weather', () => {
  const hours = Array.from({ length: 48 }, (_, i) => `2026-10-${i < 24 ? 11 : 12}T${String(i % 24).padStart(2, '0')}:00`)
  const data: OpenMeteo = {
    current: { time: '2026-10-11T07:15', temperature_2m: 57.6, weather_code: 2, wind_speed_10m: 6.2, wind_direction_10m: 315 },
    hourly: {
      time: hours,
      temperature_2m: hours.map((_, i) => 40 + (i % 24)),
      precipitation_probability: hours.map(() => 10),
      weather_code: hours.map(() => 2),
      cloud_cover: hours.map((_, i) => (i % 24 < 11 ? 70 : 20)),
    },
    daily: { time: ['2026-10-11'], temperature_2m_max: [64.2], temperature_2m_min: [46.8], precipitation_probability_max: [10] },
  }

  it('starts the hourly strip at the next whole hour, every two hours', () => {
    expect(data.hourly.time[firstHourIndex(data)]).toBe('2026-10-11T08:00')
    expect(toForecast(data).hours.map((h) => h.label)).toEqual(['8a', '10a', '12p', '2p', '4p', '6p'])
  })

  it('keeps the current hour when exactly on it', () => {
    expect(firstHourIndex({ ...data, current: { ...data.current, time: '2026-10-11T08:00' } })).toBe(8)
  })

  it('summarises the forecast', () => {
    const f = toForecast(data)
    expect([f.temp, f.condition, f.high, f.low, f.rain]).toEqual([58, 'Partly cloudy', 64, 47, 10])
    expect(f.summary).toBe('A light-jacket morning. Clouds thin by noon and the afternoon stays dry; wind from the northwest at 6 mph.')
    expect(compass(0)).toBe('north')
  })
})
