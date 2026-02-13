import { Header } from '@/components/layout/header'
import { BottomNav } from '@/components/layout/bottom-nav'

// Authenticated app shell with header + bottom nav
// All pages inside (app)/ get this layout (home, discrepancies, checks, etc.)

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'Outfit', -apple-system, sans-serif",
        background: '#04070C',
        color: '#F1F5F9',
        minHeight: '100vh',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <Header />
      {children}
      <BottomNav />
    </div>
  )
}
