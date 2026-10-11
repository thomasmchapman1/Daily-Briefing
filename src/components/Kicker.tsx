import type { ReactNode } from 'react'

export function Kicker({ label, meta }: { label: ReactNode; meta?: ReactNode }) {
  return (
    <div className="kicker-row">
      <span className="kicker">{label}</span>
      {meta != null && <span className="kicker-meta">{meta}</span>}
    </div>
  )
}

/** Hairline-ruled placeholder rows, shown only before anything has ever loaded. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  )
}
