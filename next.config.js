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
  webpack: (config) => {
    // react-pdf / pdfjs-dist needs canvas as an optional external
    config.resolve.alias.canvas = false
    return config
  },
}

module.exports = nextConfig
