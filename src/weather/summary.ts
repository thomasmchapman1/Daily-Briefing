// Builds the one-paragraph weather summary from forecast data, e.g.
// "A light-jacket morning. Clouds thin by noon and the afternoon stays dry;
//  wind from the northwest at 6 mph."
import type { OpenMeteo } from './api'
import { isSnow, isStorm, isWet } from './codes'

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']

export function compass(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}

function partOfDay(hour: number): string {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function when(hour: number): string {
  if (hour < 11) return 'mid-morning'
  if (hour < 14) return 'noon'
  if (hour < 17) return 'mid-afternoon'
  if (hour < 20) return 'evening'
  return 'tonight'
}

function opener(temp: number, code: number, part: string): string {
  if (isStorm(code)) return `A stormy ${part}.`
  if (isSnow(code)) return `A snowy ${part}.`
  if (isWet(code)) return `An umbrella ${part}.`
  if (temp < 25) return `A bitter-cold ${part}.`
  if (temp < 40) return `A heavy-coat ${part}.`
  if (temp < 52) return `A warm-layers ${part}.`
  if (temp < 66) return `A light-jacket ${part}.`
  if (temp < 78) return `A shirtsleeves ${part}.`
  if (temp < 88) return `A warm ${part}.`
  return `A hot ${part}.`
}

interface Hour {
  hour: number
  cloud: number
  rain: number
  code: number
}

function sky(hours: Hour[]): string {
  const avg = (hs: Hour[]) => hs.reduce((s, h) => s + h.cloud, 0) / Math.max(hs.length, 1)
  const early = hours.slice(0, 3)
  const now = avg(early)
  if (hours.every((h) => h.cloud < 30)) return 'Clear skies through the day'
  if (hours.every((h) => h.cloud > 75)) return 'Grey skies all day'
  if (now >= 50) {
    const clears = hours.slice(2).find((h) => h.cloud < 35)
    if (clears) return `Clouds thin by ${when(clears.hour)}`
  }
  if (now < 40) {
    const builds = hours.slice(2).find((h) => h.cloud >= 70)
    if (builds) return `Clouds build by ${when(builds.hour)}`
  }
  return now >= 60 ? 'Mostly cloudy, with a few breaks' : 'A mix of sun and cloud'
}

function rainClause(hours: Hour[], currentHour: number): string {
  const likely = hours.find((h) => h.rain >= 50)
  const snow = hours.some((h) => isSnow(h.code))
  const word = snow ? 'snow' : 'rain'
  if (likely) {
    return likely.hour <= currentHour + 1 ? `, with ${word} on and off` : `, with ${word} likely from ${when(likely.hour)}`
  }
  const chance = hours.find((h) => h.rain >= 25)
  if (chance) return `, with a chance of ${snow ? 'flurries' : 'showers'} around ${when(chance.hour)}`
  return currentHour < 12 ? ' and the afternoon stays dry' : ' and it stays dry'
}

function wind(speed: number, deg: number): string {
  const mph = Math.round(speed)
  if (mph < 3) return 'barely a breeze'
  return `wind from the ${compass(deg)} at ${mph} mph`
}

export function summarize(data: OpenMeteo): string {
  const { current, hourly } = data
  const today = current.time.slice(0, 10)
  const currentHour = Number(current.time.slice(11, 13))
  const hours: Hour[] = []
  hourly.time.forEach((t, i) => {
    const hour = Number(t.slice(11, 13))
    if (t.slice(0, 10) === today && hour >= currentHour && hour <= 21) {
      hours.push({ hour, cloud: hourly.cloud_cover[i] ?? 0, rain: hourly.precipitation_probability[i] ?? 0, code: hourly.weather_code[i] ?? 0 })
    }
  })
  const first = opener(current.temperature_2m, current.weather_code, partOfDay(currentHour))
  if (hours.length === 0) return `${first} ${capitalize(wind(current.wind_speed_10m, current.wind_direction_10m))}.`
  return `${first} ${sky(hours)}${rainClause(hours, currentHour)}; ${wind(current.wind_speed_10m, current.wind_direction_10m)}.`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
