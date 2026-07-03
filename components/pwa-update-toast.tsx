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

    // A worker parked in `waiting` is NOT activated by a plain reload — the
    // old worker keeps controlling every load and the toast re-prompts
    // forever. Ask it to take over first; if it hasn't within the timeout
    // (our generated sw.js has no SKIP_WAITING listener, and a wedged old
    // worker can block promotion indefinitely), drop the registration and
    // let the reload re-register the current sw.js from scratch. The offline
    // write queue lives in IndexedDB/localStorage and is unaffected; Cache
    // Storage repopulates on the next loads.
    const applyUpdate = async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg?.waiting) {
        window.location.reload()
        return
      }
      const promoted = new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 2500)
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => {
            clearTimeout(timer)
            resolve(true)
          },
          { once: true }
        )
      })
      reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      if (!(await promoted)) await reg.unregister().catch(() => {})
      window.location.reload()
    }

    const promptReload = () => {
      toast.info('A new version of Glidepath is available.', {
        id: TOAST_ID, // dedupes the controllerchange + updatefound double-fire
        duration: Number.POSITIVE_INFINITY,
        action: { label: 'Refresh', onClick: () => void applyUpdate() },
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
