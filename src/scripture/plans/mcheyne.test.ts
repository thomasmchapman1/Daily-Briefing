// Checks the M'Cheyne plan really is the whole Bible in a year: every Old
// Testament chapter once, every New Testament and Psalms chapter twice, with
// split chapters covered verse for verse.
import { describe, expect, it } from 'vitest'
import { splitReference } from '../refs'
import plan from './mcheyne.json'

const CHAPTERS: [string, number][] = [
  ['Genesis', 50], ['Exodus', 40], ['Leviticus', 27], ['Numbers', 36], ['Deuteronomy', 34], ['Joshua', 24],
  ['Judges', 21], ['Ruth', 4], ['1 Samuel', 31], ['2 Samuel', 24], ['1 Kings', 22], ['2 Kings', 25],
  ['1 Chronicles', 29], ['2 Chronicles', 36], ['Ezra', 10], ['Nehemiah', 13], ['Esther', 10], ['Job', 42],
  ['Psalms', 150], ['Proverbs', 31], ['Ecclesiastes', 12], ['Song of Solomon', 8], ['Isaiah', 66],
  ['Jeremiah', 52], ['Lamentations', 5], ['Ezekiel', 48], ['Daniel', 12], ['Hosea', 14], ['Joel', 3],
  ['Amos', 9], ['Obadiah', 1], ['Jonah', 4], ['Micah', 7], ['Nahum', 3], ['Habakkuk', 3], ['Zephaniah', 3],
  ['Haggai', 2], ['Zechariah', 14], ['Malachi', 4],
  ['Matthew', 28], ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28], ['Romans', 16],
  ['1 Corinthians', 16], ['2 Corinthians', 13], ['Galatians', 6], ['Ephesians', 6], ['Philippians', 4],
  ['Colossians', 4], ['1 Thessalonians', 5], ['2 Thessalonians', 3], ['1 Timothy', 6], ['2 Timothy', 4],
  ['Titus', 3], ['Philemon', 1], ['Hebrews', 13], ['James', 5], ['1 Peter', 5], ['2 Peter', 3],
  ['1 John', 5], ['2 John', 1], ['3 John', 1], ['Jude', 1], ['Revelation', 22],
]
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
