import { describe, it, expect } from 'vitest'
import { scoreNavMatch, searchRegistry } from '@/lib/nav-search'

describe('scoreNavMatch — match tiers', () => {
  it('no match returns 0', () => {
    expect(scoreNavMatch('zzz', 'Wildlife / BASH', ['bird'])).toBe(0)
  })

  it('matches the visible name as a substring', () => {
    expect(scoreNavMatch('wild', 'Wildlife / BASH')).toBeGreaterThan(0)
  })

  it('matches a keyword alias when the name does not contain the query', () => {
    expect(scoreNavMatch('lights', 'Visual NAVAIDs', ['lights', 'PAPI'])).toBeGreaterThan(0)
    expect(scoreNavMatch('AMTR', 'Training Records', ['AMTR'])).toBeGreaterThan(0)
  })

  it('is case-insensitive', () => {
    expect(scoreNavMatch('amtr', 'Training Records', ['AMTR']))
      .toBe(scoreNavMatch('AMTR', 'Training Records', ['AMTR']))
  })

  it('ignores surrounding whitespace in the query', () => {
    expect(scoreNavMatch('  wild  ', 'Wildlife / BASH'))
      .toBe(scoreNavMatch('wild', 'Wildlife / BASH'))
  })

  it('empty / whitespace-only query returns 0', () => {
    expect(scoreNavMatch('', 'Wildlife / BASH')).toBe(0)
    expect(scoreNavMatch('   ', 'Wildlife / BASH')).toBe(0)
  })
})

describe('scoreNavMatch — ranking order', () => {
  it('exact name outranks prefix outranks word-prefix outranks substring outranks alias', () => {
    const exact = scoreNavMatch('reports', 'Reports')
    const prefix = scoreNavMatch('rep', 'Reports & Analytics')
    const wordPrefix = scoreNavMatch('ana', 'Reports & Analytics')
    const substring = scoreNavMatch('port', 'Reports & Analytics')
    const alias = scoreNavMatch('trends', 'Reports & Analytics', ['trends'])

    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(wordPrefix)
    expect(wordPrefix).toBeGreaterThan(substring)
    expect(substring).toBeGreaterThan(alias)
    expect(alias).toBeGreaterThan(0)
  })
})

describe('searchRegistry', () => {
  it('returns ranked, non-empty results for a known query', () => {
    const results = searchRegistry('wild')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.href === '/wildlife')).toBe(true)
  })

  it('returns [] for empty / whitespace query', () => {
    expect(searchRegistry('')).toEqual([])
    expect(searchRegistry('   ')).toEqual([])
  })

  it('sorts results by descending score', () => {
    // "training" hits "Training Records" name and others via alias;
    // every returned item must score > 0 and be in non-increasing order.
    const q = 'training'
    const results = searchRegistry(q)
    const scores = results.map(r => scoreNavMatch(q, r.name, r.keywords))
    expect(scores.every(s => s > 0)).toBe(true)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i])
    }
  })
})
