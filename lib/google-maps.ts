/**
 * Shared Google Maps initialization and utilities.
 * All Google Maps components use this to avoid duplicate API loads.
 */
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

let initialized = false
let ready = false
let readyPromise: Promise<void> | null = null

/** Initialize the Google Maps API (safe to call multiple times) */
export function initGoogleMaps(): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  if (!apiKey) return Promise.reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set'))

  if (ready) return Promise.resolve()
  if (readyPromise) return readyPromise

  if (!initialized) {
    setOptions({ key: apiKey, v: 'weekly' })
    initialized = true
  }

  readyPromise = Promise.all([
    importLibrary('maps'),
    importLibrary('marker'),
  ]).then(() => {
    ready = true
  })

  return readyPromise
}

/** Check if Google Maps API key is configured */
export function isGoogleMapsConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  return key.length > 0 && !key.includes('your-')
}

/** Standard satellite map options */
export const GOOGLE_MAP_OPTIONS: google.maps.MapOptions = {
  mapTypeId: 'satellite',
  tilt: 0,
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'greedy',
}
