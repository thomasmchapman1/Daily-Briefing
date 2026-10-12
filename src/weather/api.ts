import type { Forecast } from './types'
import { describeCode } from './codes'
import { summarize } from './summary'

// Raw Open-Meteo response (only the fields we request).
export interface OpenMeteo {
  latitude?: number
  longitude?: number
  timezone?: string
  current: {
    time: string
    temperature_2m: number
    weather_code: number
    wind_speed_10m: number
    wind_direction_10m: number
  }
  hourly: {
    time: string[]
    temperature_2m: number[]
    precipitation_probability: (number | null)[]
    weather_code: number[]
    cloud_cover: number[]
  }
  daily: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: (number | null)[]
  }
}

export async function fetchOpenMeteo(lat: number, lon: number, signal?: AbortSignal): Promise<OpenMeteo> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code,cloud_cover',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    forecast_days: '2',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal })
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  return res.json()
}

function hourLabel(h: number): string {
  return `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`
}

/** Index into hourly.time of the current hour, rounded up. Times are location-local. */
export function firstHourIndex(data: OpenMeteo): number {
  const now = data.current.time // "2026-10-11T07:15"
  const hourStart = now.slice(0, 13) + ':00'
  let i = data.hourly.time.findIndex((t) => t >= hourStart)
  if (i < 0) return 0
  if (now > hourStart && data.hourly.time[i] === hourStart) i += 1
  return i
}

export function toForecast(data: OpenMeteo): Forecast {
  const start = firstHourIndex(data)
  const hours = []
  for (let k = 0; k < 6; k++) {
    const i = start + k * 2
    if (i >= data.hourly.time.length) break
    hours.push({ label: hourLabel(Number(data.hourly.time[i].slice(11, 13))), temp: Math.round(data.hourly.temperature_2m[i]) })
  }
  return {
    temp: Math.round(data.current.temperature_2m),
    condition: describeCode(data.current.weather_code),
    high: Math.round(data.daily.temperature_2m_max[0]),
    low: Math.round(data.daily.temperature_2m_min[0]),
    rain: Math.round(data.daily.precipitation_probability_max[0] ?? 0),
    summary: summarize(data),
    hours,
  }
}

export async function getForecast(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<{ forecast: Forecast; grid: { lat?: number; lon?: number; timezone?: string } }> {
  const data = await fetchOpenMeteo(lat, lon, signal)
  return { forecast: toForecast(data), grid: { lat: data.latitude, lon: data.longitude, timezone: data.timezone } }
}

/** Look up a city name with Open-Meteo's free geocoder. */
export async function geocodeCity(name: string): Promise<{ city: string; lat: number; lon: number } | null> {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`Geocoding ${res.status}`)
  const json = (await res.json()) as { results?: { name: string; latitude: number; longitude: number }[] }
  const hit = json.results?.[0]
  return hit ? { city: hit.name, lat: hit.latitude, lon: hit.longitude } : null
}
