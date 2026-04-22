'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'

// Kiosk roles (airfield_status, atc) only see the Airfield Status
// page. If they land on any other route — whether by typed URL,
// stale bookmark, or unexpected nav — bounce them back to `/`.
// Ships as a side-effect component; renders nothing.
export function KioskGuard() {
  const { userRole, loaded } = useInstallation()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loaded) return
    if (userRole !== 'airfield_status' && userRole !== 'atc') return
    if (pathname !== '/') router.replace('/')
  }, [loaded, userRole, pathname, router])

  return null
}
