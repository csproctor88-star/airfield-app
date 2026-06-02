// OpenLayers map setup — the OL counterpart to lib/google-maps.ts.
//
// Why OpenLayers: on the Air Force network, WebGL-heavy renderers (Mapbox /
// MapLibre) are throttled (see lib/map-providers.ts). OpenLayers' DEFAULT
// renderer is Canvas 2D — same class as Google Maps — so it avoids that throttle
// while drawing vector features far more efficiently than Google's per-feature
// DOM markers. IMPORTANT: do NOT switch these layers to OL's WebGL renderers
// (WebGLTile / WebGL point layers) or we reintroduce the throttle.

import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'
import View from 'ol/View'
import { fromLonLat } from 'ol/proj'
import { getOlImagery, tileToQuadkey, type MapProvider } from './map-providers'

/** OL needs no API key for the default (Esri) imagery, so it's always usable. */
export function isOpenLayersConfigured(): boolean {
  return true
}

/** Satellite imagery tile layer for the given per-base provider. */
export function createImageryLayer(provider: MapProvider): TileLayer<XYZ> {
  const img = getOlImagery(provider)

  if (img.scheme === 'bing-quadkey') {
    return new TileLayer({
      source: new XYZ({
        maxZoom: img.maxZoom,
        attributions: img.attributions,
        tileUrlFunction: (tileCoord) => {
          const [z, x, y] = tileCoord
          const qk = tileToQuadkey(x, y, z)
          const sub = Math.abs(x + y) % 4
          const keyParam = img.key ? `&key=${encodeURIComponent(img.key)}` : ''
          return `https://ecn.t${sub}.tiles.virtualearth.net/tiles/a${qk}.jpeg?g=1&mkt=en-US${keyParam}`
        },
      }),
    })
  }

  return new TileLayer({
    source: new XYZ({ url: img.url, maxZoom: img.maxZoom, attributions: img.attributions }),
  })
}

/**
 * North-up, flat view (the app never rotates/tilts maps). `center` is [lng,lat]
 * in degrees; OL works in Web Mercator so we project it.
 */
export function createBaseView(centerLngLat: [number, number], zoom: number): View {
  return new View({
    center: fromLonLat(centerLngLat),
    zoom,
    enableRotation: false,
    constrainResolution: false, // allow fractional zoom (parity with Google's isFractionalZoomEnabled)
  })
}
