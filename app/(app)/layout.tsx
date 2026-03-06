import { Header } from '@/components/layout/header'

import { BottomNav } from '@/components/layout/bottom-nav'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { ScrollToTop } from '@/components/scroll-to-top'
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
          <SidebarNav />
          <div className="app-main">
            <Header />

            <ScrollToTop />
            <DashboardProvider>
              <main className="app-content">
                {children}
              </main>
            </DashboardProvider>
            <BottomNav />
          </div>
        </InstallationProvider>
      </SidebarProvider>
    </div>
  )
}
