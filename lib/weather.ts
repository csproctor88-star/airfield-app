// Auto-capture weather from Open-Meteo (free, no API key required)
// Falls back to base coordinates if browser geolocation unavailable

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly Clear',
  2: 'Partly Cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing Fog',
  51: 'Light Drizzle',
  53: 'Drizzle',
  55: 'Heavy Drizzle',
  56: 'Freezing Drizzle',
  57: 'Heavy Freezing Drizzle',
  61: 'Light Rain',
  63: 'Rain',
  65: 'Heavy Rain',
  66: 'Freezing Rain',
  67: 'Heavy Freezing Rain',
  71: 'Light Snow',
  73: 'Snow',
  75: 'Heavy Snow',
  77: 'Snow Grains',
  80: 'Light Showers',
  81: 'Showers',
  82: 'Heavy Showers',
  85: 'Light Snow Showers',
  86: 'Heavy Snow Showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm w/ Hail',
  99: 'Heavy Thunderstorm w/ Hail',
}

export interface WeatherResult {
  conditions: string
  temperature_f: number
  wind_speed_mph: number
  visibility_miles: number
}

/**
 * Map Open-Meteo weather code to wildlife form sky_condition + precipitation values.
 */
export function weatherToFormFields(weatherCode: number): {
  sky_condition: 'clear' | 'some_cloud' | 'overcast'
  precipitation: 'none' | 'fog' | 'rain' | 'snow'
} {
  // Sky condition
  let sky_condition: 'clear' | 'some_cloud' | 'overcast' = 'clear'
  if (weatherCode <= 1) sky_condition = 'clear'
  else if (weatherCode === 2) sky_condition = 'some_cloud'
  else sky_condition = 'overcast' // 3+ (overcast, fog, precip all imply overcast)

  // Precipitation
  let precipitation: 'none' | 'fog' | 'rain' | 'snow' = 'none'
  if (weatherCode === 45 || weatherCode === 48) precipitation = 'fog'
  else if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82) || weatherCode >= 95)
    precipitation = 'rain'
  else if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86)
    precipitation = 'snow'

  return { sky_condition, precipitation }
}

/**
 * Fetch current weather and return raw result + mapped form fields.
 */
export async function fetchWeatherWithFormFields(baseLat?: number, baseLon?: number): Promise<{
  weather: WeatherResult
  sky_condition: 'clear' | 'some_cloud' | 'overcast'
  precipitation: 'none' | 'fog' | 'rain' | 'snow'
} | null> {
  try {
    let lat = baseLat ?? 0
    let lon = baseLon ?? 0

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 600000 })
        })
        lat = pos.coords.latitude
        lon = pos.coords.longitude
      } catch { /* Use base coordinates */ }
    }

    const url = `${OPEN_METEO_URL}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,weather_code,wind_speed_10m,visibility&temperature_unit=fahrenheit&wind_speed_unit=mph`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    const data = await res.json()
    const current = data.current
    const code = current.weather_code as number
    const fields = weatherToFormFields(code)

    return {
      weather: {
        conditions: WEATHER_CODES[code] || 'Unknown',
        temperature_f: Math.round(current.temperature_2m),
        wind_speed_mph: Math.round(current.wind_speed_10m ?? 0),
        visibility_miles: Math.round((current.visibility ?? 10000) / 1609.34),
      },
      ...fields,
    }
  } catch {
    return null
  }
}

export async function fetchCurrentWeather(baseLat?: number, baseLon?: number): Promise<WeatherResult | null> {
  try {
    let lat = baseLat ?? 0
    let lon = baseLon ?? 0

    // Try browser geolocation, fall back to base coordinates
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            maximumAge: 600000,
          })
        })
        lat = pos.coords.latitude
        lon = pos.coords.longitude
      } catch {
        // Use base coordinates (passed as params)
      }
    }

    const url = `${OPEN_METEO_URL}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,weather_code,wind_speed_10m,visibility&temperature_unit=fahrenheit&wind_speed_unit=mph`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    const data = await res.json()
    const current = data.current

    return {
      conditions: WEATHER_CODES[current.weather_code] || 'Unknown',
      temperature_f: Math.round(current.temperature_2m),
      wind_speed_mph: Math.round(current.wind_speed_10m ?? 0),
      visibility_miles: Math.round((current.visibility ?? 10000) / 1609.34), // API returns meters
    }
  } catch {
    return null
  }
}
