'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

// Installed PWAs can run a stale bundle long after a deploy: the resident app
// rarely re-fetches sw.js (no full navigations), and even when the new worker
// activates (skipWaiting/clientsClaim are on by default), the running page
// keeps its already-loaded JS until a reload. Field devices that stay open on
// the flightline can lag production by weeks — the 2026-07 Volk/Ebbing
// "question-mark markers" report was exactly this. This component closes both
// gaps: it checks for a new worker proactively, and when one takes over it
// offers a one-tap refresh instead of waiting for a navigation that may never
// happen.
const CHECK_INTERVAL_MS = 30 * 60 * 1000
const TOAST_ID = 'pwa-update'

export function PwaUpdateToast() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const promptReload = () => {
      toast.info('A new version of Glidepath is available.', {
        id: TOAST_ID, // dedupes the controllerchange + updatefound double-fire
        duration: Number.POSITIVE_INFINITY,
        action: { label: 'Refresh', onClick: () => window.location.reload() },
      })
    }

    // A fresh install claims the page too (clientsClaim) — only a page that
    // already HAD a controller is stale when the controller changes.
    const hadController = !!navigator.serviceWorker.controller
    const onControllerChange = () => {
      if (hadController) promptReload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    let reg: ServiceWorkerRegistration | undefined
    let interval: ReturnType<typeof setInterval> | undefined
    const checkForUpdate = () => reg?.update().catch(() => {})
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    }

    navigator.serviceWorker.getRegistration().then((r) => {
      if (!r) return
      reg = r
      // A worker parked in `waiting` (some browsers defer activation) is an
      // already-downloaded update — surface it now.
      if (r.waiting && navigator.serviceWorker.controller) promptReload()
      r.addEventListener('updatefound', () => {
        const sw = r.installing
        if (!sw) return
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) promptReload()
        })
      })
      interval = setInterval(checkForUpdate, CHECK_INTERVAL_MS)
      document.addEventListener('visibilitychange', onVisible)
    })

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVisible)
      if (interval) clearInterval(interval)
    }
  }, [])

  return null
}
