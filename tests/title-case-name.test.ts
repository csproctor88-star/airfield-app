import { describe, it, expect } from 'vitest'
import { toTitleCaseName } from '@/lib/utils'

// `toTitleCaseName` normalizes user-typed names at account creation
// (self-signup + admin invite). The "safe per-word" rule: capitalize the
// first letter of each part split on space / hyphen / apostrophe, lowercase
// the rest. Deliberately NO Mc/Mac heuristics (would mis-case Macey, Machado).
describe('toTitleCaseName', () => {
  it('capitalizes a simple lowercase name', () => {
    expect(toTitleCaseName('john')).toBe('John')
  })

  it('lowercases the tail of an all-caps name', () => {
    expect(toTitleCaseName('SMITH')).toBe('Smith')
  })

  it('handles hyphenated surnames', () => {
    expect(toTitleCaseName('smith-jones')).toBe('Smith-Jones')
  })

  it('handles apostrophes', () => {
    expect(toTitleCaseName("o'brien")).toBe("O'Brien")
    expect(toTitleCaseName("d'angelo")).toBe("D'Angelo")
  })

  it('collapses extra whitespace and trims', () => {
    expect(toTitleCaseName('  mary   ann  ')).toBe('Mary Ann')
  })

  it('does NOT apply Mc/Mac heuristics (safe rule)', () => {
    expect(toTitleCaseName('MCDONALD')).toBe('Mcdonald')
    expect(toTitleCaseName('macey')).toBe('Macey')
  })

  it('handles mixed garbage casing', () => {
    expect(toTitleCaseName("mcDONALD-o'brien")).toBe("Mcdonald-O'Brien")
  })

  it('returns empty string for empty / whitespace input', () => {
    expect(toTitleCaseName('')).toBe('')
    expect(toTitleCaseName('   ')).toBe('')
  })
})
