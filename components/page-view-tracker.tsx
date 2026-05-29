'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'
import { recordPageView } from '@/lib/supabase/page-views'
import { normalizeRoute } from '@/lib/page-view-route'

/**
 * Records normalized page views for the current user/base into the daily
 * rollup (record_page_view RPC). Mounted once in the authenticated shell.
 *
 * Quota-conscious per the project's polling lessons: fires only while the tab
 * is visible, debounces route changes (so quickly-passed-through routes don't
 * count), and dedupes the same route within a short window (avoids React strict
 * mode's double-effect double counting). It does NOT poll — one write per
 * settled navigation.
 */
export function PageViewTracker() {
  const pathname = usePathname()
  const { installationId } = useInstallation()
  const lastRef = useRef<{ key: string; at: number }>({ key: '', at: 0 })

  useEffect(() => {
    if (!pathname || !installationId) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

    const route = normalizeRoute(pathname)
    const key = `${installationId}|${route}`

    const timer = setTimeout(() => {
      const now = Date.now()
      // Dedupe identical route within 3s (strict-mode double effect, fast
      // re-mounts). Genuine re-navigation after the window still counts.
      if (lastRef.current.key === key && now - lastRef.current.at < 3000) return
      lastRef.current = { key, at: now }
      void recordPageView(route, installationId)
    }, 1200)

    return () => clearTimeout(timer)
  }, [pathname, installationId])

  return null
}
