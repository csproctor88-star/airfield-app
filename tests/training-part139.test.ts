import { describe, it, expect } from 'vitest'
import {
  classifyTrainingStatus,
  daysToExpiry,
  type TrainingRecord,
  type TrainingTopic,
  type TrainingCertificate,
} from '@/lib/supabase/training-part139'
import { generateTrainingTranscriptPdf } from '@/lib/training-part139-pdf'

const NOW = new Date('2026-05-26T12:00:00Z')

function recordWithExpiry(daysFromNow: number | null): { expires_at: string | null } {
  if (daysFromNow === null) return { expires_at: null }
  const d = new Date(NOW.getTime() + daysFromNow * 86_400_000)
  return { expires_at: d.toISOString().slice(0, 10) }
}

// ────────────────────────────────────────────────────────────────
// classifyTrainingStatus — the 4-state model
// ────────────────────────────────────────────────────────────────

describe('classifyTrainingStatus', () => {
  it('returns not_started when no record exists', () => {
    expect(classifyTrainingStatus(null, NOW)).toBe('not_started')
  })

  it('returns current when expires_at is > 90 days out', () => {
    expect(classifyTrainingStatus(recordWithExpiry(91), NOW)).toBe('current')
    expect(classifyTrainingStatus(recordWithExpiry(365), NOW)).toBe('current')
  })

  it('returns expiring when expires_at is 30-90 days out (inclusive of 30, exclusive of 90)', () => {
    expect(classifyTrainingStatus(recordWithExpiry(30), NOW)).toBe('expiring')
    expect(classifyTrainingStatus(recordWithExpiry(60), NOW)).toBe('expiring')
    expect(classifyTrainingStatus(recordWithExpiry(89), NOW)).toBe('expiring')
  })

  it('returns expired when expires_at is < 30 days out OR already past', () => {
    expect(classifyTrainingStatus(recordWithExpiry(29), NOW)).toBe('expired')
    expect(classifyTrainingStatus(recordWithExpiry(0), NOW)).toBe('expired')
    expect(classifyTrainingStatus(recordWithExpiry(-1), NOW)).toBe('expired')
    expect(classifyTrainingStatus(recordWithExpiry(-365), NOW)).toBe('expired')
  })

  it('treats a record with null expires_at as current (lifetime / one-time training)', () => {
    expect(classifyTrainingStatus(recordWithExpiry(null), NOW)).toBe('current')
  })

  it('handles invalid date strings gracefully', () => {
    expect(classifyTrainingStatus({ expires_at: 'not-a-date' }, NOW)).toBe('current')
  })
})

// ────────────────────────────────────────────────────────────────
// daysToExpiry
// ────────────────────────────────────────────────────────────────

describe('daysToExpiry', () => {
  it('returns positive for future dates', () => {
    const future = new Date(NOW.getTime() + 10 * 86_400_000).toISOString()
    expect(daysToExpiry(future, NOW)).toBe(10)
  })
  it('returns negative for past dates', () => {
    const past = new Date(NOW.getTime() - 5 * 86_400_000).toISOString()
    expect(daysToExpiry(past, NOW)).toBe(-5)
  })
  it('accepts Date objects', () => {
    const future = new Date(NOW.getTime() + 7 * 86_400_000)
    expect(daysToExpiry(future, NOW)).toBe(7)
  })
})

// ────────────────────────────────────────────────────────────────
// PDF transcript smoke
// ────────────────────────────────────────────────────────────────

function makeTopic(code: string, title: string, sort: number, baseId: string | null = null): TrainingTopic {
  return {
    id: `topic-${code}`,
    base_id: baseId,
    code,
    title,
    description: null,
    source: '14 CFR §139.303(e)',
    applies_to: ['faa_part139'],
    initial_required: true,
    recurrent_frequency_months: 12,
    retention_months: 24,
    material_url: null,
    active: true,
    sort_order: sort,
    created_at: '2026-05-26T00:00:00Z',
    updated_at: '2026-05-26T00:00:00Z',
  }
}

function makeRecord(topicId: string, completedAt: string, expiresAt: string | null, type: TrainingRecord['training_type'] = 'recurrent'): TrainingRecord {
  return {
    id: `rec-${topicId}-${completedAt}`,
    base_id: 'base-1',
    user_id: 'user-1',
    topic_id: topicId,
    completed_at: completedAt,
    training_type: type,
    instructor_user_id: null,
    instructor_name_external: 'AAAE Annual Conference',
    evidence_url: null,
    expires_at: expiresAt,
    notes: null,
    created_at: '2026-05-26T00:00:00Z',
    created_by: null,
    updated_at: '2026-05-26T00:00:00Z',
  }
}

function makeCert(credential: TrainingCertificate['credential'], expiresAt: string | null): TrainingCertificate {
  return {
    id: `cert-${credential}-${expiresAt ?? 'lifetime'}`,
    base_id: 'base-1',
    user_id: 'user-1',
    credential,
    issued_at: '2024-06-01',
    expires_at: expiresAt,
    certificate_url: null,
    notes: null,
    created_at: '2026-05-26T00:00:00Z',
    created_by: null,
    updated_at: '2026-05-26T00:00:00Z',
  }
}

describe('generateTrainingTranscriptPdf', () => {
  const baseInput = {
    base: { name: 'Demo Regional Airport', icao: 'KDRA' },
    user: { name: 'Jane Doe', rank: null, email: 'jane@example.com', role: 'Operations Supervisor' },
  }

  it('renders an empty transcript (no records, no certs) without throwing', () => {
    const topics = [
      makeTopic('139.303(e)(1)', 'Airport familiarization', 10),
      makeTopic('139.303(e)(2)', 'Movement-area access',    20),
    ]
    const { doc, filename } = generateTrainingTranscriptPdf({
      ...baseInput, topics, records: [], certificates: [],
    })
    expect(filename).toMatch(/training-transcript-Jane_Doe-\d{4}-\d{2}-\d{2}\.pdf/)
    expect(doc.getNumberOfPages()).toBeGreaterThan(0)
  })

  it('renders a populated transcript with records + cert + renewal chain', () => {
    const topics = [
      makeTopic('139.303(e)(10)', 'Wildlife hazard management', 100),
      makeTopic('139.303(e)(3)',  'ARFF familiarization',        30),
    ]
    const records = [
      makeRecord('topic-139.303(e)(10)', '2026-04-12', '2027-04-12', 'recurrent'),
      makeRecord('topic-139.303(e)(10)', '2025-04-15', '2026-04-15', 'recurrent'),  // older — exercises renewal-history section
      makeRecord('topic-139.303(e)(3)',  '2026-05-26', '2027-05-26', 'initial'),
    ]
    const certs = [
      makeCert('AAAE-CM', '2027-06-01'),
      makeCert('ACE-WHC', null),  // lifetime
    ]
    const { doc, filename } = generateTrainingTranscriptPdf({
      ...baseInput, topics, records, certificates: certs,
    })
    expect(filename).toMatch(/^training-transcript-Jane_Doe-/)
    expect(doc.getNumberOfPages()).toBeGreaterThan(0)
  })

  it('sanitizes the user name in the filename', () => {
    const { filename } = generateTrainingTranscriptPdf({
      ...baseInput,
      user: { ...baseInput.user, name: 'Doe / Jane (Lead)' },
      topics: [], records: [], certificates: [],
    })
    expect(filename).toMatch(/^training-transcript-Doe_Jane_Lead_-/)
  })
})
