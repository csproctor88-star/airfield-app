import { describe, it, expect } from 'vitest'
import {
  computeNextDue, dueStatus, ratApplies, complianceTone, statusTone,
  parseTaskMonth, recurringPeriodElapsed,
} from '@/lib/amtr/status'

describe('AMTR status engine', () => {
  describe('computeNextDue', () => {
    it('adds a year for Annual', () => {
      expect(computeNextDue('2026-11-30', 'Annual')).toBe('2027-11-30')
    })
    it('adds a month for Monthly', () => {
      expect(computeNextDue('2026-01-15', 'Monthly')).toBe('2026-02-15')
    })
    it('adds three months for Quarterly', () => {
      expect(computeNextDue('2026-01-31', 'Quarterly')).toBe('2026-05-01') // JS month rollover
    })
    it('returns null for As Required / unknown', () => {
      expect(computeNextDue('2026-01-01', 'As Required')).toBeNull()
      expect(computeNextDue(null, 'Annual')).toBeNull()
    })
  })

  describe('parseTaskMonth', () => {
    it('parses a full month name anywhere in the task', () => {
      expect(parseTaskMonth('June Monthly Proficiency Test')).toBe(6)
      expect(parseTaskMonth('December Monthly Proficiency Test')).toBe(12)
    })
    it('is case-insensitive', () => {
      expect(parseTaskMonth('january monthly proficiency test')).toBe(1)
    })
    it('returns null when no month is present', () => {
      expect(parseTaskMonth('Airfield Driving')).toBeNull()
      expect(parseTaskMonth('')).toBeNull()
      expect(parseTaskMonth(null)).toBeNull()
    })
  })

  describe('recurringPeriodElapsed', () => {
    it('Monthly: a fully-elapsed past month is elapsed', () => {
      expect(recurringPeriodElapsed({ task: 'May Monthly Proficiency Test', frequency: 'Monthly', year_label: '2026' }, '2026-06-30')).toBe(true)
    })
    it('Monthly: the current month is NOT elapsed', () => {
      expect(recurringPeriodElapsed({ task: 'June Monthly Proficiency Test', frequency: 'Monthly', year_label: '2026' }, '2026-06-30')).toBe(false)
    })
    it('Monthly: a future month is NOT elapsed', () => {
      expect(recurringPeriodElapsed({ task: 'September Monthly Proficiency Test', frequency: 'Monthly', year_label: '2026' }, '2026-06-30')).toBe(false)
    })
    it('Monthly with an unparseable name falls back to elapsed=true (strict presence check)', () => {
      expect(recurringPeriodElapsed({ task: 'Recurring Prof Test #4', frequency: 'Monthly', year_label: '2026' }, '2026-06-30')).toBe(true)
    })
    it('Annual: the current year is NOT elapsed, a past year is', () => {
      expect(recurringPeriodElapsed({ task: 'AFFSA Annual', frequency: 'Annual', year_label: '2026' }, '2026-06-30')).toBe(false)
      expect(recurringPeriodElapsed({ task: 'AFFSA Annual', frequency: 'Annual', year_label: '2025' }, '2026-06-30')).toBe(true)
    })
    it('unknown / As Required falls back to elapsed=true (strict)', () => {
      expect(recurringPeriodElapsed({ task: 'X', frequency: 'As Required', year_label: '2026' }, '2026-06-30')).toBe(true)
    })
  })

  describe('dueStatus', () => {
    const today = new Date('2026-05-20T00:00:00Z')
    it('flags overdue when due date is past with no completion', () => {
      expect(dueStatus({ dueDate: '2026-05-10' }, today)).toBe('overdue')
    })
    it('flags due_soon within 30 days', () => {
      expect(dueStatus({ dueDate: '2026-06-10' }, today)).toBe('due_soon')
    })
    it('flags upcoming beyond 30 days', () => {
      expect(dueStatus({ dueDate: '2026-09-01' }, today)).toBe('upcoming')
    })
    it('is complete when completed and due is in the future (beyond due-soon window)', () => {
      expect(dueStatus({ dueDate: '2026-09-01', completedDate: '2026-05-01' }, today)).toBe('complete')
    })
    it('with no due date but a completion is complete', () => {
      expect(dueStatus({ completedDate: '2026-05-01' }, today)).toBe('complete')
    })
    it('is overdue when a recurring item lapsed even though it was once completed', () => {
      // Annual task completed 2025-01-20 → due 2026-01-20, now 4 months past.
      expect(dueStatus({ dueDate: '2026-01-20', completedDate: '2025-01-20' }, today)).toBe('overdue')
    })
    it('is complete when completed on/after a past due date (late but met)', () => {
      expect(dueStatus({ dueDate: '2026-05-10', completedDate: '2026-05-15' }, today)).toBe('complete')
    })
    it('with neither due nor completion is upcoming', () => {
      expect(dueStatus({}, today)).toBe('upcoming')
    })
  })

  describe('ratApplies', () => {
    it('applies to Active members', () => {
      expect(ratApplies('Active')).toBe(true)
    })
    it('is exempt for Civilian / Contractor / Separated', () => {
      expect(ratApplies('Civilian')).toBe(false)
      expect(ratApplies('Contractor')).toBe(false)
      expect(ratApplies('Separated')).toBe(false)
    })
  })

  describe('tones', () => {
    it('maps status to tone', () => {
      expect(statusTone('overdue')).toBe('bad')
      expect(statusTone('due_soon')).toBe('warn')
      expect(statusTone('complete')).toBe('ok')
    })
    it('compliance tone: overdue dominates due-soon', () => {
      expect(complianceTone(1, 5)).toBe('bad')
      expect(complianceTone(0, 3)).toBe('warn')
      expect(complianceTone(0, 0)).toBe('ok')
    })
  })
})
