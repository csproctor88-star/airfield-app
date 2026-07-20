import { describe, it, expect } from 'vitest'
import { navaidMatchesEnd, navaidDisplayName, groupNavaidsByEnd } from '@/lib/status-board-navaids'

describe('navaidMatchesEnd', () => {
  it('matches canonical prefix, natural suffix, ICAO-import, and bare forms', () => {
    expect(navaidMatchesEnd('26 ILS', '26')).toBe(true)       // canonical (composed by Base Config)
    expect(navaidMatchesEnd('ILS 26', '26')).toBe(true)       // natural hand-typed order
    expect(navaidMatchesEnd('MALSR RWY 26', '26')).toBe(true) // ICAO-import format
    expect(navaidMatchesEnd('26', '26')).toBe(true)
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(navaidMatchesEnd('ils 08l', '08L')).toBe(true)
    expect(navaidMatchesEnd('  26 ILS  ', '26')).toBe(true)
  })

  it('is token-bounded — a designator never matches inside a longer number', () => {
    expect(navaidMatchesEnd('PAPI 18', '8')).toBe(false)
    expect(navaidMatchesEnd('ILS 26', '6')).toBe(false)
    expect(navaidMatchesEnd('ASR-9', '9')).toBe(false)
  })

  it('never matches general NAVAIDs or empty inputs', () => {
    expect(navaidMatchesEnd('TACAN', '26')).toBe(false)
    expect(navaidMatchesEnd('', '26')).toBe(false)
    expect(navaidMatchesEnd('TACAN', '')).toBe(false)
  })
})

describe('navaidDisplayName', () => {
  const ENDS = ['26', '8']

  it('strips the runway part wherever it sits in the name', () => {
    expect(navaidDisplayName('26 ILS', ENDS)).toBe('ILS')
    expect(navaidDisplayName('ILS 26', ENDS)).toBe('ILS')
    expect(navaidDisplayName('MALSR RWY 26', ENDS)).toBe('MALSR')
    expect(navaidDisplayName('MALSR RWY 8', ENDS)).toBe('MALSR')
  })

  it('never returns empty — a bare designator name stays as-is', () => {
    expect(navaidDisplayName('26', ENDS)).toBe('26')
  })

  it('leaves general NAVAIDs untouched', () => {
    expect(navaidDisplayName('TACAN', ENDS)).toBe('TACAN')
    expect(navaidDisplayName('ASR-9', ENDS)).toBe('ASR-9')
  })
})

describe('groupNavaidsByEnd', () => {
  const n = (navaid_name: string) => ({ navaid_name })

  it('groups mixed naming conventions under their runway ends (the KFSM case)', () => {
    const { groups, other } = groupNavaidsByEnd(
      [n('ILS 26'), n('ILS 8'), n('MALSR RWY 26'), n('MALSR 8'), n('PAPI 26'), n('PAPI 8'), n('TACAN')],
      ['26', '8'],
    )
    expect(groups.find(g => g.designator === '26')!.items.map(i => i.navaid_name))
      .toEqual(['ILS 26', 'MALSR RWY 26', 'PAPI 26'])
    expect(groups.find(g => g.designator === '8')!.items.map(i => i.navaid_name))
      .toEqual(['ILS 8', 'MALSR 8', 'PAPI 8'])
    expect(other.map(i => i.navaid_name)).toEqual(['TACAN'])
  })

  it('keeps ILS first inside a group', () => {
    const { groups } = groupNavaidsByEnd(
      [n('26 PAPI'), n('26 MALSR'), n('26 ILS')],
      ['26'],
    )
    expect(groups[0].items[0].navaid_name).toBe('26 ILS')
  })

  it('assigns a name matching two ends to only the first group in runway order', () => {
    const { groups } = groupNavaidsByEnd([n('26 APPROACH 8')], ['26', '8'])
    expect(groups.find(g => g.designator === '26')!.items).toHaveLength(1)
    expect(groups.find(g => g.designator === '8')!.items).toHaveLength(0)
  })

  it('sorts the ungrouped remainder alphabetically', () => {
    const { other } = groupNavaidsByEnd([n('VOR'), n('ASR-9'), n('TACAN')], ['26'])
    expect(other.map(i => i.navaid_name)).toEqual(['ASR-9', 'TACAN', 'VOR'])
  })

  it('keeps empty groups so the group list always mirrors the designator list', () => {
    const { groups } = groupNavaidsByEnd([n('TACAN')], ['26', '8'])
    expect(groups.map(g => g.designator)).toEqual(['26', '8'])
    expect(groups.every(g => g.items.length === 0)).toBe(true)
  })
})
