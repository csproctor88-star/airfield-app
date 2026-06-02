'use client'

// OpenLayers Visual NAVAIDs map — PILOT (read-only), gated behind ?renderer=ol
// on /infrastructure. Renders the same featureGeoJson the Google map uses, to
// validate OL's smoothness + the Esri/C2IMERA WMTS imagery on the AF network
// before the full migration. Lights = meter-accurate circles (scale with the
// map); signs = labeled icons (rotation baked); click = popup. Canvas renderer
// only (no WebGL) so the AF-network throttle doesn't apply. Edit Mode is not
// wired here yet — it stays on the Google path.

import { useEffect, useRef } from 'react'
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
import { fromLonLat, getPointResolution } from 'ol/proj'
import { createImageryLayer, createBaseView } from '@/lib/openlayers'
import type { MapProvider } from '@/lib/map-providers'

const LIGHT_RADIUS_METERS = 1.5
const SIGN_TARGET_METERS = 9 // real-world height a sign represents (drives zoom scaling)

type LayerCfg = { key: string; color: string; types: string[]; renderType: 'circle' | 'symbol'; strokeColor?: string }

// Duplicated (intentionally, for the standalone pilot) from the page's sign
// rendering — colors + a rotation-baked labeled-sign image.
const SIGN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  location_sign: { bg: '#000000', text: '#FBBF24', border: '#FBBF24' },
  mandatory_sign: { bg: '#CC0000', text: '#FFFFFF', border: '#FFFFFF' },
  directional_sign: { bg: '#FBBF24', text: '#000000', border: '#000000' },
  informational_sign: { bg: '#FBBF24', text: '#000000', border: '#000000' },
  runway_distance_marker: { bg: '#000000', text: '#FFFFFF', border: '#FFFFFF' },
}

function makeSignImage(text: string, c: { bg: string; text: string; border: string }, rotation: number): { url: string; h: number } {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const fontSize = 28
  const font = `bold ${fontSize}px system-ui, sans-serif`
  ctx.font = font
  const textW = Math.ceil(ctx.measureText(text).width)
  const padX = 16, padY = 10, borderW = 4
  const w = textW + padX * 2 + borderW * 2
  const h = fontSize + padY * 2 + borderW * 2
  const rad = ((rotation || 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad))
  const cw = Math.ceil(w * cos + h * sin), ch = Math.ceil(w * sin + h * cos)
  canvas.width = cw
  canvas.height = ch
  ctx.translate(cw / 2, ch / 2)
  ctx.rotate(rad)
  ctx.translate(-w / 2, -h / 2)
  ctx.fillStyle = c.border
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = c.bg
  ctx.fillRect(borderW, borderW, w - borderW * 2, h - borderW * 2)
  ctx.font = font
  ctx.fillStyle = c.text
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2)
  return { url: canvas.toDataURL('image/png'), h: ch }
}

type Meta =
  | { kind: 'circle'; color: string; strokeColor: string; strokeW: number; popup: string }
  | { kind: 'sign'; url: string; naturalH: number; popup: string }

// Style caches keyed by quantized inputs so we don't allocate per-frame.
const circleCache = new Map<string, Style>()
function circleStyle(color: string, strokeColor: string, strokeW: number, rPx: number): Style {
  const key = `${color}|${strokeColor}|${strokeW}|${rPx}`
  let s = circleCache.get(key)
  if (!s) {
    s = new Style({ image: new CircleStyle({ radius: rPx, fill: new Fill({ color }), stroke: new Stroke({ color: strokeColor, width: strokeW }) }) })
    circleCache.set(key, s)
  }
  return s
}
const iconCache = new Map<string, Style>()
function iconStyle(url: string, scale: number): Style {
  const key = `${url}|${scale}`
  let s = iconCache.get(key)
  if (!s) {
    s = new Style({ image: new Icon({ src: url, scale, rotateWithView: false }) })
    iconCache.set(key, s)
  }
  return s
}

