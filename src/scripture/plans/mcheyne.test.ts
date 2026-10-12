// Checks the M'Cheyne plan really is the whole Bible in a year: every Old
// Testament chapter once, every New Testament and Psalms chapter twice, with
// split chapters covered verse for verse.
import { describe, expect, it } from 'vitest'
import { splitReference } from '../refs'
import { CHAPTERS } from '../books'
import plan from './mcheyne.json'

const NEW_TESTAMENT_FROM = CHAPTERS.findIndex(([b]) => b === 'Matthew')

describe("M'Cheyne plan", () => {
  const days = Object.entries(plan.days)

  it('has 365 days of four readings', () => {
    expect(days.map(([d]) => Number(d))).toEqual(Array.from({ length: 365 }, (_, i) => i + 1))
    expect(days.every(([, refs]) => refs.length === 4)).toBe(true)
  })

  it('reads the Old Testament once and the New Testament and Psalms twice', () => {
    const whole = new Map<string, number>()
    const partial = new Map<string, [number, number][]>()
    for (const [, refs] of days) {
      for (const piece of refs.flatMap(splitReference)) {
        const m = piece.match(/^(.+) (\d+)(?::(\d+)(?:-(\d+))?)?$/)
        expect(m, piece).not.toBeNull()
        const [, book, chapter, v1, v2] = m!
        const key = `${book} ${chapter}`
        if (v1) partial.set(key, [...(partial.get(key) ?? []), [Number(v1), Number(v2 ?? v1)]])
        else whole.set(key, (whole.get(key) ?? 0) + 1)
      }
    }
    CHAPTERS.forEach(([book, count], i) => {
      const times = i >= NEW_TESTAMENT_FROM || book === 'Psalms' ? 2 : 1
      for (let c = 1; c <= count; c++) {
        const key = `${book} ${c}`
        const pieces = partial.get(key)
        if (pieces) {
          // Split chapters: the pieces must start at verse 1 and join up, `times` times over.
          const starts = pieces.filter(([a]) => a === 1).length
          expect(starts + (whole.get(key) ?? 0), key).toBe(times)
        } else expect(whole.get(key) ?? 0, key).toBe(times)
      }
    })
    expect([...whole.keys(), ...partial.keys()].every((k) => CHAPTERS.some(([b, n]) => k.startsWith(`${b} `) && Number(k.slice(b.length + 1)) <= n))).toBe(true)
  })
})
