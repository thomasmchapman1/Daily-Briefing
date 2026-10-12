import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  label: string
  /** Right side of the top bar. */
  aside?: ReactNode
  /** Text on the back button, naming where it goes. */
  backLabel?: string
  onClose: () => void
  children: ReactNode
}

/** Full-screen overlay used by settings and the training plan editor; sheets can stack. */
export function Sheet({ label, aside, backLabel = 'Briefing', onClose, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Escape closes only the topmost sheet.
    const onKey = (e: KeyboardEvent) => {
      const sheets = document.querySelectorAll('.sheet')
      if (e.key === 'Escape' && sheets[sheets.length - 1] === sheetRef.current) onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])

  return (
    <div ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-label={label}>
      <div className="page">
        <div className="sheet-bar">
          <button ref={closeRef} className="icon-btn" onClick={onClose}>
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" /> {backLabel}
          </button>
          {aside}
        </div>
        {children}
      </div>
    </div>
  )
}
