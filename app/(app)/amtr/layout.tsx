'use client'

import { useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { AmtrModuleBar } from '@/components/amtr/module-bar'

const MOBILE_MAX_PX = 768
const NOTICE_DISMISS_KEY = 'amtr-mobile-notice-dismissed'

// Wraps every /amtr route so the Help / Training References / Admin actions stay
// reachable from any page in the module.
export default function AmtrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AmtrModuleBar />
      <MobileNotice />
      {children}
    </>
  )
}

// Small dismissible banner shown only on phone-width screens, warning
// operators that AMTR's table-heavy layouts don't render well below
// tablet width. Dismissal persists for the session (sessionStorage) so
// it doesn't nag on every page change.
function MobileNotice() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_PX}px)`)
    const dismissed = sessionStorage.getItem(NOTICE_DISMISS_KEY) === '1'
    const update = () => setShow(mq.matches && !dismissed)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  if (!show) return null

  const dismiss = () => {
    if (typeof window !== 'undefined') sessionStorage.setItem(NOTICE_DISMISS_KEY, '1')
    setShow(false)
  }

  return (
    <div role="note" style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
      borderBottom: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)',
      background: 'color-mix(in srgb, var(--color-warning) 14%, transparent)',
      color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.4,
    }}>
      <Smartphone size={16} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1 }}>
        <strong style={{ color: 'var(--color-warning)' }}>Best on tablet or larger.</strong>{' '}
        The training record uses wide tables for JQS, 1098, and 623A — they don&apos;t render cleanly on phone-width screens. Use a tablet or desktop for full functionality.
      </span>
      <button onClick={dismiss} aria-label="Dismiss notice"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 0, lineHeight: 0, flexShrink: 0 }}>
        <X size={16} />
      </button>
    </div>
  )
}
