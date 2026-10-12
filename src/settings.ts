import { useCallback, useState } from 'react'
import { load, save } from './lib/storage'
import { DEFAULT_PLAN, PLANS } from './scripture/plans'

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
  /** Reading plan id: src/scripture/plans/<id>.json */
  plan: string
  planStart: string
  translation: string
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
  plan: DEFAULT_PLAN,
  planStart: `${new Date().getFullYear()}-01-01`,
  translation: 'kjv',
  programStart: '2026-09-04',
}

export function loadSettings(): Settings {
  const settings = { ...DEFAULT_SETTINGS, ...load<Partial<Settings>>('settings', {}) }
  // A saved plan that no longer exists (e.g. the old placeholder) falls back to the default.
  if (!PLANS[settings.plan]) settings.plan = DEFAULT_PLAN
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
