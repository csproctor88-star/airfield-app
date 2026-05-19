-- ============================================================
-- Per-base map provider selection
--
-- USAF bases in Germany (Ramstein, Spangdahlem), Netherlands,
-- Belgium, and Italy appear blurred in Google Maps satellite
-- imagery due to host-nation censorship of military sites
-- (BKG mandate in Germany). The blur makes parking diagrams
-- and Visual NAVAID placement effectively unusable at affected
-- installations.
--
-- This column lets a base admin pick an alternate satellite
-- tile source during base setup. The renderer stays Google
-- Maps JS API in all cases — only the satellite imagery layer
-- swaps via google.maps.ImageMapType. Mapbox / MapLibre renderer
-- swaps are NOT viable on the Air Force network due to WebGL
-- throughput throttling (see CLAUDE.md and the wildlife heatmap
-- carve-out).
--
-- Default 'google' preserves current behavior for all existing
-- bases. 'bing' uses Bing Maps Aerial (verified clear on Belgian
-- airfield 2026-05-19; historically blurred in Germany).
-- 'esri' uses Esri ArcGIS World Imagery as a no-token fallback.
-- ============================================================

ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS map_provider TEXT NOT NULL DEFAULT 'google'
  CHECK (map_provider IN ('google', 'bing', 'esri'));
