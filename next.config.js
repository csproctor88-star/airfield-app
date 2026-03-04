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
