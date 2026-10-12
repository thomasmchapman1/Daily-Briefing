// Small SVG charts for the progress page: a time-series line chart and a
// planned-vs-actual column chart. Thin marks, hairline grid, hover/tap tooltips.
import { useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { daysBetween, fromIsoDate } from '../lib/date'

const INK_MUTED = 'var(--color-neutral-700)'
const GRID = 'var(--color-neutral-300)'
export const SERIES = 'var(--color-accent-600)'
export const REFERENCE = 'var(--color-neutral-500)'
const PLANNED_FILL = 'var(--color-neutral-300)'
const SURFACE = 'var(--color-bg)'

function useWidth(fallback = 428) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Round tick values covering [min, max], about `count` of them. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1
    max += 1
  }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

const fmtDate = (iso: string) => fromIsoDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export interface LineSeries {
  id: string
  label: string
  points: { date: string; value: number }[]
  /** line: 2px line with an end dot; dots: daily readings; reference: thin neutral line (plan, goal). */
  style: 'line' | 'dots' | 'reference'
}

interface LineChartProps {
  title: string
  series: LineSeries[]
  from: string
  to: string
  unit: string
  digits?: number
  height?: number
  /** Horizontal reference, e.g. the goal. */
  goal?: { value: number; label: string }
  legend?: ReactNode
}

