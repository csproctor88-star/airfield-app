import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const gated = !url || !anon || url.includes('your-project')

describe.skipIf(gated)('RLS smoke — anon client', () => {
  it('cannot read discrepancies without auth', async () => {
    const supabase = createClient(url!, anon!)
    const { data, error } = await supabase.from('discrepancies').select('id').limit(1)
    expect(error || (data && data.length === 0)).toBeTruthy()
  })

  it('cannot read profiles without auth', async () => {
    const supabase = createClient(url!, anon!)
    const { data, error } = await supabase.from('profiles').select('id').limit(1)
    expect(error || (data && data.length === 0)).toBeTruthy()
  })
})
