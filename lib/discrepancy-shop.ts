import { DISCREPANCY_TYPES } from '@/lib/constants'

/**
 * Resolve the CE shop a discrepancy should be assigned to from its type(s).
 * Single source of truth shared by the manual New Discrepancy form and the
 * Visual NAVAIDs Report Outage auto-create paths.
 *
 * Per type, in order: the per-base type→shop map (Base Setup → CE Shops),
 * then the type's defaultShop by exact match against the base's shops, then
 * by substring match in either direction. The first type that yields a shop
 * wins; null means leave the discrepancy unassigned.
 */
export function resolveShopForTypes(
  types: string[],
  ceShops: string[],
  typeShopMap: Record<string, string>,
): string | null {
  for (const typeVal of types) {
    const mapped = typeShopMap[typeVal]
    if (mapped && ceShops.includes(mapped)) return mapped

    const typeDef = DISCREPANCY_TYPES.find(t => t.value === typeVal)
    if (!typeDef?.defaultShop) continue
    const defaultLower = typeDef.defaultShop.toLowerCase()
    const exact = ceShops.find(s => s === typeDef.defaultShop)
    if (exact) return exact
    const partial = ceShops.find(
      s => s.toLowerCase().includes(defaultLower) || defaultLower.includes(s.toLowerCase()),
    )
    if (partial) return partial
  }
  return null
}
