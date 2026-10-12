export interface HourCell {
  /** Label such as "8a" or "12p". */
  label: string
  temp: number
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
