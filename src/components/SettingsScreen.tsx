import { useId, useState, type ReactNode } from 'react'
import { PLANS, allTranslations } from '../scripture'
import type { Settings } from '../settings'
import { geocodeCity } from '../weather/api'
import type { WeatherSource } from '../weather/types'
import { Sheet } from './Sheet'

interface Props {
  settings: Settings
  weatherSource: WeatherSource | null
  onSave: (next: Settings) => void
  onClose: () => void
}

/** A design-system .field: label above the control, optional hint below. */
function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}

const REASONS: Record<NonNullable<WeatherSource['reason']>, string> = {
  off: 'device location is turned off above',
  unsupported: 'this browser can’t share location',
  denied: 'location permission was denied',
  unavailable: 'the phone couldn’t get a location fix',
  timeout: 'the phone took too long to find its location',
}

const coord = (n: number, digits = 4) => n.toFixed(digits).replace('-', '−')

/** Shows where the last forecast's coordinates came from, so the weather can be checked. */
function WeatherSourceInfo({ source, city }: { source: WeatherSource | null; city: string }) {
  if (!source) return <span className="field-hint">No forecast has loaded yet.</span>
  const { lat, lon } = source
  const map = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`
  const updated = new Date(source.fetchedAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  return (
    <span className="field-hint" style={{ marginTop: 0 }}>
      {source.from === 'device' ? (
        <>
          From this device’s location: {coord(lat)}, {coord(lon)}
          {source.accuracy != null && ` (within ${Math.round(source.accuracy)} m)`}.
        </>
      ) : (
        <>
          From the saved city, {city}: {coord(lat)}, {coord(lon)}. Device location wasn’t used because{' '}
          {REASONS[source.reason ?? 'off']}.
        </>
      )}{' '}
      <a href={map} target="_blank" rel="noreferrer">
        Show on map
      </a>
      <br />
      {source.gridLat != null && source.gridLon != null && (
        <>
          Open-Meteo grid point {coord(source.gridLat, 2)}, {coord(source.gridLon, 2)}
          {source.timezone && ` · ${source.timezone}`} ·{' '}
        </>
      )}
      updated {updated}.
    </span>
  )
}

export function SettingsScreen({ settings, weatherSource, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(settings)
  const [lookup, setLookup] = useState<string | null>(null)
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const findCity = async () => {
    setLookup('Looking up…')
    try {
      const hit = await geocodeCity(draft.city)
      if (!hit) return setLookup('No place found with that name.')
      setDraft((d) => ({ ...d, city: hit.city, lat: hit.lat, lon: hit.lon }))
      setLookup(`Found ${hit.city} (${hit.lat.toFixed(2)}, ${hit.lon.toFixed(2)}).`)
    } catch {
      setLookup('Lookup failed. Check your connection.')
    }
  }

  return (
    <Sheet label="Settings" aside={<span className="sheet-title">Settings</span>} onClose={onClose}>
      <form
        className="settings"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(draft)
          onClose()
        }}
      >
        <Field
          label="City"
          hint={lookup ?? `Shown on the masthead; used for weather when location is off or denied. (${draft.lat.toFixed(2)}, ${draft.lon.toFixed(2)})`}
        >
          {(id) => (
            <span className="field-row">
              <input id={id} className="input" value={draft.city} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" />
              <button type="button" className="btn btn-secondary btn-nowrap" onClick={findCity}>
                Look up
              </button>
            </span>
          )}
        </Field>
        <div className="field">
          <label className="checkbox">
            <input type="checkbox" checked={draft.useDeviceLocation} onChange={(e) => set('useDeviceLocation', e.target.checked)} />
            Use this device’s location for weather
          </label>
        </div>
        <div className="field">
          <label>Last forecast came from</label>
          <WeatherSourceInfo source={weatherSource} city={settings.city} />
        </div>
        <Field
          label="Calendar link (iCal)"
          hint="Google Calendar: Settings → your calendar → Secret address in iCal format. iCloud: share the calendar publicly and copy the link."
        >
          {(id) => (
            <input
              id={id}
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              value={draft.icsUrl}
              onChange={(e) => set('icsUrl', e.target.value.trim())}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          )}
        </Field>
        <Field label="Reading plan">
          {(id) => (
            <select id={id} className="input" value={draft.plan} onChange={(e) => set('plan', e.target.value)}>
              {Object.values(PLANS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Plan start date" hint="Day 1 of the reading plan. Your streak is kept if you change this.">
          {(id) => (
            <input id={id} className="input" type="date" value={draft.planStart} onChange={(e) => e.target.value && set('planStart', e.target.value)} />
          )}
        </Field>
        <Field label="Translation">
          {(id) => (
            <select id={id} className="input" value={draft.translation} onChange={(e) => set('translation', e.target.value)}>
              {allTranslations().map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Training programme start" hint="Week 1, Day 1 of the training programme.">
          {(id) => (
            <input
              id={id}
              className="input"
              type="date"
              value={draft.programStart}
              onChange={(e) => e.target.value && set('programStart', e.target.value)}
            />
          )}
        </Field>
        <div style={{ paddingTop: 20 }}>
          <button type="submit" className="btn btn-primary btn-wide">
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}
