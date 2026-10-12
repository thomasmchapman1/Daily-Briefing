// Loads the briefing stale-while-revalidate: cached data renders immediately,
// then each section re-fetches on its own and fails on its own.
import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarAuthError, calendarConfigured, calendarKey, getTodaysEvents, type CalendarEvent } from './calendar/api'
import { isoDate, msUntilNextMidnight, startOfDay } from './lib/date'
import { load, save } from './lib/storage'
import { getToday, scriptureKey, type ScriptureToday } from './scripture'
import type { Settings } from './settings'
import { getForecast } from './weather/api'
import type { Forecast, WeatherSource } from './weather/types'

export interface SectionState<T> {
  data: T | null
  error: boolean
}

interface Cache {
  weather?: { data: Forecast; fetchedAt: number; source?: WeatherSource }
  events?: { data: CalendarEvent[]; date: string; calendar: string; fetchedAt: number }
  scripture?: { data: ScriptureToday; key: string }
  fetchedAt?: number
}

const STALE_AFTER_MS = 30 * 60 * 1000

/** The current local day; changes at midnight and when the app is reopened on a new day. */
export function useToday(): Date {
  const [today, setToday] = useState(() => isoDate(new Date()))
  useEffect(() => {
    const check = () => setToday(isoDate(new Date()))
    let timer = window.setTimeout(function tick() {
      check()
      timer = window.setTimeout(tick, msUntilNextMidnight() + 500)
    }, msUntilNextMidnight() + 500)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])
  // Rebuild the Date only when the day changes.
  const ref = useRef<{ iso: string; date: Date } | null>(null)
  if (ref.current?.iso !== today) ref.current = { iso: today, date: startOfDay(new Date()) }
  return ref.current.date
}

type Position = Pick<WeatherSource, 'from' | 'reason' | 'lat' | 'lon' | 'accuracy'>

function position(settings: Settings): Promise<Position> {
  const saved = (reason: WeatherSource['reason']): Position => ({ from: 'saved', reason, lat: settings.lat, lon: settings.lon })
  if (!settings.useDeviceLocation) return Promise.resolve(saved('off'))
  if (!('geolocation' in navigator)) return Promise.resolve(saved('unsupported'))
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ from: 'device', lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) =>
        resolve(saved(err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable')),
      { timeout: 10000, maximumAge: 10 * 60 * 1000 },
    )
  })
}

function fromCache(cache: Cache, settings: Settings, today: Date) {
  const date = isoDate(today)
  const ev = cache.events
  return {
    weather: { data: cache.weather?.data ?? null, error: false },
    events: { data: ev && ev.date === date && ev.calendar === calendarKey(settings) ? ev.data : null, error: false },
    scripture: {
      data: cache.scripture?.key === scriptureKey(date, settings) ? cache.scripture.data : null,
      error: false,
    },
  }
}

export function useBriefing(settings: Settings, today: Date) {
  const cacheRef = useRef<Cache>(load<Cache>('cache', {}))
  const [weather, setWeather] = useState<SectionState<Forecast>>(() => fromCache(cacheRef.current, settings, today).weather)
  const [events, setEvents] = useState<SectionState<CalendarEvent[]>>(() => fromCache(cacheRef.current, settings, today).events)
  const [scripture, setScripture] = useState<SectionState<ScriptureToday>>(
    () => fromCache(cacheRef.current, settings, today).scripture,
  )
  const [weatherSource, setWeatherSource] = useState<WeatherSource | null>(cacheRef.current.weather?.source ?? null)
  const [calendarNeedsAuth, setCalendarNeedsAuth] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const generation = useRef(0)

  const persist = (patch: Partial<Cache>) => {
    cacheRef.current = { ...cacheRef.current, ...patch }
    save('cache', cacheRef.current)
  }

  const refresh = useCallback(async () => {
    const gen = ++generation.current
    const current = () => gen === generation.current
    const date = isoDate(today)
    setRefreshing(true)

    const weatherJob = (async () => {
      try {
        const pos = await position(settings)
        const { forecast: data, grid } = await getForecast(pos.lat, pos.lon)
        if (!current()) return
        const source: WeatherSource = { ...pos, gridLat: grid.lat, gridLon: grid.lon, timezone: grid.timezone, fetchedAt: Date.now() }
        persist({ weather: { data, fetchedAt: source.fetchedAt, source } })
        setWeather({ data, error: false })
        setWeatherSource(source)
      } catch {
        if (current()) setWeather((s) => ({ data: s.data, error: s.data == null }))
      }
    })()

    const eventsJob = (async () => {
      if (!calendarConfigured(settings)) return
      try {
        const data = await getTodaysEvents(settings, today)
        if (!current()) return
        persist({ events: { data, date, calendar: calendarKey(settings), fetchedAt: Date.now() } })
        setEvents({ data, error: false })
        setCalendarNeedsAuth(false)
      } catch (err) {
        if (!current()) return
        if (err instanceof CalendarAuthError) {
          setCalendarNeedsAuth(true)
          setEvents({ data: null, error: false })
        } else setEvents((s) => ({ data: s.data, error: s.data == null }))
      }
    })()

    const scriptureJob = (async () => {
      const key = scriptureKey(date, settings)
      if (cacheRef.current.scripture?.key === key) return // Same reading all day.
      try {
        const data = await getToday(today, settings)
        if (!current()) return
        persist({ scripture: { data, key } })
        setScripture({ data, error: false })
      } catch {
        if (current()) setScripture((s) => ({ data: s.data, error: s.data == null }))
      }
    })()

    await Promise.all([weatherJob, eventsJob, scriptureJob])
    if (current()) {
      persist({ fetchedAt: Date.now() })
      setRefreshing(false)
    }
  }, [settings, today])

  // New day or new settings: show what the cache has for them, then fetch.
  const first = useRef(true)
  useEffect(() => {
    if (!first.current) {
      const s = fromCache(cacheRef.current, settings, today)
      setWeather(s.weather)
      setEvents(s.events)
      setScripture(s.scripture)
    }
    first.current = false
    void refresh()
  }, [refresh, settings, today])

  // Coming back to the foreground after a while re-fetches.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - (cacheRef.current.fetchedAt ?? 0) > STALE_AFTER_MS) void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  return { weather, weatherSource, events, scripture, refreshing, refresh, calendarLinked: calendarConfigured(settings), calendarNeedsAuth }
}
