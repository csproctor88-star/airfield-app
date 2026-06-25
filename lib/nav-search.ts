import { ALL_NAV_ITEMS, type NavItemDef } from '@/lib/sidebar-config'

// Match-quality weights, highest to lowest. Callers sort by score desc and
// drop zeros. Tiers (in priority order):
//   exact name > name prefix > word-in-name prefix > name substring
//   > keyword prefix > keyword substring
const SCORE_EXACT = 100
const SCORE_NAME_PREFIX = 80
const SCORE_WORD_PREFIX = 60
const SCORE_NAME_SUBSTRING = 40
const SCORE_KEYWORD_PREFIX = 30
const SCORE_KEYWORD_SUBSTRING = 20

/**
 * Score how well a nav destination matches a search query.
 * Returns 0 for no match (and for empty/whitespace-only queries).
 * Case-insensitive; surrounding whitespace in the query is ignored.
 */
export function scoreNavMatch(query: string, name: string, keywords?: string[]): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0

  const lowerName = name.toLowerCase()

  if (lowerName === q) return SCORE_EXACT
  if (lowerName.startsWith(q)) return SCORE_NAME_PREFIX

  const words = lowerName.split(/[^a-z0-9]+/).filter(Boolean)
  if (words.some(w => w.startsWith(q))) return SCORE_WORD_PREFIX
  if (lowerName.includes(q)) return SCORE_NAME_SUBSTRING

  if (keywords && keywords.length) {
    const lowerKeywords = keywords.map(k => k.toLowerCase())
    if (lowerKeywords.some(k => k.startsWith(q))) return SCORE_KEYWORD_PREFIX
    if (lowerKeywords.some(k => k.includes(q))) return SCORE_KEYWORD_SUBSTRING
  }

  return 0
}

/**
 * Search the full nav registry, returning matching destinations ranked best
 * first. Empty/whitespace query returns []. Visibility gating is the caller's
 * responsibility — apply it to the returned hrefs.
 */
export function searchRegistry(query: string): NavItemDef[] {
  if (!query.trim()) return []
  return ALL_NAV_ITEMS
    .map(item => ({ item, score: scoreNavMatch(query, item.name, item.keywords) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}
