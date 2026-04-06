/**
 * Pre-cache satellite tiles for a base area.
 * Supports both ESRI (obstruction/location maps) and Mapbox (infrastructure/parking maps).
 * Downloads tiles at zoom levels 12-17 for the bounding box around the installation,
 * storing them in the Cache API so the service worker serves them instantly.
 */

const ESRI_CACHE = 'esri-satellite-tiles'
const MAPBOX_CACHE = 'mapbox-satellite-tiles'

/** Convert lat/lng to tile coordinates at a given zoom */
function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n)
  return { x, y }
}

/** Get all tile coordinates for a bounding box at a given zoom */
function getTilesForBounds(
  minLat: number, minLng: number, maxLat: number, maxLng: number, zoom: number,
): { x: number; y: number; z: number }[] {
  const topLeft = latLngToTile(maxLat, minLng, zoom)
  const bottomRight = latLngToTile(minLat, maxLng, zoom)
  const tiles: { x: number; y: number; z: number }[] = []
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tiles.push({ x, y, z: zoom })
    }
  }
  return tiles
}

function esriTileUrl(z: number, y: number, x: number): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
}

function mapboxTileUrl(z: number, x: number, y: number, token: string): string {
  // Alternate between a/b subdomains for parallel downloads
  const sub = (x + y) % 2 === 0 ? 'a' : 'b'
  return `https://${sub}.tiles.mapbox.com/v4/mapbox.satellite/${z}/${x}/${y}.png?access_token=${token}`
}

export type PrecacheProgress = {
  total: number
  loaded: number
  cached: number
  errors: number
  done: boolean
}

/**
 * Compute tile list for a base area
 */
function computeTileList(
  centerLat: number, centerLng: number, radiusNm: number, zoomLevels: number[],
): { x: number; y: number; z: number }[] {
  const degLat = radiusNm / 60
  const degLng = radiusNm / (60 * Math.cos((centerLat * Math.PI) / 180))
  const minLat = centerLat - degLat
  const maxLat = centerLat + degLat
  const minLng = centerLng - degLng
  const maxLng = centerLng + degLng

  const allTiles: { x: number; y: number; z: number }[] = []
  for (const z of zoomLevels) {
    allTiles.push(...getTilesForBounds(minLat, minLng, maxLat, maxLng, z))
  }
  return allTiles
}

/**
 * Generic tile pre-cache function
 */
async function precacheGeneric(
  cacheName: string,
  tiles: { x: number; y: number; z: number }[],
  urlBuilder: (z: number, x: number, y: number) => string,
  onProgress?: (p: PrecacheProgress) => void,
): Promise<PrecacheProgress> {
  const progress: PrecacheProgress = { total: tiles.length, loaded: 0, cached: 0, errors: 0, done: false }
  onProgress?.(progress)

  const cache = await caches.open(cacheName)

  // Check which tiles are already cached
  const uncached: typeof tiles = []
  for (const tile of tiles) {
    const url = urlBuilder(tile.z, tile.x, tile.y)
    const existing = await cache.match(url)
    if (existing) {
      progress.cached++
      progress.loaded++
    } else {
      uncached.push(tile)
    }
  }
  onProgress?.(progress)

  // Fetch in batches
  const BATCH_SIZE = 6
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (tile) => {
        const url = urlBuilder(tile.z, tile.x, tile.y)
        const response = await fetch(url, { mode: 'cors' })
        if (response.ok) {
          await cache.put(url, response)
          progress.cached++
        } else {
          progress.errors++
        }
        progress.loaded++
        onProgress?.(progress)
      }),
    )
    results.forEach(r => {
      if (r.status === 'rejected') {
        progress.errors++
        progress.loaded++
      }
    })
    onProgress?.(progress)
  }

  progress.done = true
  onProgress?.(progress)
  return progress
}

/**
 * Pre-cache ESRI tiles (used by obstruction eval, location pickers, etc.)
 */
export async function precacheEsriTiles(
  centerLat: number, centerLng: number,
  radiusNm: number = 2,
  zoomLevels: number[] = [12, 13, 14, 15, 16, 17],
  onProgress?: (p: PrecacheProgress) => void,
): Promise<PrecacheProgress> {
  const tiles = computeTileList(centerLat, centerLng, radiusNm, zoomLevels)
  return precacheGeneric(ESRI_CACHE, tiles, (z, x, y) => esriTileUrl(z, y, x), onProgress)
}

/**
 * Pre-cache Mapbox satellite tiles (used by infrastructure, parking, etc.)
 */
export async function precacheMapboxTiles(
  centerLat: number, centerLng: number,
  radiusNm: number = 2,
  zoomLevels: number[] = [12, 13, 14, 15, 16, 17],
  onProgress?: (p: PrecacheProgress) => void,
): Promise<PrecacheProgress> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
  if (!token) {
    return { total: 0, loaded: 0, cached: 0, errors: 0, done: true }
  }
  const tiles = computeTileList(centerLat, centerLng, radiusNm, zoomLevels)
  return precacheGeneric(MAPBOX_CACHE, tiles, (z, x, y) => mapboxTileUrl(z, x, y, token), onProgress)
}

/** Legacy wrapper — caches both ESRI and Mapbox tiles */
export async function precacheTiles(
  centerLat: number, centerLng: number,
  radiusNm: number = 2,
  zoomLevels: number[] = [12, 13, 14, 15, 16, 17],
  onProgress?: (p: PrecacheProgress) => void,
): Promise<PrecacheProgress> {
  // Run ESRI first, then Mapbox, combining progress
  const tiles = computeTileList(centerLat, centerLng, radiusNm, zoomLevels)
  const totalTiles = tiles.length * 2 // ESRI + Mapbox
  const combined: PrecacheProgress = { total: totalTiles, loaded: 0, cached: 0, errors: 0, done: false }

  await precacheEsriTiles(centerLat, centerLng, radiusNm, zoomLevels, (p) => {
    combined.loaded = p.loaded
    combined.cached = p.cached
    combined.errors = p.errors
    onProgress?.(combined)
  })

  const esriDone = { loaded: combined.loaded, cached: combined.cached, errors: combined.errors }

  await precacheMapboxTiles(centerLat, centerLng, radiusNm, zoomLevels, (p) => {
    combined.loaded = esriDone.loaded + p.loaded
    combined.cached = esriDone.cached + p.cached
    combined.errors = esriDone.errors + p.errors
    onProgress?.(combined)
  })

  combined.done = true
  onProgress?.(combined)
  return combined
}

/** Check how many tiles are cached across both caches */
export async function getCachedTileCount(): Promise<number> {
  let count = 0
  try {
    const esri = await caches.open(ESRI_CACHE)
    count += (await esri.keys()).length
  } catch { /* ignore */ }
  try {
    const mb = await caches.open(MAPBOX_CACHE)
    count += (await mb.keys()).length
  } catch { /* ignore */ }
  return count
}

/** Clear both tile caches */
export async function clearTileCache(): Promise<void> {
  await Promise.all([
    caches.delete(ESRI_CACHE),
    caches.delete(MAPBOX_CACHE),
  ])
}
