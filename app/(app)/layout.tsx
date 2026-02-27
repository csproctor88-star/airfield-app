import { Header } from '@/components/layout/header'
import { BottomNav } from '@/components/layout/bottom-nav'
import { DashboardProvider } from '@/lib/dashboard-context'
import { InstallationProvider } from '@/lib/installation-context'

// Authenticated app shell with header + bottom nav
// All pages inside (app)/ get this layout (home, discrepancies, checks, etc.)

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'Outfit', -apple-system, sans-serif",
        background: 'var(--color-bg)',
        color: 'var(--color-text-1)',
        minHeight: '100dvh',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <InstallationProvider>
        <Header />
        <DashboardProvider>
          {children}
        </DashboardProvider>
        <BottomNav />
      </InstallationProvider>
    </div>
  )
}
