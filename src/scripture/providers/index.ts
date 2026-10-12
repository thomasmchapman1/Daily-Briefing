import type { TextProvider } from '../types'
import { bibleApi } from './bibleApi'

// To add a source (e.g. api.esv.org or API.Bible), implement TextProvider in a
// new file and list it here. The first provider serving a translation wins.
export const PROVIDERS: TextProvider[] = [bibleApi]

export function providerFor(translation: string): TextProvider {
  return PROVIDERS.find((p) => translation in p.translations) ?? bibleApi
}

export function allTranslations(): { id: string; label: string }[] {
  return PROVIDERS.flatMap((p) => Object.entries(p.translations).map(([id, label]) => ({ id, label })))
}

export function fetchPassage(ref: string, translation: string, signal?: AbortSignal) {
  return providerFor(translation).fetchPassage(ref, translation, signal)
}
