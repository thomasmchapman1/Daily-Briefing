import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  label: string
  /** Right side of the top bar. */
  aside?: ReactNode
  onClose: () => void
  children: ReactNode
}

/** Full-screen overlay used by settings. */
export function Sheet({ label, aside, onClose, children }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
      <div className="page">
        <div className="sheet-bar">
          <button ref={closeRef} className="icon-btn" onClick={onClose}>
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" /> Briefing
          </button>
          {aside}
        </div>
        {children}
      </div>
    </div>
  )
}
