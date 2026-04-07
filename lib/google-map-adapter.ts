/**
 * Google Maps adapter that provides Mapbox-like interfaces.
 * Used by the infrastructure and parking pages to minimize edit points
 * during the Mapbox → Google Maps migration.
 *
 * This adapter wraps Google Maps objects to match the patterns used
 * throughout the codebase (addImage, addSource/addLayer, queryRenderedFeatures, etc.)
 */

import { initGoogleMaps, isGoogleMapsConfigured, GOOGLE_MAP_OPTIONS } from './google-maps'

// ── Types ──

export interface GMapWrapper {
  gmap: google.maps.Map
  markers: Map<string, google.maps.Marker>
  polygons: Map<string, google.maps.Polygon>
  polylines: Map<string, google.maps.Polyline>
  circles: Map<string, google.maps.Circle>
  infoWindow: google.maps.InfoWindow
  /** Spatial index: feature ID → { lat, lng, type, props } */
  featureIndex: Map<string, { lat: number; lng: number; type: string; props: Record<string, any> }>
  /** Custom icon data URLs keyed by icon name */
  iconCache: Map<string, string>
  /** Natural dimensions of cached icons (width, height) */
  iconSizes: Map<string, { w: number; h: number }>
}

/** Convert canvas ImageData to a data URL for use as marker icon */
export function imageDataToDataUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

/** Create a GMapWrapper around a Google Maps instance */
export function createGMapWrapper(gmap: google.maps.Map): GMapWrapper {
  return {
    gmap,
    markers: new Map(),
    polygons: new Map(),
    polylines: new Map(),
    circles: new Map(),
    infoWindow: new google.maps.InfoWindow(),
    featureIndex: new Map(),
    iconCache: new Map(),
    iconSizes: new Map(),
  }
}

/** Register an icon (ImageData) for later use as a marker icon */
export function registerIcon(wrapper: GMapWrapper, name: string, imageData: ImageData): void {
  const url = imageDataToDataUrl(imageData)
  wrapper.iconCache.set(name, url)
  wrapper.iconSizes.set(name, { w: imageData.width, h: imageData.height })
}

/** Clear all map objects from a wrapper */
export function clearAllObjects(wrapper: GMapWrapper): void {
  wrapper.markers.forEach(m => m.setMap(null))
  wrapper.markers.clear()
  wrapper.polygons.forEach(p => p.setMap(null))
  wrapper.polygons.clear()
  wrapper.polylines.forEach(p => p.setMap(null))
  wrapper.polylines.clear()
  wrapper.circles.forEach(c => c.setMap(null))
  wrapper.circles.clear()
  wrapper.featureIndex.clear()
  wrapper.infoWindow.close()
}

/** Add a marker to the wrapper, keyed by ID */
export function addMarker(
  wrapper: GMapWrapper,
  id: string,
  lat: number,
  lng: number,
  options: {
    iconUrl?: string
    iconName?: string
    rotation?: number
    scale?: number
    visible?: boolean
    draggable?: boolean
    zIndex?: number
    label?: string
    labelColor?: string
    onClick?: () => void
    onDragEnd?: (lat: number, lng: number) => void
    featureType?: string
    featureProps?: Record<string, any>
  } = {},
): google.maps.Marker {
  // Remove existing marker with same ID
  const existing = wrapper.markers.get(id)
  if (existing) existing.setMap(null)

  const iconUrl = options.iconUrl || (options.iconName ? wrapper.iconCache.get(options.iconName) : undefined)

  let icon: google.maps.Icon | google.maps.Symbol | undefined
  if (iconUrl) {
    const s = options.scale || 1
    icon = {
      url: iconUrl,
      scaledSize: new google.maps.Size(24 * s, 24 * s),
      anchor: new google.maps.Point(12 * s, 12 * s),
      rotation: options.rotation || 0,
    } as google.maps.Icon
  } else {
    icon = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: (options.scale || 1) * 8,
      fillColor: '#22C55E',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 1.5,
      rotation: options.rotation || 0,
    }
  }

  const marker = new google.maps.Marker({
    position: { lat, lng },
    map: wrapper.gmap,
    icon,
    visible: options.visible !== false,
    draggable: options.draggable || false,
    zIndex: options.zIndex,
    ...(options.label ? {
      label: {
        text: options.label,
        color: options.labelColor || '#FFFFFF',
        fontWeight: 'bold',
        fontSize: '12px',
      },
    } : {}),
  })

  if (options.onClick) {
    marker.addListener('click', options.onClick)
  }

  if (options.onDragEnd) {
    const cb = options.onDragEnd
    marker.addListener('dragend', () => {
      const pos = marker.getPosition()
      if (pos) cb(pos.lat(), pos.lng())
    })
  }

  wrapper.markers.set(id, marker)

  // Update spatial index
  if (options.featureType || options.featureProps) {
    wrapper.featureIndex.set(id, {
      lat, lng,
      type: options.featureType || '',
      props: options.featureProps || {},
    })
  }

  return marker
}

