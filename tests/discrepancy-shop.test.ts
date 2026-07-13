import { describe, it, expect } from 'vitest'
import { resolveShopForTypes } from '@/lib/discrepancy-shop'

const BASE_SHOPS = ['CE Electrical', 'CE Pavements', 'CE Grounds', 'Airfield Management']

describe('resolveShopForTypes', () => {
  it('resolves lighting to CE Electrical via defaultShop exact match', () => {
    expect(resolveShopForTypes(['lighting'], BASE_SHOPS, {})).toBe('CE Electrical')
  })

  it('prefers the per-base type→shop map over the defaultShop', () => {
    const map = { lighting: 'Airfield Management' }
    expect(resolveShopForTypes(['lighting'], BASE_SHOPS, map)).toBe('Airfield Management')
  })

  it('ignores a per-base mapping whose shop is not in ceShops', () => {
    const map = { lighting: 'Retired Shop' }
    expect(resolveShopForTypes(['lighting'], BASE_SHOPS, map)).toBe('CE Electrical')
  })

  it('falls back to fuzzy matching when there is no exact shop name', () => {
    // Base renamed the shop; default "CE Electrical" still finds it by substring.
    expect(resolveShopForTypes(['lighting'], ['Electrical', 'Pavements'], {})).toBe('Electrical')
  })

  it('resolves from the first type that yields a shop', () => {
    // "other" has no defaultShop; the pavement type resolves next.
    expect(resolveShopForTypes(['other', 'pavement'], BASE_SHOPS, {})).toBe('CE Pavements')
  })

  it('returns null when no shop resolves', () => {
    expect(resolveShopForTypes(['lighting'], [], {})).toBeNull()
    expect(resolveShopForTypes(['other'], BASE_SHOPS, {})).toBeNull()
    expect(resolveShopForTypes([], BASE_SHOPS, {})).toBeNull()
  })

  it('returns null for an unknown type value', () => {
    expect(resolveShopForTypes(['not_a_type'], BASE_SHOPS, {})).toBeNull()
  })
})
