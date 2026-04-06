/**
 * Pre-cache satellite tiles for a base area.
 * Downloads ESRI tiles at zoom levels 12-17 for the bounding box
 * around the installation, storing them in the service worker cache.
 * After pre-caching, all map interactions are instant.
 */

const ESRI_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile'
const CACHE_NAME = 'esri-satellite-tiles'

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

/** Build ESRI tile URL */
function tileUrl(z: number, y: number, x: number): string {
  return `${ESRI_TILE_URL}/${z}/${y}/${x}`
}

export type PrecacheProgress = {
  total: number
  loaded: number
  cached: number
  errors: number
  done: boolean
}

/**
 * Pre-cache tiles for a base area.
 * @param centerLat Center latitude of the base
 * @param centerLng Center longitude of the base
 * @param radiusNm Radius in nautical miles to cache (default 2nm covers most airfields)
 * @param zoomLevels Zoom levels to cache (default 12-17)
 * @param onProgress Callback for progress updates
 */
export async function precacheTiles(
  centerLat: number,
  centerLng: number,
  radiusNm: number = 2,
  zoomLevels: number[] = [12, 13, 14, 15, 16, 17],
  onProgress?: (p: PrecacheProgress) => void,
): Promise<PrecacheProgress> {
  // Convert NM to degrees (rough approximation)
  const degLat = radiusNm / 60
  const degLng = radiusNm / (60 * Math.cos((centerLat * Math.PI) / 180))

  const minLat = centerLat - degLat
  const maxLat = centerLat + degLat
  const minLng = centerLng - degLng
  const maxLng = centerLng + degLng

  // Collect all tiles across zoom levels
  const allTiles: { x: number; y: number; z: number }[] = []
  for (const z of zoomLevels) {
    allTiles.push(...getTilesForBounds(minLat, minLng, maxLat, maxLng, z))
  }

  const progress: PrecacheProgress = {
    total: allTiles.length,
    loaded: 0,
    cached: 0,
    errors: 0,
    done: false,
  }

  onProgress?.(progress)

  // Open cache
  const cache = await caches.open(CACHE_NAME)

  // Check which tiles are already cached
  const uncached: typeof allTiles = []
  for (const tile of allTiles) {
    const url = tileUrl(tile.z, tile.y, tile.x)
    const existing = await cache.match(url)
    if (existing) {
      progress.cached++
      progress.loaded++
    } else {
      uncached.push(tile)
    }
  }

  onProgress?.(progress)

  // Fetch uncached tiles in batches to avoid overwhelming the network
  const BATCH_SIZE = 6
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (tile) => {
        const url = tileUrl(tile.z, tile.y, tile.x)
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
    // Count any unhandled rejections
    results.forEach((r) => {
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

/** Check how many tiles are already cached for a base area */
export async function getCachedTileCount(): Promise<number> {
  try {
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()
    return keys.length
  } catch {
    return 0
  }
}

/** Clear the tile cache */
export async function clearTileCache(): Promise<void> {
  await caches.delete(CACHE_NAME)
}