/** Query features within a bounding box (replaces queryRenderedFeatures) */
export function queryFeaturesInBounds(
  wrapper: GMapWrapper,
  bounds: google.maps.LatLngBounds,
): { id: string; lat: number; lng: number; type: string; props: Record<string, any> }[] {
  const results: { id: string; lat: number; lng: number; type: string; props: Record<string, any> }[] = []
  wrapper.featureIndex.forEach((entry, id) => {
    if (bounds.contains({ lat: entry.lat, lng: entry.lng })) {
      results.push({ id, ...entry })
    }
  })
  return results
}

/** Query the nearest feature to a point within a pixel threshold */
export function queryFeatureAtPoint(
  wrapper: GMapWrapper,
  lat: number,
  lng: number,
  thresholdMeters: number = 50,
): { id: string; lat: number; lng: number; type: string; props: Record<string, any> } | null {
  let nearest: { id: string; lat: number; lng: number; type: string; props: Record<string, any> } | null = null
  let minDist = thresholdMeters

  wrapper.featureIndex.forEach((entry, id) => {
    const dist = haversineMeters(lat, lng, entry.lat, entry.lng)
    if (dist < minDist) {
      minDist = dist
      nearest = { id, ...entry }
    }
  })

  return nearest
}

/** Haversine distance in meters */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Convert pixel coordinates to LatLng using the map's overlay projection */
export function pixelToLatLng(
  wrapper: GMapWrapper,
  x: number,
  y: number,
): { lat: number; lng: number } | null {
  const bounds = wrapper.gmap.getBounds()
  const div = wrapper.gmap.getDiv()
  if (!bounds || !div) return null

  const ne = bounds.getNorthEast()
  const sw = bounds.getSouthWest()
  const width = div.clientWidth
  const height = div.clientHeight

  const lng = sw.lng() + (x / width) * (ne.lng() - sw.lng())
  const lat = ne.lat() - (y / height) * (ne.lat() - sw.lat())

  return { lat, lng }
}

/** Create a draggable marker (for bar placement, free move, etc.) */
export function createDraggableMarker(
  wrapper: GMapWrapper,
  lat: number,
  lng: number,
  color: string,
  size: number = 20,
  onDrag?: (lat: number, lng: number) => void,
  onDragEnd?: (lat: number, lng: number) => void,
): google.maps.Marker {
  const marker = new google.maps.Marker({
    position: { lat, lng },
    map: wrapper.gmap,
    draggable: true,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: size / 2,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 3,
    },
    zIndex: 9999,
  })

  if (onDrag) {
    marker.addListener('drag', () => {
      const pos = marker.getPosition()
      if (pos) onDrag(pos.lat(), pos.lng())
    })
  }

  if (onDragEnd) {
    marker.addListener('dragend', () => {
      const pos = marker.getPosition()
      if (pos) onDragEnd(pos.lat(), pos.lng())
    })
  }

  return marker
}

export { initGoogleMaps, isGoogleMapsConfigured, GOOGLE_MAP_OPTIONS }
