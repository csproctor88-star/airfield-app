const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  cacheOnFrontEndNav: true,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        // Never cache Supabase API requests — the app's IndexedDB handles offline data
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
        // Cache Mapbox resources (sprites, glyphs, API token validation)
        urlPattern: /api\.mapbox\.com/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'mapbox-api',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
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
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
