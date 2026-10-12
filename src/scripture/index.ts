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
const EXCERPT_MAX_CHARS = 170

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

/** First clause of a verse, closed with a full stop: "He restoreth my soul." */
function firstClause(text: string): string {
  const m = text.match(/^(.+?)[:;,]\s/)
  return m ? `${m[1]}.` : text
}

/**
 * The first 2–3 verses for the pull quote. A verse that would make the quote
 * too long is cut to its first clause, as in the design ("…He restoreth my soul.").
 */
function excerptOf(p: Passage): { text: string; count: number } {
  const parts: string[] = []
  let length = 0
  for (const v of p.verses.slice(0, 3)) {
    if (parts.length === 0 || length + v.text.length + 1 <= EXCERPT_MAX_CHARS) {
      parts.push(v.text)
      length += v.text.length + 1
      continue
    }
    const clause = firstClause(v.text)
    if (clause !== v.text && length + clause.length + 1 <= EXCERPT_MAX_CHARS + 30) parts.push(clause)
    break
  }
  return { text: parts.join(' '), count: parts.length }
}

export function buildToday(planDay: number, references: string[], passages: Passage[]): ScriptureToday {
  const words = passages.reduce((s, p) => s + p.verses.reduce((w, v) => w + v.text.split(' ').length, 0), 0)
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  const first = passages[0]
  const { text: excerpt, count } = first && first.verses.length ? excerptOf(first) : { text: '', count: 0 }
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
