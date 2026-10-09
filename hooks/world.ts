// The world outside the terminal: the time of day, the season, the day of the
// week, and the weather where you are

export type PartOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'lateNight'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type DayKind = 'weekday' | 'friday' | 'weekend'
export type Sky = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'

export type Weather = {
  sky: Sky
  /** Degrees in the local unit */
  temperature: number
  unit: 'C' | 'F'
  /** Where it's from, in words: "Tokyo" */
  place: string
  isDay: boolean
  /** You named the place yourself, so it can be shown; a guess from your IP stays hidden */
  isChosen?: boolean
  /** Wind speed in km/h */
  wind?: number
}

// Windy enough for gusts to blow past
export const isWindy = (w: Weather) => (w.wind ?? 0) >= 30

/** Where to ask about the weather for, and how it was found */
export type Place = { latitude: number; longitude: number; name: string; country: string }

export type WeatherSetting = { mode: 'auto' | 'city' | 'off'; city?: string }

export function partOfDay(hour: number): PartOfDay {
  if (hour < 5) return 'lateNight'
  if (hour < 8) return 'dawn'
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

// Meteorological seasons, flipped south of the equator
export function seasonOf(month: number, latitude = 45): Season {
  const north: Season[] = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter']
  const season = north[month] ?? 'spring'
  if (latitude >= 0) return season
  return ({ winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' } as const)[season]
}

export function dayKind(weekday: number): DayKind {
  if (weekday === 0 || weekday === 6) return 'weekend'
  return weekday === 5 ? 'friday' : 'weekday'
}

// WMO weather codes, as Open-Meteo reports them
export function skyOf(code: number): Sky {
  if (code <= 1) return 'clear'
  if (code <= 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  return 'cloudy'
}

// Fahrenheit where people use it
export const unitFor = (country: string): 'C' | 'F' => (['US', 'LR', 'MM', 'BS', 'KY', 'PW', 'FM', 'MH'].includes(country.toUpperCase()) ? 'F' : 'C')

export function glyph(w: Weather): string {
  switch (w.sky) {
    case 'clear':
      return w.isDay ? '☀' : '☾'
    case 'cloudy':
      return '☁'
    case 'fog':
      return '≈'
    case 'drizzle':
    case 'rain':
      return '☂'
    case 'snow':
      return '❄'
    case 'storm':
      return '⚡'
  }
}

/** One line about the world, for the pane: "☂ 12°C Tokyo · evening". The
 * season isn't named: it's shown, on them and in the air. The place only when
 * you chose it: a guess from your IP isn't always right */
export function describeWorld(w: Weather | undefined, part: PartOfDay): string {
  const when = part === 'lateNight' ? 'late night' : part
  if (w === undefined) return when
  const windy = isWindy(w) ? ' ≋' : ''
  return `${glyph(w)}${windy} ${Math.round(w.temperature)}°${w.unit}${w.isChosen ? ` ${w.place}` : ''} · ${when}`
}

/** " in Tokyo" for a place you chose, nothing for a guess */
export const where = (w: Weather) => (w.isChosen ? ` in ${w.place}` : '')

// The answers the weather and location services give, read defensively

export function readForecast(text: string, place: Place): Weather | undefined {
  try {
    const body = JSON.parse(text) as { current?: { temperature_2m?: number; weather_code?: number; is_day?: number; wind_speed_10m?: number } }
    const c = body.current
    if (typeof c?.temperature_2m !== 'number' || typeof c.weather_code !== 'number') return undefined
    const unit = unitFor(place.country)
    const temperature = unit === 'F' ? c.temperature_2m * 1.8 + 32 : c.temperature_2m
    return { sky: skyOf(c.weather_code), temperature, unit, place: place.name, isDay: c.is_day !== 0, wind: c.wind_speed_10m }
  } catch {
    return undefined
  }
}

export function readGeocode(text: string): Place | undefined {
  try {
    const first = (JSON.parse(text) as { results?: { latitude: number; longitude: number; name: string; country_code?: string }[] }).results?.[0]
    if (!first || typeof first.latitude !== 'number') return undefined
    return { latitude: first.latitude, longitude: first.longitude, name: first.name, country: first.country_code ?? '' }
  } catch {
    return undefined
  }
}

export function readIpLookup(text: string): Place | undefined {
  try {
    const body = JSON.parse(text) as { success?: boolean; latitude?: number; longitude?: number; city?: string; country_code?: string }
    if (body.success === false || typeof body.latitude !== 'number' || typeof body.longitude !== 'number') return undefined
    return { latitude: body.latitude, longitude: body.longitude, name: body.city ?? 'here', country: body.country_code ?? '' }
  } catch {
    return undefined
  }
}

export const forecastUrl = (p: Place) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude.toFixed(1)}&longitude=${p.longitude.toFixed(1)}&current=temperature_2m,weather_code,is_day,wind_speed_10m`
export const geocodeUrl = (city: string) => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
export const IP_LOOKUP_URL = 'https://ipwho.is/'
