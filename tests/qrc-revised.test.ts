import { describe, it, expect } from 'vitest'
import { countRevised } from '@/lib/supabase/qrc-reviews'
import type { QrcMonthlyReview } from '@/lib/supabase/types'

const review = (template_id: string, reviewed_at: string): QrcMonthlyReview =>
  ({ template_id, reviewed_at } as unknown as QrcMonthlyReview)

const templates = [
  { id: 'a', updated_at: '2026-06-10T00:00:00Z', is_active: true },
  { id: 'b', updated_at: '2026-06-10T00:00:00Z', is_active: true },
  { id: 'c', updated_at: '2026-06-10T00:00:00Z', is_active: false }, // inactive
]

describe('countRevised', () => {
  it('counts active templates updated since the user’s last review', () => {
    const m = new Map([
      ['a', review('a', '2026-06-01T00:00:00Z')], // reviewed before update → updated → counts
      ['b', review('b', '2026-06-20T00:00:00Z')], // reviewed after update → current → no
    ])
    expect(countRevised(templates, m)).toBe(1)
  })

  it('does not count never-reviewed templates (state=never, not updated)', () => {
    expect(countRevised(templates, new Map())).toBe(0)
  })

  it('skips inactive templates even when updated since review', () => {
    const m = new Map([['c', review('c', '2026-06-01T00:00:00Z')]])
    expect(countRevised(templates, m)).toBe(0)
  })

  it('counts multiple revised templates', () => {
    const m = new Map([
      ['a', review('a', '2026-06-01T00:00:00Z')],
      ['b', review('b', '2026-06-02T00:00:00Z')],
    ])
    expect(countRevised(templates, m)).toBe(2)
  })
})
