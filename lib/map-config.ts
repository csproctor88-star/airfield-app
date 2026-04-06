import type mapboxgl from 'mapbox-gl'

/**
 * Raster satellite style using ESRI World Imagery.
 * Much lighter on WebGL than Mapbox's satellite-v9 vector pipeline.
 * ESRI tiles are free, commonly whitelisted on gov networks,
 * and bypass Mapbox's vector rendering entirely.
 */
export const SATELLITE_STYLE: mapboxgl.StyleSpecification = {
  version: 8,
  sources: {
    'satellite-tiles': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; Esri',
    },
  },
  layers: [
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite-tiles',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
}

/** Shared performance options for all Mapbox map instances */
export const MAP_PERF_OPTIONS = {
  fadeDuration: 0,
  maxTileCacheSize: 200,
  renderWorldCopies: false,
  crossSourceCollisions: false,
  pixelRatio: 1,
  antialias: false,
} as const
