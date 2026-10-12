import { Sheet } from '../components/Sheet'
import { displayReference } from './refs'
import type { Passage } from './types'

interface Props {
  references: string[]
  passages: Passage[] | null
  onClose: () => void
}

/** Full-text reader for today's passages. */
export function Reader({ references, passages, onClose }: Props) {
  return (
    <Sheet label="Today’s reading" aside={<span className="kicker">Scripture</span>} onClose={onClose}>
      {passages ? (
        passages.map((p) => {
          // Readings like "Psalms 52–54" span chapters: label each chapter's first verse "53:1".
          const multiChapter = p.verses.some((v) => v.chapter !== p.verses[0]?.chapter)
          return (
            <article key={p.reference}>
              <h2 className="reader-heading">{displayReference(p.reference)}</h2>
              <p className="reader-text">
                {p.verses.map((v, i) => {
                  const newChapter = multiChapter && (i === 0 || p.verses[i - 1].chapter !== v.chapter)
                  return (
                    <span key={`${v.chapter}:${v.verse}`}>
                      {i > 0 && ' '}
                      <sup>{newChapter ? `${v.chapter}:${v.verse}` : v.verse}</sup>
                      {v.text}
                    </span>
                  )
                })}
              </p>
            </article>
          )
        })
      ) : (
        <>
          <h2 className="reader-heading">{references.join(' · ')}</h2>
          <p className="section-error">The text couldn’t be loaded. Check your connection and pull to refresh.</p>
        </>
      )}
      {passages?.[0] && <p className="reader-foot">{passages[0].translation}</p>}
    </Sheet>
  )
}
