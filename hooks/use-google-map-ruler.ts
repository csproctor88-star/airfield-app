import { useEffect, useRef, useCallback, useState } from 'react'
import { distanceFt, bearing } from '@/lib/calculations/geometry'

type RulerPoint = { lat: number; lng: number }

function formatDist(ft: number): string {
  if (ft >= 5280) return `${(ft / 5280).toFixed(2)} mi`
  return `${Math.round(ft)} ft`
}

/**
 * Google Maps ruler hook. When active, clicks on the map add measurement points.
 * Segments show distance labels. Press Escape or toggle off to clear.
 */
export function useGoogleMapRuler(
  gmapRef: React.MutableRefObject<google.maps.Map | null>,
  active: boolean,
) {
  const [points, setPoints] = useState<RulerPoint[]>([])
  const pointsRef = useRef(points)
  pointsRef.current = points

  // Map objects for cleanup
  const markersRef = useRef<google.maps.Marker[]>([])
  const polylinesRef = useRef<google.maps.Polyline[]>([])
  const labelsRef = useRef<google.maps.Marker[]>([])
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null)

  const clearObjects = useCallback(() => {
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    polylinesRef.current.forEach(p => p.setMap(null))
    polylinesRef.current = []
    labelsRef.current.forEach(l => l.setMap(null))
    labelsRef.current = []
  }, [])

  const clear = useCallback(() => {
    setPoints([])
    clearObjects()
  }, [clearObjects])

  // Render points, lines, and labels
  const render = useCallback((pts: RulerPoint[]) => {
    const gmap = gmapRef.current
    if (!gmap) return
    clearObjects()

    if (pts.length === 0) return

    // Draw dots at each point
    for (const pt of pts) {
      const marker = new google.maps.Marker({
        position: pt,
        map: gmap,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#22D3EE',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
        zIndex: 10000,
        clickable: false,
      })
      markersRef.current.push(marker)
    }

    // Draw line segments with distance labels
    let totalFt = 0
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      const segFt = distanceFt({ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng })
      totalFt += segFt

      // Polyline
      const line = new google.maps.Polyline({
        path: [a, b],
        strokeColor: '#22D3EE',
        strokeWeight: 2.5,
        strokeOpacity: 0.9,
        map: gmap,
        zIndex: 9999,
        clickable: false,
      })
      polylinesRef.current.push(line)

      // Segment label at midpoint
      const midLat = (a.lat + b.lat) / 2
      const midLng = (a.lng + b.lng) / 2
      const lbl = new google.maps.Marker({
        position: { lat: midLat, lng: midLng },
        map: gmap,
        label: {
          text: formatDist(segFt),
          color: '#FFFFFF',
          fontWeight: 'bold',
          fontSize: '12px',
          className: 'ruler-label',
        },
        icon: {
          path: 'M -30,-10 L 30,-10 L 30,10 L -30,10 Z',
          fillColor: 'rgba(0,60,80,0.9)',
          fillOpacity: 1,
          strokeColor: '#22D3EE',
          strokeWeight: 1,
          scale: 0.55,
          anchor: new google.maps.Point(0, 0),
        },
        zIndex: 10001,
        clickable: false,
      })
      labelsRef.current.push(lbl)
    }

    // Total label at last point (if 2+ segments)
    if (pts.length > 2) {
      const last = pts[pts.length - 1]
      const brg = bearing(
        { lat: pts[0].lat, lon: pts[0].lng },
        { lat: last.lat, lon: last.lng },
      )
      const totalLbl = new google.maps.Marker({
        position: last,
        map: gmap,
        label: {
          text: `Total: ${formatDist(totalFt)} | ${brg.toFixed(0)}°`,
          color: '#67E8F9',
          fontWeight: 'bold',
          fontSize: '11px',
          className: 'ruler-total-label',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 0,
        },
        zIndex: 10002,
        clickable: false,
      })
      labelsRef.current.push(totalLbl)
    }
  }, [gmapRef, clearObjects])

  // Listen for map clicks when active
  useEffect(() => {
    const gmap = gmapRef.current
    if (!gmap || !active) {
      if (listenerRef.current) {
        google.maps.event.removeListener(listenerRef.current)
        listenerRef.current = null
      }
      return
    }

    listenerRef.current = gmap.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      const newPt: RulerPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() }
      const updated = [...pointsRef.current, newPt]
      setPoints(updated)
      render(updated)
    })

    return () => {
      if (listenerRef.current) {
        google.maps.event.removeListener(listenerRef.current)
        listenerRef.current = null
      }
    }
  }, [active, gmapRef, render])

  // Escape key to clear
  useEffect(() => {
    if (!active) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [active, clear])

  // Clear when deactivated
  useEffect(() => {
    if (!active) clear()
  }, [active, clear])

  const totalFt = points.reduce((sum, pt, i) => {
    if (i === 0) return 0
    return sum + distanceFt(
      { lat: points[i - 1].lat, lon: points[i - 1].lng },
      { lat: pt.lat, lon: pt.lng },
    )
  }, 0)

  return { points, totalFt, clear, formatDist }
}
