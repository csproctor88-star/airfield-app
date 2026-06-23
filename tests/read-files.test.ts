import { describe, it, expect } from 'vitest'
import { computeUnacknowledged, partitionReviewers } from '@/lib/supabase/read-files'

describe('computeUnacknowledged', () => {
  const files = [
    { id: 'a', version: 1, is_archived: false },
    { id: 'b', version: 2, is_archived: false },
    { id: 'c', version: 1, is_archived: true }, // archived → never outstanding
  ]

  it('returns active files with no ack at the current version', () => {
    const acks = [{ read_file_id: 'a', acknowledged_version: 1 }]
    expect(computeUnacknowledged(files, acks)).toEqual(['b'])
  })

  it('treats an ack for an older version as still outstanding', () => {
    const acks = [{ read_file_id: 'b', acknowledged_version: 1 }] // file b is v2 now
    expect(computeUnacknowledged(files, acks).sort()).toEqual(['a', 'b'])
  })

  it('excludes archived files even with no ack', () => {
    expect(computeUnacknowledged(files, [])).not.toContain('c')
  })

  it('returns empty when everything current is acked', () => {
    const acks = [
      { read_file_id: 'a', acknowledged_version: 1 },
      { read_file_id: 'b', acknowledged_version: 2 },
    ]
    expect(computeUnacknowledged(files, acks)).toEqual([])
  })
})

describe('partitionReviewers', () => {
  const reviewers = [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }]

  it('splits reviewers into reviewed vs outstanding for a file version', () => {
    const acks = [{ user_id: 'u1' }, { user_id: 'u3' }]
    const { reviewed, outstanding } = partitionReviewers(reviewers, acks)
    expect(reviewed.sort()).toEqual(['u1', 'u3'])
    expect(outstanding).toEqual(['u2'])
  })

  it('all outstanding when no acks', () => {
    const { reviewed, outstanding } = partitionReviewers(reviewers, [])
    expect(reviewed).toEqual([])
    expect(outstanding.sort()).toEqual(['u1', 'u2', 'u3'])
  })
})
