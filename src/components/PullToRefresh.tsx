import { RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// Damped pull distance (px) that triggers a refresh.
const THRESHOLD = 60
const MAX_PULL = 100

/**
 * Pull-to-refresh for the standalone PWA, where iOS offers none.
 * Shows a Lucide refresh glyph while pulling and while `refreshing` is true.
 */
export function PullToRefresh({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  const [pull, setPull] = useState(0)
  const startY = useRef<number | null>(null)
  const pullRef = useRef(0)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      startY.current = window.scrollY <= 0 && !document.querySelector('.sheet') ? e.touches[0].clientY : null
    }
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return
      const dy = e.touches[0].clientY - startY.current
      const next = dy > 0 ? Math.min(MAX_PULL, dy * 0.5) : 0
      pullRef.current = next
      setPull(next)
    }
    const onEnd = () => {
      if (startY.current != null && pullRef.current >= THRESHOLD) {
        onRefreshRef.current()
      }
      startY.current = null
      pullRef.current = 0
      setPull(0)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  const visible = pull > 8 || refreshing
  if (!visible) return null
  return (
    <div className="ptr" role="status" aria-live="polite" style={{ transform: `translateY(${refreshing ? 0 : pull / 3}px)` }}>
      <RotateCw
        size={18}
        strokeWidth={1.5}
        className={refreshing ? 'ptr-spin' : undefined}
        style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)`, opacity: Math.min(1, pull / THRESHOLD) }}
        aria-label={refreshing ? 'Refreshing' : 'Pull to refresh'}
      />
    </div>
  )
}
