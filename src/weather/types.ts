export interface HourCell {
  /** Label such as "8a" or "12p". */
  label: string
  temp: number
}

/** Where a forecast's coordinates came from, for the settings screen. */
export interface WeatherSource {
  from: 'device' | 'saved'
  /** Why the saved city was used, when it was. */
  reason?: 'off' | 'unsupported' | 'denied' | 'unavailable' | 'timeout'
  /** Coordinates that were requested. */
  lat: number
  lon: number
  /** Accuracy of the device fix, in metres. */
  accuracy?: number
  /** Centre of the Open-Meteo grid cell that answered. */
  gridLat?: number
  gridLon?: number
  timezone?: string
  fetchedAt: number
}

export interface Forecast {
  temp: number
  condition: string
  high: number
  low: number
  /** Max precipitation probability for today, percent. */
  rain: number
  summary: string
  hours: HourCell[]
}
