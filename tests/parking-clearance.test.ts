import { describe, it, expect } from 'vitest'
import {
  getADGFromWingspan,
  getWingtipClearanceDetail,
  isKcRefuelAircraft,
} from '@/lib/calculations/parking-clearance'

describe('parking clearance (UFC 3-260-01)', () => {
  it('classifies ADG by wingspan', () => {
    expect(getADGFromWingspan(40)).toBe('I')
    expect(getADGFromWingspan(95)).toBe('III')
    expect(getADGFromWingspan(200)).toBe('V')
    expect(getADGFromWingspan(300)).toBe('VI')
  })

  it('identifies KC refueling aircraft', () => {
    expect(isKcRefuelAircraft('KC-135R')).toBe(true)
    expect(isKcRefuelAircraft('C-17A')).toBe(false)
    expect(isKcRefuelAircraft(null)).toBe(false)
  })

  it('returns KC-10/46/135 override clearance regardless of context', () => {
    const d = getWingtipClearanceDetail(131, 'parking', 'KC-46A')
    expect(d.clearance_ft).toBe(25)
    expect(d.ufc_item).toBe('Item 4(P)')
  })
})