export function LineChart({ title, series, from, to, unit, digits = 1, height = 190, goal, legend }: LineChartProps) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<string | null>(null)
  const m = { top: 12, right: 12, bottom: 22, left: 36 }
  const iw = width - m.left - m.right
  const ih = height - m.top - m.bottom
  const span = Math.max(1, daysBetween(fromIsoDate(from), fromIsoDate(to)))

  const values = series.flatMap((s) => s.points.map((p) => p.value)).concat(goal ? [goal.value] : [])
  const ticks = niceTicks(Math.min(...values), Math.max(...values))
  const y0 = ticks[0]
  const y1 = ticks.at(-1)!
  const x = (iso: string) => m.left + (daysBetween(fromIsoDate(from), fromIsoDate(iso)) / span) * iw
  const y = (v: number) => m.top + ih - ((v - y0) / (y1 - y0 || 1)) * ih

  // First of each month, thinned so labels don't collide.
  const months: string[] = []
  const d0 = fromIsoDate(from)
  for (let d = new Date(d0.getFullYear(), d0.getMonth() + 1, 1); d <= fromIsoDate(to); d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }
  const every = Math.ceil(months.length / Math.max(1, Math.floor(iw / 44)))

  const allDates = [...new Set(series.flatMap((s) => (s.style === 'reference' ? [] : s.points.map((p) => p.date))))].sort()
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    if (!allDates.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left + m.left
    const nearest = allDates.reduce((a, d) => (Math.abs(x(d) - px) < Math.abs(x(a) - px) ? d : a))
    setHover(nearest)
  }

  const path = (pts: { date: string; value: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
  const hoverRows = hover
    ? series.flatMap((s) => {
        const p = s.points.find((q) => q.date === hover)
        return p && s.style !== 'reference' ? [{ s, p }] : []
      })
    : []

  return (
    <figure className="chart" ref={ref}>
      <figcaption className="chart-title">{title}</figcaption>
      {legend}
      <div className="chart-plot">
        <svg width={width} height={height} role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="chart-tick">
                {t}
              </text>
            </g>
          ))}
          {months.map((iso, i) =>
            i % every ? null : (
              <text key={iso} x={x(iso)} y={height - 6} textAnchor="middle" className="chart-tick">
                {fromIsoDate(iso).toLocaleDateString('en-GB', { month: 'short' })}
              </text>
            ),
          )}
          {goal && (
            <g>
              <line x1={m.left} x2={width - m.right} y1={y(goal.value)} y2={y(goal.value)} stroke={REFERENCE} strokeWidth={1} />
              <text x={width - m.right} y={y(goal.value) - 5} textAnchor="end" className="chart-tick">
                {goal.label}
              </text>
            </g>
          )}
          {series.map((s) =>
            s.style === 'dots' ? (
              <g key={s.id}>
                {s.points.map((p) => (
                  <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={2.5} fill={SERIES} opacity={0.45} />
                ))}
              </g>
            ) : s.points.length ? (
              <g key={s.id}>
                <path
                  d={path(s.points)}
                  fill="none"
                  stroke={s.style === 'reference' ? REFERENCE : SERIES}
                  strokeWidth={s.style === 'reference' ? 1 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {s.style === 'line' && (
                  <circle cx={x(s.points.at(-1)!.date)} cy={y(s.points.at(-1)!.value)} r={4} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
                )}
              </g>
            ) : null,
          )}
          {hover && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ih} stroke={INK_MUTED} strokeWidth={1} />
              {hoverRows.map(({ s, p }) => (
                <circle key={s.id} cx={x(p.date)} cy={y(p.value)} r={4} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
              ))}
            </g>
          )}
          <rect
            x={m.left}
            y={m.top}
            width={iw}
            height={ih}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hover && hoverRows.length > 0 && (
          <div className="chart-tip" style={{ left: Math.min(Math.max(x(hover), 70), width - 70) }}>
            <div className="chart-tip-date">{fmtDate(hover)}</div>
            {hoverRows.map(({ s, p }) => (
              <div key={s.id} className="tnum">
                {s.label}: {p.value.toFixed(digits)} {unit}
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  )
}

export function Legend({ items }: { items: { label: string; kind: 'line' | 'dot' | 'reference' | 'bar' | 'planned' }[] }) {
  return (
    <div className="chart-legend">
      {items.map((it) => (
        <span key={it.label} className="chart-legend-item">
          <span className={`swatch swatch--${it.kind}`} aria-hidden="true" />
          {it.label}
        </span>
      ))}
    </div>
  )
}

export interface ColumnDatum {
  key: string
  label: string
  planned: number
  actual: number
  /** Marks the current week. */
  current?: boolean
  tip: string
}

/** Planned (wide, light) with actual (narrow, accent) inside it, one column per week. */
export function PlanColumns({ title, data, unit, height = 170, legend }: { title: string; data: ColumnDatum[]; unit: string; height?: number; legend?: ReactNode }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const m = { top: 12, right: 4, bottom: 22, left: 30 }
  const iw = width - m.left - m.right
  const ih = height - m.top - m.bottom
  const ticks = niceTicks(0, Math.max(1, ...data.map((d) => Math.max(d.planned, d.actual))))
  const top = ticks.at(-1)!
  const slot = iw / data.length
  const bw = Math.min(24, Math.max(4, slot - 2))
  const aw = Math.max(2, bw * 0.5)
  const y = (v: number) => m.top + ih - (v / top) * ih
  const r = (w: number) => Math.min(4, w / 2)
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(iw / 26)))
  // The current week is always labelled; regular labels next to it are dropped so they don't collide.
  const currentIndex = data.findIndex((d) => d.current)
  const near = (i: number) => currentIndex >= 0 && Math.abs(i - currentIndex) < labelEvery && i !== currentIndex

  // Rounded top, square at the baseline.
  const bar = (cx: number, w: number, v: number) => {
    const x0 = cx - w / 2
    const yy = y(v)
    const rr = Math.min(r(w), (m.top + ih - yy) / 1)
    if (v <= 0) return ''
    return `M${x0},${m.top + ih}V${yy + rr}Q${x0},${yy} ${x0 + rr},${yy}H${x0 + w - rr}Q${x0 + w},${yy} ${x0 + w},${yy + rr}V${m.top + ih}Z`
  }

  return (
    <figure className="chart" ref={ref}>
      <figcaption className="chart-title">{title}</figcaption>
      {legend}
      <div className="chart-plot">
        <svg width={width} height={height} role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="chart-tick">
                {t}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = m.left + slot * (i + 0.5)
            return (
              <g key={d.key}>
                <path d={bar(cx, bw, d.planned)} fill={PLANNED_FILL} />
                <path d={bar(cx, aw, d.actual)} fill={SERIES} />
                {(d.current || (i % labelEvery === 0 && !near(i))) && (
                  <text x={cx} y={height - 6} textAnchor="middle" className={`chart-tick${d.current ? ' chart-tick--current' : ''}`}>
                    {d.label}
                  </text>
                )}
                <rect
                  x={cx - slot / 2}
                  y={m.top}
                  width={slot}
                  height={ih}
                  fill={hover === i ? 'color-mix(in srgb, var(--color-text) 5%, transparent)' : 'transparent'}
                  onPointerEnter={() => setHover(i)}
                  onPointerDown={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                />
              </g>
            )
          })}
        </svg>
        {hover != null && (
          <div className="chart-tip" style={{ left: Math.min(Math.max(m.left + slot * (hover + 0.5), 80), width - 80) }}>
            <div className="chart-tip-date">{data[hover].tip}</div>
            <div className="tnum">
              Planned {data[hover].planned} {unit}
            </div>
            <div className="tnum">
              Actual {Math.round(data[hover].actual * 10) / 10} {unit}
            </div>
          </div>
        )}
      </div>
    </figure>
  )
}
