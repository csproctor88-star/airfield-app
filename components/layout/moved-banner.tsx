'use client'

import { useEffect, useState } from 'react'

// One-time "the app moved to app.glidepathops.com" notice for the Phase 5 domain
// cutover. Shows exactly once per device: the moment it first paints it writes a
// localStorage flag and never renders again on that browser — it does NOT reappear
// on later app opens, dismissed or not. A date backstop also suppresses it entirely
// after the transition window so late/new users never see a stale notice; the whole
// component can then be deleted in a cleanup commit.
const SEEN_KEY = 'glidepath-moved-notice-seen'
// Backstop — set to ~3 weeks past the actual cutover date; owner may adjust.
const HIDE_AFTER = Date.parse('2026-08-06T00:00:00Z')

export function MovedBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (Date.now() > HIDE_AFTER) return
    if (localStorage.getItem(SEEN_KEY)) return
    // Mark seen on first paint (NOT gated on a click) so a user who ignores the
    // banner and navigates away still never sees it twice.
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
    setShow(true)
  }, [])

  if (!show) return null

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '10px 16px',
        background: 'var(--color-amber-bg, rgba(245, 158, 11, 0.12))',
        borderBottom: '1px solid var(--color-amber, #f59e0b)',
        color: 'var(--color-text-1)',
        fontSize: 'var(--fs-sm, 0.875rem)',
        textAlign: 'center',
      }}
    >
      <span>
        Glidepath now lives at{' '}
        <strong style={{ color: 'var(--color-amber, #f59e0b)' }}>app.glidepathops.com</strong>
        {' '}— update your bookmark and reinstall the app from there.
      </span>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-2, #9ca3af)',
          cursor: 'pointer',
          fontSize: '1.1rem',
          lineHeight: 1,
          padding: 4,
        }}
      >
        ×
      </button>
    </div>
  )
}
