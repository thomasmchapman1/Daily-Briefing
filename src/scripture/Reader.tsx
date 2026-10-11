import { Sheet } from '../components/Sheet'
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
        passages.map((p) => (
          <article key={p.reference}>
            <h2 className="reader-heading">{p.reference}</h2>
            <p className="reader-text">
              {p.verses.map((v, i) => (
                <span key={`${v.chapter}:${v.verse}`}>
                  {i > 0 && ' '}
                  <sup>{v.verse}</sup>
                  {v.text}
                </span>
              ))}
            </p>
          </article>
        ))
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
