import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/lib/theme-context'
import './globals.css'

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
    <html lang="en" suppressHydrationWarning style={{ background: '#0B1120' }}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans" style={{ minHeight: '100dvh', background: '#0B1120' }}>
        <ThemeProvider>
          {children}
          <Toaster
            position="top-center"
            richColors
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
