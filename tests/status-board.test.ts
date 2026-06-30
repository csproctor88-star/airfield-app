import { describe, it, expect } from 'vitest'
import { statusBoardColor, statusBoardLabel, statusBoardChip } from '@/lib/dashboard/status-board'

describe('statusBoardColor', () => {
  it('custom + navaid use green/yellow/red', () => {
    expect(statusBoardColor('custom', 'green')).toContain('success')
    expect(statusBoardColor('navaid', 'yellow')).toContain('warning')
    expect(statusBoardColor('custom', 'red')).toContain('danger')
  })
  it('runway uses open/suspended/closed', () => {
    expect(statusBoardColor('runway', 'open')).toContain('success')
    expect(statusBoardColor('runway', 'suspended')).toContain('warning')
    expect(statusBoardColor('runway', 'closed')).toContain('danger')
  })
  it('arff uses readiness levels (critical = orange)', () => {
    expect(statusBoardColor('arff', 'optimum')).toContain('success')
    expect(statusBoardColor('arff', 'reduced')).toContain('warning')
    expect(statusBoardColor('arff', 'critical')).toContain('orange')
    expect(statusBoardColor('arff', 'inadequate')).toContain('danger')
  })
  it('unknown value → muted', () => {
    expect(statusBoardColor('custom', 'purple')).toContain('text-3')
  })
})

describe('statusBoardLabel', () => {
  it('capitalizes the value', () => {
    expect(statusBoardLabel('runway', 'open')).toBe('Open')
    expect(statusBoardLabel('arff', 'inadequate')).toBe('Inadequate')
    expect(statusBoardLabel('custom', '')).toBe('—')
  })
})

describe('statusBoardChip', () => {
  it('maps green/yellow/red to G/Y/R (matches the status page chips)', () => {
    expect(statusBoardChip('green')).toBe('G')
    expect(statusBoardChip('yellow')).toBe('Y')
    expect(statusBoardChip('red')).toBe('R')
  })
  it('is case-insensitive', () => {
    expect(statusBoardChip('GREEN')).toBe('G')
  })
  it('unknown / empty → dash', () => {
    expect(statusBoardChip('purple')).toBe('—')
    expect(statusBoardChip('')).toBe('—')
  })
})
