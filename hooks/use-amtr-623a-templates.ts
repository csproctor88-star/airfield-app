'use client'

import { useEffect, useState } from 'react'
import { fetchAmtrByBase } from '@/lib/supabase/amtr'
import { COMMENT_TEMPLATES, composeTemplateText, type CommentTemplate } from '@/lib/amtr/reference-data'

type TemplateRow = { id: string; key: string; label: string; cite: string; body: string; sort_order: number }

/**
 * Per-base 623A comment templates for the "Insert DAFMAN template…" pickers.
 * Reads the editable `amtr_623a_comment_templates` catalog and recomposes each
 * inserted shell from label/cite/body. Falls back to the bundled
 * COMMENT_TEMPLATES when the base hasn't seeded the catalog yet (or there's no
 * installation), so unseeded bases keep the shipped defaults.
 */
export function useAmtr623aTemplates(installationId: string | null | undefined): CommentTemplate[] {
  const [templates, setTemplates] = useState<CommentTemplate[]>(COMMENT_TEMPLATES)

  useEffect(() => {
    if (!installationId) {
      setTemplates(COMMENT_TEMPLATES)
      return
    }
    let live = true
    fetchAmtrByBase<TemplateRow>('amtr_623a_comment_templates', installationId).then((rows) => {
      if (!live) return
      if (!rows || rows.length === 0) {
        setTemplates(COMMENT_TEMPLATES)
        return
      }
      setTemplates(
        rows.map((r) => ({
          key: r.key,
          label: r.label,
          cite: r.cite,
          text: composeTemplateText(r.label, r.cite, r.body),
        })),
      )
    })
    return () => {
      live = false
    }
  }, [installationId])

  return templates
}
