// Scripture module. The rest of the app only uses this file's exports and
// ScriptureSection; plan, translation and text source are all swappable.
import { daysBetween, fromIsoDate } from '../lib/date'
import { getPlan } from './plans'
import { fetchPassage } from './providers'
import type { Passage, ScriptureSettings, ScriptureToday } from './types'

export type { ScriptureSettings, ScriptureToday, Passage } from './types'
export { PLANS } from './plans'
export { allTranslations } from './providers'
export { loadReadLog, setRead, streak } from './history'

const WORDS_PER_MINUTE = 130
const EXCERPT_MAX_CHARS = 240

/** Plan day and references for a date. Synchronous, works offline. */
export function getPlanDay(date: Date, settings: ScriptureSettings): { planDay: number; references: string[] } {
  const plan = getPlan(settings.plan)
  const length = Object.keys(plan.days).length
  const elapsed = daysBetween(fromIsoDate(settings.planStart), date)
  const planDay = (((elapsed % length) + length) % length) + 1
  return { planDay, references: plan.days[String(planDay)] ?? [] }
}

function singular(book: string): string {
  return book === 'Psalms' ? 'Psalm' : book
}

function verseSpan(p: Passage, count: number): string {
  const vs = p.verses.slice(0, count)
  const first = vs[0]
  const last = vs[vs.length - 1]
  const book = singular(p.book)
  if (first.chapter !== last.chapter) return `${book} ${first.chapter}:${first.verse}–${last.chapter}:${last.verse}`
  if (first.verse === last.verse) return `${book} ${first.chapter}:${first.verse}`
  return `${book} ${first.chapter}:${first.verse}–${last.verse}`
}

/** Pick the first 2–3 verses, staying short enough for the pull quote. */
function excerptCount(p: Passage): number {
  let count = Math.min(3, p.verses.length)
  const len = (n: number) => p.verses.slice(0, n).reduce((s, v) => s + v.text.length + 1, 0)
  while (count > 2 && len(count) > EXCERPT_MAX_CHARS) count--
  if (count === 2 && len(2) > EXCERPT_MAX_CHARS * 1.5) count = 1
  return Math.max(count, 1)
}

export function buildToday(planDay: number, references: string[], passages: Passage[]): ScriptureToday {
  const words = passages.reduce((s, p) => s + p.verses.reduce((w, v) => w + v.text.split(' ').length, 0), 0)
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  const first = passages[0]
  const count = first && first.verses.length ? excerptCount(first) : 0
  const excerpt = count ? first.verses.slice(0, count).map((v) => v.text).join(' ') : ''
  const attribution = count ? `${verseSpan(first, count)} · ${first.translation} · about ${minutes} min` : ''
  return { planDay, references, excerpt, attribution, minutes, passages }
}

/** Today's reading with text. Rejects if the text provider can't be reached. */
export async function getToday(date: Date, settings: ScriptureSettings, signal?: AbortSignal): Promise<ScriptureToday> {
  const { planDay, references } = getPlanDay(date, settings)
  const passages = await Promise.all(references.map((r) => fetchPassage(r, settings.translation, signal)))
  return buildToday(planDay, references, passages)
}

/** Cache key: a reading is valid for one date + plan + translation. */
export function scriptureKey(date: string, s: ScriptureSettings): string {
  return `${date}|${s.plan}|${s.planStart}|${s.translation}`
}
