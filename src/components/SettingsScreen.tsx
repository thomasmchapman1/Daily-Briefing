import { useId, useState, type ReactNode } from 'react'
import { allTranslations } from '../scripture'
import type { Settings } from '../settings'
import { connectGoogle } from '../calendar/api'
import { geocodeCity } from '../weather/api'
import { GoogleCalendarPicker } from './GoogleCalendarPicker'
import type { WeatherSource } from '../weather/types'
import { Sheet } from './Sheet'
import { formatDuration, parseDuration } from '../fitness/log'
import type { Profile } from '../fitness/profile'

interface Props {
  settings: Settings
  weatherSource: WeatherSource | null
  /** Set right after returning from Google sign-in: connected | cancelled | failed. */
  googleResult: string | null
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

export function SettingsScreen({ settings, weatherSource, googleResult, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(settings)
  const [lookup, setLookup] = useState<string | null>(null)
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const setProfile = <K extends keyof Profile>(key: K, value: Profile[K]) => setDraft((d) => ({ ...d, profile: { ...d.profile, [key]: value } }))
  const [twoMile, setTwoMile] = useState(formatDuration(settings.profile.twoMileSeconds))

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
        <div className="field">
          <label>Calendar</label>
          <div className="seg" role="radiogroup" aria-label="Calendar source" style={{ alignSelf: 'flex-start' }}>
            {(
              [
                ['google', 'Google Calendar'],
                ['ics', 'iCal link'],
              ] as const
            ).map(([value, text]) => (
              <label key={value} className="seg-opt">
                <input
                  type="radio"
                  name="calendar-source"
                  checked={draft.calendarSource === value}
                  onChange={() => set('calendarSource', value)}
                />
                {text}
              </label>
            ))}
          </div>
        </div>
        {draft.calendarSource === 'google' ? (
          <div className="field" style={{ display: 'flex', flexDirection: 'column' }}>
            <label>Google Calendar</label>
            <GoogleCalendarPicker
              selected={draft.googleCalendars}
              onChange={(ids) => set('googleCalendars', ids)}
              result={googleResult}
              onConnect={() => {
                onSave({ ...draft, calendarSource: 'google' })
                connectGoogle()
              }}
            />
          </div>
        ) : (
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
        )}
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
        <Field label="Personal worship link" hint="Opens from the Scripture section. Leave empty to hide the button.">
          {(id) => (
            <input
              id={id}
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://www.familyworship.io/dashboard"
              value={draft.worshipUrl}
              onChange={(e) => set('worshipUrl', e.target.value.trim())}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          )}
        </Field>
        <span className="field-row">
          {(
            [
              ['benchMax', 'Bench max'],
              ['squatMax', 'Squat max'],
              ['deadliftMax', 'Deadlift max'],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={`${label} (lb)`}>
              {(id) => (
                <input
                  id={id}
                  className="input tnum"
                  type="number"
                  inputMode="numeric"
                  value={draft.profile[key]}
                  onChange={(e) => e.target.value && setProfile(key, Number(e.target.value))}
                />
              )}
            </Field>
          ))}
        </span>
        <Field
          label="2-mile time"
          hint={
            twoMile && parseDuration(twoMile) == null
              ? 'Type it as minutes:seconds, e.g. 15:28.'
              : 'Your one-rep maxes set every lifting weight in the plan, and your 2-mile time sets your run paces. Update them after a test.'
          }
        >
          {(id) => (
            <input
              id={id}
              className="input tnum"
              inputMode="numeric"
              placeholder="15:28"
              value={twoMile}
              onChange={(e) => {
                setTwoMile(e.target.value)
                const sec = parseDuration(e.target.value)
                // A 2-mile under 9 minutes or over 40 is a typo, not a time.
                if (sec != null && sec >= 540 && sec <= 2400) setProfile('twoMileSeconds', sec)
              }}
            />
          )}
        </Field>
        <span className="field-row">
          <Field label="Goal weight (lb)">
            {(id) => (
              <input
                id={id}
                className="input tnum"
                type="number"
                inputMode="decimal"
                value={draft.goalWeight}
                onChange={(e) => e.target.value && set('goalWeight', Number(e.target.value))}
              />
            )}
          </Field>
          <Field label="Goal waist (in)">
            {(id) => (
              <input
                id={id}
                className="input tnum"
                type="number"
                inputMode="decimal"
                step="0.5"
                value={draft.goalWaist}
                onChange={(e) => e.target.value && set('goalWaist', Number(e.target.value))}
              />
            )}
          </Field>
        </span>
        <Field
          label="Training log sync passcode"
          hint="Leave empty to keep your training log on this device only. To sync it between devices, set up cloud sync in Vercel (see the README) and enter the same SYNC_KEY here on each device."
        >
          {(id) => (
            <input
              id={id}
              className="input"
              type="password"
              autoComplete="off"
              value={draft.syncKey}
              onChange={(e) => set('syncKey', e.target.value.trim())}
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
