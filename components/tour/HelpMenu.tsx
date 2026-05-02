'use client'

import { type CSSProperties } from 'react'
import { GraduationCap } from 'lucide-react'

/**
 * Sidebar-footer "View App Tutorial" button. One click launches the
 * app tour (sidebar variant on desktop, /more variant on mobile —
 * `TourLauncher` decides which based on the current viewport).
 *
 * The wizard's own onboarding tour stays on the wizard page (it has
 * its own Replay link there), so this button only ever launches the
 * app-tour family.
 */
export function HelpMenu({
  collapsed = false,
  className,
  style,
}: {
  collapsed?: boolean
  className?: string
  style?: CSSProperties
}) {
  function launch() {
    const isDesktop =
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 1024px)').matches
    const tourId = isDesktop ? 'app-sidebar' : 'app-mobile-nav'
    window.dispatchEvent(new CustomEvent('glidepath:tour-launch', {
      detail: { tourId },
    }))
  }

  return (
    <button
      type="button"
      onClick={launch}
      title={collapsed ? 'View App Tutorial' : undefined}
      data-tour="sidebar-help"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: collapsed ? 0 : 6,
        width: '100%',
        padding: '8px 0',
        borderRadius: 'var(--radius-md)',
        background: 'none',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-3)',
        fontSize: 'var(--fs-sm)',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      <GraduationCap size={13} />
      {!collapsed && <span>View App Tutorial</span>}
    </button>
  )
}
