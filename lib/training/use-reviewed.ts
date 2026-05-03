'use client'

import { useState, useEffect, useCallback } from 'react'
import { getCompletedTours, markTourCompleted, unmarkTourCompleted } from '@/lib/tours/state'

/**
 * Per-user reviewed-modules tracking. Stored under the `training:<id>`
 * namespace inside the existing `profiles.tours_completed` JSONB so no
 * migration is needed — the column was added by 2026050202 for tour
 * completion and is already RLS-scoped to the auth user.
 *
 * Returns:
 *   reviewed     — Set<moduleId> of modules the user has marked reviewed
 *   loaded       — true after the initial load completes (use to gate UI flicker)
 *   isReviewed   — predicate
 *   toggle       — flip a module's reviewed state (optimistic; persists in background)
 */
const TRAINING_PREFIX = 'training:'

function unwrapKey(rawKey: string): string | null {
  if (!rawKey.startsWith(TRAINING_PREFIX)) return null
  return rawKey.slice(TRAINING_PREFIX.length)
}

export function useReviewedModules() {
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const map = await getCompletedTours()
        if (cancelled) return
        const next = new Set<string>()
        for (const [k, v] of Object.entries(map)) {
          if (!v) continue
          const id = unwrapKey(k)
          if (id) next.add(id)
        }
        setReviewed(next)
      } catch {
        // Best-effort — empty set falls through.
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const isReviewed = useCallback((id: string) => reviewed.has(id), [reviewed])

  const toggle = useCallback(async (id: string) => {
    const willBeReviewed = !reviewed.has(id)
    // Optimistic update so the UI flips immediately.
    setReviewed(prev => {
      const next = new Set(prev)
      if (willBeReviewed) next.add(id)
      else next.delete(id)
      return next
    })
    try {
      if (willBeReviewed) {
        await markTourCompleted(`${TRAINING_PREFIX}${id}`)
      } else {
        await unmarkTourCompleted(`${TRAINING_PREFIX}${id}`)
      }
    } catch {
      // Roll back on failure.
      setReviewed(prev => {
        const next = new Set(prev)
        if (willBeReviewed) next.delete(id)
        else next.add(id)
        return next
      })
    }
  }, [reviewed])

  return { reviewed, loaded, isReviewed, toggle }
}
