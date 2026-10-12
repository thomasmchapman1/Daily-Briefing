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
  programStart: string
}

export const DEFAULT_SETTINGS: Settings = {
  city: 'Brooklyn',
  lat: 40.6782,
  lon: -73.9442,
  useDeviceLocation: true,
  calendarSource: 'google',
  googleCalendars: [],
  icsUrl: '',
  translation: 'kjv',
  worshipUrl: 'https://www.familyworship.io/dashboard',
  programStart: '2026-09-04',
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...load<Partial<Settings>>('settings', {}) }
}

export function useSettings(): [Settings, (next: Settings) => void] {
  const [settings, setSettings] = useState(loadSettings)
  const update = useCallback((next: Settings) => {
    save('settings', next)
    setSettings(next)
  }, [])
  return [settings, update]
}
