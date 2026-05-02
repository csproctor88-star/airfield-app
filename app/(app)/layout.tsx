import { Header } from '@/components/layout/header'

import { BottomNav } from '@/components/layout/bottom-nav'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { KioskGuard } from '@/components/layout/kiosk-guard'
import { ScrollToTop } from '@/components/scroll-to-top'
import { RealtimeAlertBanner } from '@/components/realtime-alert-banner'
import { WhatsNewGate } from '@/components/whats-new-gate'
import { WelcomeGate } from '@/components/welcome-gate'
import { TourLauncher } from '@/components/tour/tour-launcher'
import { WriteQueueProvider } from '@/components/sync/write-queue-provider'
import { OfflineCacheProvider } from '@/components/sync/offline-cache-provider'
import { DashboardProvider } from '@/lib/dashboard-context'
import { InstallationProvider } from '@/lib/installation-context'
import { SidebarProvider } from '@/lib/sidebar-context'

// Authenticated app shell with header + sidebar (tablet/desktop) + bottom nav (mobile)
// All pages inside (app)/ get this layout (home, discrepancies, checks, etc.)

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="app-shell"
      style={{
        fontFamily: "'Outfit', -apple-system, sans-serif",
        background: 'var(--color-bg)',
        color: 'var(--color-text-1)',
        minHeight: '100dvh',
      }}
    >
      <SidebarProvider>
        <InstallationProvider>
          <DashboardProvider>
            <SidebarNav />
            <div className="app-main">
              <Header />
              <ScrollToTop />
              <KioskGuard />
              <RealtimeAlertBanner />
              <WelcomeGate />
              <WhatsNewGate />
              <TourLauncher />
              <WriteQueueProvider />
              <OfflineCacheProvider />
              <main className="app-content">
                {children}
              </main>
              <BottomNav />
            </div>
          </DashboardProvider>
        </InstallationProvider>
      </SidebarProvider>
    </div>
  )
}
