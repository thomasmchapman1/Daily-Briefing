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
  about?: string
  /** "reading" (default): passages to read, shown as an excerpt. "verse": one verse a day, shown in full. */
  kind?: 'reading' | 'verse'
  /**
   * "repeat": the plan follows the calendar (day 1 = 1 January in a common
   * year), so 29 February repeats the day before and 31 December stays last.
   */
  leapDay?: 'repeat'
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
  kind: 'reading' | 'verse'
  planDay: number
  references: string[]
  /** Reading: first 2–3 verses of the first passage. Verse: the whole verse. Whitespace-normalised, no quotes. */
  excerpt: string
  /** e.g. "Psalm 23:1–3 · KJV · about 6 min", or "John 3:16 · KJV" for a verse */
  attribution: string
  minutes: number
  /** Full text of every reference. */
  passages: Passage[]
}

/** Adapter for a source of Bible text. See providers/ for implementations. */
export interface TextProvider {
  id: string
  /** Translations this provider serves: id → display label. */
  translations: Record<string, string>
  fetchPassage(ref: string, translation: string, signal?: AbortSignal): Promise<Passage>
}
