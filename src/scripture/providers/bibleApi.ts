// bible-api.com: public-domain translations, no key required.
import type { Passage, TextProvider } from '../types'

interface BibleApiResponse {
  reference: string
  verses: { book_name: string; chapter: number; verse: number; text: string }[]
  translation_id: string
}

export const bibleApi: TextProvider = {
  id: 'bible-api',
  translations: {
    kjv: 'KJV',
    web: 'WEB',
    asv: 'ASV',
    bbe: 'BBE',
    ylt: 'YLT',
  },
  async fetchPassage(ref, translation, signal): Promise<Passage> {
    const query = ref.replace(/[–—]/g, '-').toLowerCase()
    const res = await fetch(`https://bible-api.com/${encodeURIComponent(query)}?translation=${translation}`, { signal })
    if (!res.ok) throw new Error(`bible-api ${res.status}`)
    const json = (await res.json()) as BibleApiResponse
    return {
      reference: ref,
      book: json.verses[0]?.book_name ?? ref,
      verses: json.verses.map((v) => ({ chapter: v.chapter, verse: v.verse, text: v.text.replace(/\s+/g, ' ').trim() })),
      translation: this.translations[translation] ?? translation.toUpperCase(),
    }
  },
}
