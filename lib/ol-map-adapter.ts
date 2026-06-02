// OpenLayers map adapter — the OL counterpart to lib/google-map-adapter.ts.
// Mirrors that module's public surface (wrapper + registerIcon / clearAllObjects
// / addMarker / queryFeaturesInBounds / queryFeatureAtPoint / pixelToLatLng /
// createDraggableMarker) so map components can swap renderers with mostly import
// changes. Spatial queries use the shared renderer-agnostic helpers in
// lib/map-spatial.ts; pixel<->coord uses OL's native (flat, exact) projection.

import OlMap from 'ol/Map'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import Overlay from 'ol/Overlay'
import Style from 'ol/style/Style'
import Icon from 'ol/style/Icon'
import CircleStyle from 'ol/style/Circle'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Translate from 'ol/interaction/Translate'
import Collection from 'ol/Collection'
import { fromLonLat, toLonLat } from 'ol/proj'
import {
  nearestFeatureInIndex,
  featuresInBoundsIndex,
  type FeatureIndexEntry,
  type FeatureHit,
  type LngLatBounds,
} from './map-spatial'

export interface OlWrapper {
  map: OlMap
  /** Vector layer holding feature points/markers; one canvas draw for all. */
  source: VectorSource
  featureLayer: VectorLayer<VectorSource>
  /** Feature by id (mirrors GMapWrapper.markers). */
  features: Map<string, Feature>
  /** Popup overlay + its content element (mirrors GMapWrapper.infoWindow). */
  overlay: Overlay
  overlayEl: HTMLElement
  featureIndex: Map<string, FeatureIndexEntry>
  iconCache: Map<string, string>
  iconSizes: Map<string, { w: number; h: number }>
}

export interface OlMarkerOptions {
  iconUrl?: string
  iconName?: string
  /** degrees, clockwise (converted to OL's radians). */
  rotation?: number
  /** icon scale multiplier (1 = natural size). */
  scale?: number
  /** circle fallback when no icon. */
  color?: string
  /** circle diameter in px. */
  size?: number
  type?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props?: Record<string, any>
  onClick?: () => void
}

/** Convert canvas ImageData to a PNG data URL (icon source). */
export function imageDataToDataUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  canvas.getContext('2d')!.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

/** Wrap an OL map: attach a feature vector layer, a popup overlay, and a
 *  delegated click handler that fires each feature's stored onClick. */
export function createOlWrapper(map: OlMap): OlWrapper {
  const source = new VectorSource()
  const featureLayer = new VectorLayer({ source })
  map.addLayer(featureLayer)

  const overlayEl = document.createElement('div')
  const overlay = new Overlay({ element: overlayEl, autoPan: false, stopEvent: true })
  map.addOverlay(overlay)

  map.on('singleclick', (e) => {
    map.forEachFeatureAtPixel(e.pixel, (f) => {
      const cb = (f as Feature).get('onClick') as (() => void) | undefined
      if (cb) {
        cb()
        return true
      }
      return false
    })
  })

  return {
    map,
    source,
    featureLayer,
    features: new Map(),
    overlay,
    overlayEl,
    featureIndex: new Map(),
    iconCache: new Map(),
    iconSizes: new Map(),
  }
}

export function registerIcon(wrapper: OlWrapper, name: string, imageData: ImageData): void {
  wrapper.iconCache.set(name, imageDataToDataUrl(imageData))
  wrapper.iconSizes.set(name, { w: imageData.width, h: imageData.height })
}

export function clearAllObjects(wrapper: OlWrapper): void {
  wrapper.source.clear()
  wrapper.features.clear()
  wrapper.featureIndex.clear()
  wrapper.overlay.setPosition(undefined)
}

function styleFor(wrapper: OlWrapper, opts: OlMarkerOptions): Style {
  const src = opts.iconUrl || (opts.iconName ? wrapper.iconCache.get(opts.iconName) : undefined)
  if (src) {
    return new Style({
      image: new Icon({
        src,
        scale: opts.scale ?? 1,
        rotation: ((opts.rotation ?? 0) * Math.PI) / 180,
        rotateWithView: false,
      }),
    })
  }
  return new Style({
    image: new CircleStyle({
      radius: (opts.size ?? 20) / 2,
      fill: new Fill({ color: opts.color ?? '#3b82f6' }),
      stroke: new Stroke({ color: '#FFFFFF', width: 1 }),
    }),
  })
}

/** Create (or replace) a point feature for `id` and add it to the vector layer. */
export function addMarker(
  wrapper: OlWrapper,
  id: string,
  lat: number,
  lng: number,
  options: OlMarkerOptions = {},
): Feature {
  const existing = wrapper.features.get(id)
  if (existing) wrapper.source.removeFeature(existing)

  const feature = new Feature({ geometry: new Point(fromLonLat([lng, lat])) })
  feature.setId(id)
  feature.setStyle(styleFor(wrapper, options))
  if (options.onClick) feature.set('onClick', options.onClick)

  wrapper.source.addFeature(feature)
  wrapper.features.set(id, feature)
  wrapper.featureIndex.set(id, { lat, lng, type: options.type ?? '', props: options.props ?? {} })
  return feature
}

export function queryFeaturesInBounds(wrapper: OlWrapper, bounds: LngLatBounds): FeatureHit[] {
  return featuresInBoundsIndex(wrapper.featureIndex, bounds)
}

export function queryFeatureAtPoint(
  wrapper: OlWrapper,
  lat: number,
  lng: number,
  thresholdMeters = 50,
): FeatureHit | null {
  return nearestFeatureInIndex(wrapper.featureIndex, lat, lng, thresholdMeters)
}

/** Pixel → {lat,lng} via OL's native projection (flat & exact; no overlay hack). */
export function pixelToLatLng(wrapper: OlWrapper, x: number, y: number): { lat: number; lng: number } | null {
  const coord = wrapper.map.getCoordinateFromPixel([x, y])
  if (!coord) return null
  const [lng, lat] = toLonLat(coord)
  return { lat, lng }
}

/** A draggable point marker (bar placement, free-move). Uses a per-feature
 *  Translate interaction and reports drag/end in lat/lng. */
export function createDraggableMarker(
  wrapper: OlWrapper,
  lat: number,
  lng: number,
  color: string,
  size = 20,
  onDrag?: (lat: number, lng: number) => void,
  onDragEnd?: (lat: number, lng: number) => void,
): { feature: Feature; translate: Translate; remove: () => void } {
  const feature = new Feature({ geometry: new Point(fromLonLat([lng, lat])) })
  feature.setStyle(
    new Style({
      image: new CircleStyle({
        radius: size / 2,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#FFFFFF', width: 3 }),
      }),
    }),
  )
  wrapper.source.addFeature(feature)

  const translate = new Translate({ features: new Collection([feature]) })
  const lonLatOf = (): [number, number] => {
    const geom = feature.getGeometry() as Point
    const [lo, la] = toLonLat(geom.getCoordinates())
    return [la, lo] // [lat, lng]
  }
  if (onDrag) translate.on('translating', () => { const [la, lo] = lonLatOf(); onDrag(la, lo) })
  if (onDragEnd) translate.on('translateend', () => { const [la, lo] = lonLatOf(); onDragEnd(la, lo) })
  wrapper.map.addInteraction(translate)

  return {
    feature,
    translate,
    remove: () => {
      wrapper.map.removeInteraction(translate)
      wrapper.source.removeFeature(feature)
    },
  }
}

export { isOpenLayersConfigured, createImageryLayer, createBaseView } from './openlayers'
