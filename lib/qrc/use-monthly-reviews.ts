'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchUserReviews, markReviewed as persistReview } from '@/lib/supabase/qrc-reviews'
import { getMonthlyReviewStatus, type MonthlyReviewStatus } from './monthly-review-status'
import type { QrcMonthlyReview, QrcTemplate } from '@/lib/supabase/types'

/**
 * Per-user monthly QRC review state for the Reviews tab.
 *
 *   reviews      — Map<templateId, QrcMonthlyReview> of latest review per template
 *   loaded       — true after the initial fetch completes (gate UI flicker)
 *   getStatus    — compute MonthlyReviewStatus for a template
 *   markReviewed — optimistic insert; rolls back on persistence error
 *   refresh      — re-fetch (call after the user changes installation)
 */
export function useMonthlyReviews(baseId: string | null | undefined) {
  const [reviews, setReviews] = useState<Map<string, QrcMonthlyReview>>(new Map())
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!baseId) {
      setReviews(new Map())
      setLoaded(true)
      return
    }
    const rows = await fetchUserReviews(baseId)
    const next = new Map<string, QrcMonthlyReview>()
    for (const r of rows) next.set(r.template_id, r)
    setReviews(next)
    setLoaded(true)
  }, [baseId])

  useEffect(() => {
    setLoaded(false)
    void refresh()
  }, [refresh])

  const getStatus = useCallback(
    (template: Pick<QrcTemplate, 'id' | 'updated_at'>): MonthlyReviewStatus => {
      return getMonthlyReviewStatus(template, reviews.get(template.id) || null)
    },
    [reviews],
  )

  const markReviewed = useCallback(
    async (templateId: string, note?: string): Promise<{ error: string | null }> => {
      if (!baseId) return { error: 'No base selected' }

      // Optimistic — synthesize a placeholder row so the UI reflects the change
      // immediately. The real row replaces it after the round-trip.
      const optimistic: QrcMonthlyReview = {
        id: `optimistic-${templateId}-${Date.now()}`,
        base_id: baseId,
        template_id: templateId,
        user_id: 'self',
        reviewed_at: new Date().toISOString(),
        template_updated_at_at_review: null,
        notes: note?.trim() || null,
        created_at: new Date().toISOString(),
      }
      const previous = reviews.get(templateId)
      setReviews(prev => new Map(prev).set(templateId, optimistic))

      const { data, error } = await persistReview(templateId, baseId, note)
      if (error || !data) {
        // Roll back to whatever was there before.
        setReviews(prev => {
          const next = new Map(prev)
          if (previous) next.set(templateId, previous)
          else next.delete(templateId)
          return next
        })
        return { error: error || 'Failed to save review' }
      }
      setReviews(prev => new Map(prev).set(templateId, data))
      return { error: null }
    },
    [baseId, reviews],
  )

  return { reviews, loaded, getStatus, markReviewed, refresh }
}
