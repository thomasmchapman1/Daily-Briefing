import type { SectionState } from '../useBriefing'
import type { Forecast } from '../weather/types'
import { Kicker, Skeleton } from './Kicker'

export function WeatherSection({ state }: { state: SectionState<Forecast> }) {
  const w = state.data
  return (
    <section className="section" aria-label="Weather">
      <Kicker label="Weather" />
      {w ? (
        <>
          <div className="wx-row">
            <div className="wx-temp">{w.temp}°</div>
            <div className="wx-side">
              <div className="wx-cond">{w.condition}</div>
              <div className="wx-meta">
                High {w.high}° · Low {w.low}° · Rain {w.rain}%
              </div>
            </div>
          </div>
          <p className="wx-summary">{w.summary}</p>
          <div className="wx-hours">
            {w.hours.map((h) => (
              <div className="wx-hour" key={h.label}>
                <div className="wx-hour-label">{h.label}</div>
                <div className="wx-hour-temp">{h.temp}°</div>
              </div>
            ))}
          </div>
        </>
      ) : state.error ? (
        <p className="section-error">Forecast unavailable</p>
      ) : (
        <Skeleton rows={4} />
      )}
    </section>
  )
}
