import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../books'
import plan from './verse-a-day.json'

describe('verse-a-day plan', () => {
  const days = Object.entries(plan.days)

  it('has one reference for each of 365 days, none repeated', () => {
    expect(days.map(([d]) => Number(d))).toEqual(Array.from({ length: 365 }, (_, i) => i + 1))
    expect(days.every(([, refs]) => refs.length === 1)).toBe(true)
    expect(new Set(days.map(([, [ref]]) => ref)).size).toBe(365)
  })

  it('only points at real books and chapters', () => {
    const chapters = new Map(CHAPTERS)
    for (const [, [ref]] of days) {
      const m = ref.match(/^(.+) (\d+):(\d+)(?:–(\d+))?$/)
      expect(m, ref).not.toBeNull()
      const [, book, chapter, from, to] = m!
      expect(chapters.get(book), ref).toBeGreaterThanOrEqual(Number(chapter))
      if (to) expect(Number(to), ref).toBeGreaterThan(Number(from))
    }
  })

  it('pins New Year, Christmas and New Year’s Eve', () => {
    expect(plan.days['1']).toEqual(['Genesis 1:1'])
    expect(plan.days['359']).toEqual(['Luke 2:11'])
    expect(plan.days['365']).toEqual(['Revelation 22:20'])
  })
})
