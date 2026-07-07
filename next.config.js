const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  cacheOnFrontEndNav: true,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        // Offline-readable tables — NetworkFirst so online users always get fresh
        // data, but offline falls back to whatever was last seen. The 18 tables
        // listed back the 7 pages the customer wants offline (QRC, PPR, Personnel
        // on Airfield, Discrepancies, Reference Library, Aircraft, Waivers) plus
        // the shared installation/auth context every page needs to render.
        // Caches are scoped via Workbox's URL key only — auth bearer tokens are
        // not part of the key, so we wipe these caches on sign-out (see
        // OfflineCacheProvider) to prevent cross-user leakage on shared devices.
        urlPattern: /\.supabase\.co\/rest\/v1\/(qrc_templates|qrc_executions|ppr_columns|ppr_entries|airfield_contractors|discrepancies|photos|pdf_extraction_status|pdf_text_pages|waivers|waiver_criteria|waiver_attachments|waiver_reviews|waiver_coordination|infrastructure_features|lighting_system_components|lighting_systems|discrepancy_status_updates|bases|installation_runways|installation_areas|airfield_facilities|profiles)(\?|$)/,
        method: 'GET',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'glidepath-offline-reads-rest',
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
          cacheableResponse: {
            statuses: [200],
          },
        },
      },
      {
        // Storage objects (photos, regulation PDFs, waiver attachments) — CacheFirst
        // since storage URLs are content-addressable. Capped to keep IDB footprint
        // sane on field tablets.
        // Matches `/storage/v1/object/<bucket>/<path>`, `/object/public/<bucket>/<path>`,
        // `/object/sign/<bucket>/<path>?token=...`, and `/object/authenticated/...`.
        // Note: signed URLs change tokens per fetch — cache entries dedupe by URL,
        // so a re-mint creates a new entry. The `expiration.maxEntries` cap keeps
        // this bounded via LRU. Signed-URL re-mint *itself* requires the network,
        // so waiver attachments cached here are only useful if the page can hand
        // the SW the same URL it cached against.
        urlPattern: /\.supabase\.co\/storage\/v1\/object\/(?:[^/?]+\/)?(photos|regulation-pdfs|waiver-attachments)\//,
        method: 'GET',
        handler: 'CacheFirst',
        options: {
          cacheName: 'glidepath-offline-reads-storage',
          expiration: {
            maxEntries: 1000,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Catch-all: every other Supabase request (writes, auth, RPC, realtime,
        // tables not whitelisted above) is NetworkOnly — the app's offline write
        // queue is the offline path for mutations.
        urlPattern: /\.supabase\.co\/.*/,
        handler: 'NetworkOnly',
        options: {
          cacheName: 'supabase-api',
        },
      },
      {
        // Always fetch fresh manifest so PWA theme/colors update without reinstall
        urlPattern: /\/manifest\.json$/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'manifest',
        },
      },
      {
        // Cache the PDF.js worker for offline PDF rendering
        urlPattern: /\/pdf\.worker\.min\.mjs$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'pdf-worker',
          expiration: {
            maxEntries: 2,
            maxAgeSeconds: 90 * 24 * 60 * 60, // 90 days
          },
        },
      },
      {
        // Cache ESRI satellite tiles — CacheFirst so tiles load instantly after first fetch
        urlPattern: /server\.arcgisonline\.com\/.*\/tile\//,
        handler: 'CacheFirst',
        options: {
          cacheName: 'esri-satellite-tiles',
          expiration: {
            maxEntries: 4000,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache Google satellite tiles (obstruction map)
        urlPattern: /mt\d\.google\.com\/vt\//,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-satellite-tiles',
          expiration: {
            maxEntries: 2000,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache Bing aerial tiles — alternate provider for OCONUS bases.
        // Bing serves from ecn.t{0..3}.tiles.virtualearth.net.
        urlPattern: /ecn\.t\d\.tiles\.virtualearth\.net\/tiles\//,
        handler: 'CacheFirst',
        options: {
          cacheName: 'bing-satellite-tiles',
          expiration: {
            maxEntries: 4000,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache Mapbox satellite tiles (*.tiles.mapbox.com)
        urlPattern: /tiles\.mapbox\.com/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'mapbox-satellite-tiles',
          expiration: {
            maxEntries: 4000,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache Mapbox API resources (styles, sprites, glyphs, token validation)
        urlPattern: /api\.mapbox\.com/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'mapbox-api',
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache Mapbox events/telemetry — just let them through without blocking
        urlPattern: /events\.mapbox\.com/,
        handler: 'NetworkOnly',
        options: {
          cacheName: 'mapbox-events',
        },
      },
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // I-4: don't advertise the framework.
  poweredByHeader: false,
  // Lint is decoupled from the production build. Under CI (Vercel, GitHub
  // Actions both set CI=1) `next build` escalates ESLint *warnings* to build
  // failures — and this project intentionally keeps no-explicit-any /
  // no-unused-vars at "warn". Linting still runs as its own ci.yml step
  // (`npm run lint`), which fails on real errors but not warnings, preserving
  // the pre-Next-15 effective behavior.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Enable image optimization for Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // react-pdf uses canvas internally; alias to false to prevent SSR build errors
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          // L-6: Content-Security-Policy — now ENFORCING (was report-only, which
          // blocked nothing). This is the primary compensating control for the
          // @supabase/ssr JS-readable session cookie: the tight connect-src +
          // img-src allowlists mean an injected script cannot exfiltrate the
          // token to an attacker-controlled origin (fetch/XHR/beacon AND the
          // classic `new Image().src=…` vector are both constrained).
          //
          // 'unsafe-inline' and 'unsafe-eval' are RETAINED deliberately:
          // mapbox-gl compiles style expressions with `new Function` (needs
          // unsafe-eval), and Next.js + the inline theme script need
          // unsafe-inline without a nonce pipeline. They don't weaken the
          // exfiltration defense above — injected code still can't send data
          // out. img-src/connect-src were completed from a scan of every
          // browser-side external host: ESRI + Bing + Mapbox satellite tiles,
          // the QR image service, Open-Meteo weather, and the FWS wildlife
          // image CDN. FAA / OurAirports calls go through same-origin /api
          // routes and need no allowlist entry. If a map/QR/weather feature
          // breaks after promotion, check the console for a CSP violation and
          // add the reported host here. frame-ancestors 'none' mirrors
          // X-Frame-Options: DENY for CSP-aware browsers.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://api.mapbox.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com",
              "img-src 'self' data: blob: https://*.supabase.co https://*.googleapis.com https://*.gstatic.com https://*.mapbox.com https://*.tiles.mapbox.com https://server.arcgisonline.com https://*.tiles.virtualearth.net https://api.qrserver.com https://digitalmedia.fws.gov",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com https://*.mapbox.com https://*.tiles.mapbox.com https://server.arcgisonline.com https://api.open-meteo.com",
              "worker-src 'self' blob:",
              // blob: lets client-generated PDFs (jsPDF `doc.output('blob')` object
              // URLs) preview inline in an <iframe> — the daily-review sign modal,
              // the PDF Library, and the Regulation viewer. Without it the enforcing
              // CSP blocks the frame ('self'/https: don't match the blob: scheme).
              "frame-src 'self' https: blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
