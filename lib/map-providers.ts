/**
 * Per-base satellite tile provider.
 *
 * Some OCONUS airfields (Ramstein, Spangdahlem, Kleine Brogel, etc.) are
 * blurred or pixelated in Google Maps satellite imagery due to host-nation
 * censorship of military sites. We keep the Google Maps JS renderer (the
 * Air Force network throttles WebGL-heavy renderers like Mapbox / MapLibre
 * — see the wildlife-heatmap-only carve-out in CLAUDE.md) and swap only
 * the imagery layer using google.maps.ImageMapType.
 */
import type { Installation } from '@/lib/supabase/types'

export type MapProvider = 'google' | 'bing' | 'esri'

const PROVIDERS: readonly MapProvider[] = ['google', 'bing', 'esri'] as const

export function isMapProvider(value: unknown): value is MapProvider {
  return typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value)
}

/** Pull the provider off an Installation row, defaulting to 'google'. */
export function getInstallationMapProvider(
  installation: Installation | null | undefined
): MapProvider {
  const raw = (installation as { map_provider?: unknown } | null | undefined)?.map_provider
  return isMapProvider(raw) ? raw : 'google'
}

/** Bing tiling scheme is quadkey, not standard XYZ. */
function tileToQuadkey(x: number, y: number, zoom: number): string {
  let quadkey = ''
  for (let i = zoom; i > 0; i--) {
    let digit = 0
    const mask = 1 << (i - 1)
    if ((x & mask) !== 0) digit += 1
    if ((y & mask) !== 0) digit += 2
    quadkey += digit.toString()
  }
  return quadkey
}

/** Human label for a provider — used in setup UI and tooltips. */
export const MAP_PROVIDER_LABELS: Record<MapProvider, string> = {
  google: 'Google Maps',
  bing: 'Bing Maps Aerial',
  esri: 'Esri World Imagery',
}

/** One-line description shown beneath the radio option in setup. */
export const MAP_PROVIDER_DESCRIPTIONS: Record<MapProvider, string> = {
  google:
    'Default for most installations. Note: military airfields in Germany, Belgium, Netherlands, and parts of Italy are blurred under host-nation imagery policy.',
  bing:
    'Verified clear at Belgian airfields. Try first for OCONUS bases outside Germany where Google blurs the airfield.',
  esri:
    'No-token fallback if Bing is also blurred at your base. Coverage and clarity vary by region.',
}

/**
 * Build a Google ImageMapType backed by the requested provider's tiles.
 * Returns null for 'google' — caller should leave the map on its default
 * mapTypeId in that case.
 */
export function getAlternateImageMapType(
  provider: MapProvider
): google.maps.ImageMapType | null {
  if (provider === 'google') return null

  if (provider === 'bing') {
    const key = process.env.NEXT_PUBLIC_BING_MAPS_KEY ?? ''
    return new google.maps.ImageMapType({
      getTileUrl: (coord, zoom) => {
        const qk = tileToQuadkey(coord.x, coord.y, zoom)
        const sub = Math.abs(coord.x + coord.y) % 4
        const keyParam = key ? `&key=${encodeURIComponent(key)}` : ''
        return `https://ecn.t${sub}.tiles.virtualearth.net/tiles/a${qk}.jpeg?g=1&mkt=en-US${keyParam}`
      },
      tileSize: new google.maps.Size(256, 256),
      maxZoom: 21,
      name: MAP_PROVIDER_LABELS.bing,
    })
  }

  if (provider === 'esri') {
    return new google.maps.ImageMapType({
      getTileUrl: (coord, zoom) =>
        `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${coord.y}/${coord.x}`,
      tileSize: new google.maps.Size(256, 256),
      maxZoom: 19,
      name: MAP_PROVIDER_LABELS.esri,
    })
  }

  return null
}

/**
 * Apply the per-base provider to a freshly-constructed Google Map.
 *
 * Call this once, after `new google.maps.Map(...)`. No-op when provider
 * is 'google' — the map keeps whatever mapTypeId / mapId it was built
 * with. For 'bing' / 'esri', registers a custom ImageMapType and makes
 * it the active map type, overriding any default satellite layer.
 */
export function applyMapProvider(
  map: google.maps.Map,
  provider: MapProvider
): void {
  const layer = getAlternateImageMapType(provider)
  if (!layer) return
  map.mapTypes.set(provider, layer)
  map.setMapTypeId(provider)
}