export function OlNavaidsMap({
  featureGeoJson,
  layers,
  visibleLayers,
  mapProvider,
  center,
  zoom = 16,
}: {
  featureGeoJson: GeoJSON.FeatureCollection
  layers: LayerCfg[]
  visibleLayers: Record<string, boolean>
  mapProvider: MapProvider
  center: [number, number]
  zoom?: number
}) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<OlMap | null>(null)
  const sourceRef = useRef<VectorSource | null>(null)
  const imageryRef = useRef<ReturnType<typeof createImageryLayer> | null>(null)
  const popupElRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<Overlay | null>(null)

  // Build the map once.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const source = new VectorSource()
    sourceRef.current = source
    const featureLayer = new VectorLayer({
      source,
      style: (feature, resolution) => {
        const m = feature.get('meta') as Meta
        const geom = feature.getGeometry() as Point
        const ground = getPointResolution('EPSG:3857', resolution, geom.getCoordinates())
        if (m.kind === 'circle') {
          const r = Math.max(LIGHT_RADIUS_METERS / ground, 1.5)
          return circleStyle(m.color, m.strokeColor, m.strokeW, Math.round(r * 2) / 2)
        }
        const raw = SIGN_TARGET_METERS / ground / m.naturalH
        const scale = Math.min(1.2, Math.max(0.15, Math.round(raw * 20) / 20))
        return iconStyle(m.url, scale)
      },
    })
    const imagery = createImageryLayer(mapProvider)
    imageryRef.current = imagery
    const popupEl = document.createElement('div')
    popupElRef.current = popupEl
    const overlay = new Overlay({ element: popupEl, autoPan: false, stopEvent: true, offset: [0, -8] })
    overlayRef.current = overlay
    const map = new OlMap({
      target: elRef.current,
      layers: [imagery, featureLayer],
      overlays: [overlay],
      view: createBaseView(center, zoom),
    })
    // The target mounts via the ?renderer=ol flag flip, so OL may read a 0x0
    // size at creation and render blank. Force a size recompute after layout
    // and on any container resize.
    requestAnimationFrame(() => map.updateSize())
    const ro = new ResizeObserver(() => map.updateSize())
    ro.observe(elRef.current)
    map.on('singleclick', (e) => {
      const hit = map.forEachFeatureAtPixel(e.pixel, (f) => f as Feature, { hitTolerance: 4 })
      if (hit) {
        popupEl.innerHTML = (hit.get('meta') as Meta).popup
        overlay.setPosition((hit.getGeometry() as Point).getCoordinates())
      } else {
        overlay.setPosition(undefined)
      }
    })
    mapRef.current = map
    return () => {
      ro.disconnect()
      map.setTarget(undefined)
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap imagery when the provider changes (skip the first run — the build
  // effect already added the correct imagery layer).
  const lastProviderRef = useRef<MapProvider>(mapProvider)
  useEffect(() => {
    const map = mapRef.current
    const old = imageryRef.current
    if (!map || !old) return
    if (lastProviderRef.current === mapProvider) return
    lastProviderRef.current = mapProvider
    const next = createImageryLayer(mapProvider)
    map.getLayers().insertAt(0, next)
    map.removeLayer(old)
    imageryRef.current = next
  }, [mapProvider])

  // Rebuild features when data or layer visibility changes.
  useEffect(() => {
    const source = sourceRef.current
    if (!source) return
    const byType = new Map<string, LayerCfg>()
    for (const lc of layers) for (const t of lc.types) byType.set(t, lc)

    const feats: Feature[] = []
    for (const gf of featureGeoJson.features) {
      const p = (gf.properties || {}) as Record<string, unknown>
      const type = String(p.type ?? '')
      const lc = byType.get(type)
      if (!lc) continue
      if (visibleLayers[lc.key] === false) continue
      const [lng, lat] = (gf.geometry as GeoJSON.Point).coordinates
      const inop = p.status === 'inoperative'
      const label = String(p.text ?? '')
      const popup = `<div style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:8px 10px;font-size:12px;max-width:240px;font-family:system-ui,sans-serif;">
        <div style="font-weight:700;margin-bottom:2px;">${escapeHtml(label || lc.key.replace(/_/g, ' '))}</div>
        <div style="color:#94a3b8;">${escapeHtml(type.replace(/_/g, ' '))} · ${inop ? '<span style="color:#f87171;font-weight:700;">INOP</span>' : 'Operational'}</div>
      </div>`

      const f = new Feature({ geometry: new Point(fromLonLat([lng, lat])) })
      const signColors = SIGN_COLORS[type]
      if (label && signColors) {
        const img = makeSignImage(label, signColors, Number(p.rotation) || 0)
        f.set('meta', { kind: 'sign', url: img.url, naturalH: img.h, popup } as Meta)
      } else {
        const color = inop ? '#EF4444' : lc.color
        f.set('meta', { kind: 'circle', color, strokeColor: inop ? '#FFFFFF' : lc.strokeColor || '#000000', strokeW: inop ? 2 : 1, popup } as Meta)
      }
      feats.push(f)
    }
    source.clear()
    source.addFeatures(feats)
    overlayRef.current?.setPosition(undefined)
  }, [featureGeoJson, visibleLayers, layers])

  return (
    <>
      <div ref={elRef} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: 'color-mix(in srgb, var(--color-accent) 18%, var(--color-bg-surface))', border: '1px solid var(--color-accent)', color: 'var(--color-text-1)', borderRadius: 999, padding: '3px 10px', fontSize: 'var(--fs-xs)', fontWeight: 700, pointerEvents: 'none' }}>
        OpenLayers preview (read-only)
      </div>
    </>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
