'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/** Scrolls to top on route changes (Next.js App Router doesn't do this automatically) */
export function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
