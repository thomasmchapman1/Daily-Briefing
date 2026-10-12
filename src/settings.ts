import { useCallback, useState } from 'react'
import { load, save } from './lib/storage'

export interface Settings {
  city: string
  lat: number
  lon: number
  /** Use the browser's location for weather, falling back to lat/lon above. */
  useDeviceLocation: boolean
  /** Where The Day comes from: Google Calendar (signed in) or a pasted iCal link. */
  calendarSource: 'google' | 'ics'
  /** Google calendar ids to show; empty means the primary calendar. */
  googleCalendars: string[]
  icsUrl: string
  translation: string
  /** Link to finish personal worship, shown under the verse. Empty hides it. */
  worshipUrl: string
  /** Goals shown on the progress page. */
  goalWeight: number
  goalWaist: number
  /** Passphrase for cloud sync of the fitness log (the server's SYNC_KEY). Empty keeps it on this device. */
  syncKey: string
}

export const DEFAULT_SETTINGS: Settings = {
  city: 'Elgin',
  lat: 34.782,
  lon: -98.2923,
  useDeviceLocation: true,
  calendarSource: 'google',
  googleCalendars: [],
  icsUrl: '',
  translation: 'kjv',
  worshipUrl: 'https://www.familyworship.io/dashboard',
  goalWeight: 175,
  goalWaist: 32,
  syncKey: '',
}

/** The first default city. A phone still saved on it moves to the current default. */
const OLD_DEFAULT = { city: 'Brooklyn', lat: 40.6782, lon: -73.9442 }

export function loadSettings(): Settings {
  const settings = { ...DEFAULT_SETTINGS, ...load<Partial<Settings>>('settings', {}) }
  if (settings.city === OLD_DEFAULT.city && settings.lat === OLD_DEFAULT.lat && settings.lon === OLD_DEFAULT.lon) {
    Object.assign(settings, { city: DEFAULT_SETTINGS.city, lat: DEFAULT_SETTINGS.lat, lon: DEFAULT_SETTINGS.lon })
  }
  return settings
}

export function useSettings(): [Settings, (next: Settings) => void] {
  const [settings, setSettings] = useState(loadSettings)
  const update = useCallback((next: Settings) => {
    save('settings', next)
    setSettings(next)
  }, [])
  return [settings, update]
}
