import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/lib/theme-context'
import './globals.css'

// App typography pairing — IBM Plex Sans (UI) + IBM Plex Mono (operational
// data), applied via `[data-design="v2"]` which is set statically on <html>.
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
})
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Glidepath',
  description: 'Glidepath — Airfield Operations Suite',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AOMS',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0E16',
}

// Inline script that runs synchronously before React hydrates
// to prevent flash of wrong theme. (data-design="v2" is static on <html>.)
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('glidepath_theme') || 'auto';
    var r = t === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t;
    document.documentElement.setAttribute('data-theme', r);
    var bg = r === 'light' ? '#EFEADF' : '#0A0E16';
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
  } catch(e) {}
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" spellCheck suppressHydrationWarning data-design="v2" className={`${plexSans.variable} ${plexMono.variable}`} style={{ background: '#0A0E16' }}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans" style={{ minHeight: '100dvh', background: '#0A0E16' }}>
        <ThemeProvider>
          {children}
          {/* PwaUpdateToast (components/pwa-update-toast.tsx) is intentionally NOT
              mounted: the "new version available" prompt was firing constantly and
              intrusively, and the stale-bundle theory it was built on does not
              explain the Google Maps question-mark markers (still reproducing after
              refresh). Kept dormant — re-mount if we revisit the PWA-refresh angle. */}
          <Toaster
            position="top-center"
            richColors
            visibleToasts={2}
            toastOptions={{
              style: {
                background: 'var(--color-toast-bg)',
                border: '1px solid var(--color-toast-border)',
                color: 'var(--color-toast-text)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
