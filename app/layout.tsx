import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/lib/theme-context'
import { DesignProvider } from '@/lib/design-context'
import './globals.css'

// v2 design typography pairing — loaded as CSS variables and only applied
// when `[data-design="v2"]` is set (see globals.css). v1 keeps Outfit.
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
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B1120',
}

// Inline script that runs synchronously before React hydrates
// to prevent flash of wrong theme.
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('glidepath_theme') || 'auto';
    var r = t === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t;
    document.documentElement.setAttribute('data-theme', r);
    var d = localStorage.getItem('glidepath_design');
    if (d === 'v2') document.documentElement.setAttribute('data-design', 'v2');
    var bg = r === 'light' ? '#F8FAFC' : '#0B1120';
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
    <html lang="en" spellCheck suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable}`} style={{ background: '#0B1120' }}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans" style={{ minHeight: '100dvh', background: '#0B1120' }}>
        <ThemeProvider>
          <DesignProvider>
          {children}
          </DesignProvider>
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
