import { useId, useState, type ReactNode } from 'react'
import { PLANS, allTranslations } from '../scripture'
import type { Settings } from '../settings'
import { geocodeCity } from '../weather/api'
import { Sheet } from './Sheet'

interface Props {
  settings: Settings
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

export function SettingsScreen({ settings, onSave, onClose }: Props) {
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
