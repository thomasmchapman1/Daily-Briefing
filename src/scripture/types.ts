/** Settings the scripture module needs. Lives in the app's settings object. */
export interface ScriptureSettings {
  /** Plan id; resolves to plans/<id>.json */
  plan: string
  /** Local date (YYYY-MM-DD) that is day 1 of the plan. */
  planStart: string
  /** Translation id understood by a registered text provider, e.g. "kjv". */
  translation: string
}

/** plans/<id>.json */
export interface ReadingPlan {
  id: string
  name: string
  /** Day number (1-based, as a string key) → passage references. */
  days: Record<string, string[]>
}

export interface Verse {
  chapter: number
  verse: number
  text: string
}

export interface Passage {
  /** Reference as requested, e.g. "Luke 15:11–32". */
  reference: string
  /** Book name as returned by the provider, e.g. "Psalms" → used for attributions. */
  book: string
  verses: Verse[]
  /** Short translation label, e.g. "KJV". */
  translation: string
}

/** Result of getToday(): everything the Scripture section renders. */
export interface ScriptureToday {
  planDay: number
  references: string[]
  /** First 2–3 verses of the first passage, whitespace-normalised, no quotes. */
  excerpt: string
  /** e.g. "Psalm 23:1–3 · KJV · about 6 min" */
  attribution: string
  minutes: number
  /** Full text of every reference, for the reader view. */
  passages: Passage[]
}

/** Adapter for a source of Bible text. See providers/ for implementations. */
export interface TextProvider {
  id: string
  /** Translations this provider serves: id → display label. */
  translations: Record<string, string>
  fetchPassage(ref: string, translation: string, signal?: AbortSignal): Promise<Passage>
}
