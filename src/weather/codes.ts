// WMO weather interpretation codes, as used by Open-Meteo, in plain words.
const WORDS: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorms',
  96: 'Thunderstorms with hail',
  99: 'Thunderstorms with hail',
}

export function describeCode(code: number): string {
  return WORDS[code] ?? 'Unsettled'
}

export const isClear = (c: number) => c <= 1
export const isCloudy = (c: number) => c === 2 || c === 3 || c === 45 || c === 48
export const isWet = (c: number) => c >= 51
export const isSnow = (c: number) => (c >= 71 && c <= 77) || c === 85 || c === 86
export const isStorm = (c: number) => c >= 95
