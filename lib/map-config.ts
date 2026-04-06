/** Standard Mapbox satellite style — use on mobile/commercial networks */
export const SATELLITE_STYLE = 'mapbox://styles/mapbox/satellite-v9'

/** Shared performance options for all Mapbox map instances */
export const MAP_PERF_OPTIONS = {
  fadeDuration: 0,
  maxTileCacheSize: 200,
  renderWorldCopies: false,
  crossSourceCollisions: false,
} as const
