import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted state mock — vi.mock() factories are hoisted above imports, so any
// mutable scaffolding they reference must also live in vi.hoisted().
const { state } = vi.hoisted(() => ({
  state: {
    inspection: {
      next: { data: null as unknown, error: null as string | null },
      throw: null as Error | null,
      calls: [] as unknown[],
    },
    check: {
      next: { data: null as unknown, error: null as string | null },
      throw: null as Error | null,
      calls: [] as unknown[],
    },
    acsi: {
      next: { data: null as unknown, error: null as string | null },
      throw: null as Error | null,
      calls: [] as unknown[],
    },
    dailyReview: {
      next: { data: null as unknown, error: null as string | null },
      throw: null as Error | null,
      calls: [] as unknown[],
      existing: null as unknown,
    },
    airfieldStatus: {
      next: true as boolean,
      throw: null as Error | null,
      calls: [] as unknown[],
    },
    bulkUpdate: {
      next: 0 as number,
      throw: null as Error | null,
      calls: [] as unknown[],
    },
    outageEvent: {
      next: null as unknown,
      throw: null as Error | null,
      calls: [] as unknown[],
    },
    activity: {
      next: { error: null as string | null },
      throw: null as Error | null,
      calls: [] as unknown[],
    },
    discrepancy: {
      next: { data: null as unknown, error: null as string | null },
      throw: null as Error | null,
      calls: [] as unknown[],
    },
    inspectionDraft: {
      next: { data: null as unknown, error: null as string | null },
      throw: null as Error | null,
      calls: [] as unknown[],
    },
  },
}))

vi.mock('@/lib/supabase/inspections', () => ({
  fileInspection: vi.fn(async (payload: unknown) => {
    state.inspection.calls.push(payload)
    if (state.inspection.throw) throw state.inspection.throw
    return state.inspection.next
  }),
  createInspectionDraftWithId: vi.fn(async (payload: unknown) => {
    state.inspectionDraft.calls.push(payload)
    if (state.inspectionDraft.throw) throw state.inspectionDraft.throw
    return state.inspectionDraft.next
  }),
}))

vi.mock('@/lib/supabase/checks', () => ({
  createCheck: vi.fn(async (payload: unknown) => {
    state.check.calls.push(payload)
    if (state.check.throw) throw state.check.throw
    return state.check.next
  }),
}))

vi.mock('@/lib/supabase/acsi-inspections', () => ({
  fileAcsiInspection: vi.fn(async (payload: unknown) => {
    state.acsi.calls.push(payload)
    if (state.acsi.throw) throw state.acsi.throw
    return state.acsi.next
  }),
}))

vi.mock('@/lib/supabase/daily-reviews', () => ({
  fetchDailyReview: vi.fn(async () => state.dailyReview.existing),
  signDailyReview: vi.fn(async (payload: unknown) => {
    state.dailyReview.calls.push(payload)
    if (state.dailyReview.throw) throw state.dailyReview.throw
    return state.dailyReview.next
  }),
}))

vi.mock('@/lib/supabase/airfield-status', () => ({
  updateAirfieldStatus: vi.fn(async (updates: unknown, baseId: unknown) => {
    state.airfieldStatus.calls.push({ updates, baseId })
    if (state.airfieldStatus.throw) throw state.airfieldStatus.throw
    return state.airfieldStatus.next
  }),
}))

vi.mock('@/lib/supabase/infrastructure-features', () => ({
  bulkUpdateStatus: vi.fn(async (ids: unknown, status: unknown) => {
    state.bulkUpdate.calls.push({ ids, status })
    if (state.bulkUpdate.throw) throw state.bulkUpdate.throw
    return state.bulkUpdate.next
  }),
}))

vi.mock('@/lib/supabase/outage-events', () => ({
  createOutageEvent: vi.fn(async (payload: unknown) => {
    state.outageEvent.calls.push(payload)
    if (state.outageEvent.throw) throw state.outageEvent.throw
    return state.outageEvent.next
  }),
}))

vi.mock('@/lib/supabase/discrepancies', () => ({
  createDiscrepancy: vi.fn(async (payload: unknown) => {
    state.discrepancy.calls.push(payload)
    if (state.discrepancy.throw) throw state.discrepancy.throw
    return state.discrepancy.next
  }),
}))

vi.mock('@/lib/supabase/activity', () => ({
  logActivity: vi.fn(
    async (
      action: unknown,
      entity_type: unknown,
      entity_id: unknown,
      entity_display_id?: unknown,
      metadata?: unknown,
      baseId?: unknown,
      createdAt?: unknown,
    ) => {
      state.activity.calls.push({
        action,
        entity_type,
        entity_id,
        entity_display_id,
        metadata,
        baseId,
        createdAt,
      })
      if (state.activity.throw) throw state.activity.throw
      return state.activity.next
    },
  ),
}))

import { HANDLERS, registerAllHandlers } from '@/lib/sync/handlers'
import { ConflictError, NonRetriableError } from '@/lib/sync/types'
import { WriteQueue } from '@/lib/sync/write-queue'
import { MemoryStorage } from '@/lib/sync/queue-storage'

beforeEach(() => {
  state.inspection = { next: { data: null, error: null }, throw: null, calls: [] }
  state.check = { next: { data: null, error: null }, throw: null, calls: [] }
  state.acsi = { next: { data: null, error: null }, throw: null, calls: [] }
  state.dailyReview = {
    next: { data: null, error: null },
    throw: null,
    calls: [],
    existing: null,
  }
  state.airfieldStatus = { next: true, throw: null, calls: [] }
  state.bulkUpdate = { next: 0, throw: null, calls: [] }
  state.outageEvent = { next: null, throw: null, calls: [] }
  state.activity = { next: { error: null }, throw: null, calls: [] }
  state.discrepancy = { next: { data: null, error: null }, throw: null, calls: [] }
  state.inspectionDraft = { next: { data: null, error: null }, throw: null, calls: [] }
})

const INSPECTION_PAYLOAD = {
  id: 'insp-1',
  items: [],
  total_items: 0,
  passed_count: 0,
  failed_count: 0,
  na_count: 0,
  bwc_value: 'WHITE',
  weather_conditions: 'clear',
  temperature_f: 70,
  notes: null,
  inspector_name: 'A',
  completed_by_name: 'A',
  completed_by_id: null,
  completed_at: '2026-04-25T12:00:00Z',
  filed_by_name: 'A',
  filed_by_id: null,
}

const CHECK_PAYLOAD = {
  check_type: 'fod' as const,
  areas: ['runway-09'],
  data: { foo: 'bar' },
  completed_by: 'A',
  comments: [],
  base_id: 'base-a',
}

const DAILY_REVIEW_PAYLOAD = {
  baseId: 'base-a',
  date: '2026-04-25',
  slot: 'day_amsl' as const,
  userId: 'user-a',
  eventsHash: 'abcdef',
  notes: null,
  shiftCount: 3,
}

const ACSI_PAYLOAD = {
  id: 'acsi-1',
  items: [],
  total_items: 0,
  passed_count: 0,
  failed_count: 0,
  na_count: 0,
  airfield_name: 'Test AFB',
  inspection_date: '2026-04-25',
  fiscal_year: 2026,
  inspection_team: [],
  risk_cert_signatures: [],
  notes: null,
  inspector_name: 'A',
  completed_by_name: 'A',
  completed_by_id: null,
  base_id: 'base-a',
}

describe('inspection_file handler', () => {
  it('returns the row on success', async () => {
    const handler = HANDLERS.inspection_file!
    state.inspection.next = { data: { id: 'insp-1', display_id: 'AFLD-2026-0001' }, error: null }
    const result = await handler(INSPECTION_PAYLOAD)
    expect(result).toEqual({ id: 'insp-1', display_id: 'AFLD-2026-0001' })
    expect(state.inspection.calls).toHaveLength(1)
  })

  it('throws NonRetriableError when fileInspection returns a structured error', async () => {
    const handler = HANDLERS.inspection_file!
    state.inspection.next = { data: null, error: 'You do not have permission to perform this action.' }
    await expect(handler(INSPECTION_PAYLOAD)).rejects.toBeInstanceOf(NonRetriableError)
  })

  it('treats a "Failed to fetch" structured error as transient (Supabase JS v2 returns network errors structurally)', async () => {
    const handler = HANDLERS.inspection_file!
    state.inspection.next = { data: null, error: 'Failed to fetch' }
    let caught: unknown = null
    try {
      await handler(INSPECTION_PAYLOAD)
    } catch (err) {
      caught = err
    }
    expect(caught).not.toBeNull()
    expect(caught).toBeInstanceOf(Error)
    expect(caught).not.toBeInstanceOf(NonRetriableError)
  })

  it('treats a "NetworkError" structured error as transient', async () => {
    const handler = HANDLERS.inspection_file!
    state.inspection.next = { data: null, error: 'NetworkError when attempting to fetch resource.' }
    await expect(handler(INSPECTION_PAYLOAD)).rejects.not.toBeInstanceOf(NonRetriableError)
  })

  it('lets thrown fetch errors propagate so the queue treats them as transient', async () => {
    const handler = HANDLERS.inspection_file!
    state.inspection.throw = new TypeError('Failed to fetch')
    await expect(handler(INSPECTION_PAYLOAD)).rejects.toThrow(/fetch/i)
    try {
      await handler(INSPECTION_PAYLOAD)
    } catch (err) {
      expect(err).not.toBeInstanceOf(NonRetriableError)
    }
  })
})

describe('check_file handler', () => {
  it('returns the row on success', async () => {
    const handler = HANDLERS.check_file!
    state.check.next = { data: { id: 'chk-1', display_id: 'AC-Z9X3' }, error: null }
    const result = await handler(CHECK_PAYLOAD)
    expect(result).toEqual({ id: 'chk-1', display_id: 'AC-Z9X3' })
    expect(state.check.calls).toHaveLength(1)
  })

  it('throws NonRetriableError when createCheck returns a structured error', async () => {
    const handler = HANDLERS.check_file!
    state.check.next = { data: null, error: 'This record already exists.' }
    await expect(handler(CHECK_PAYLOAD)).rejects.toBeInstanceOf(NonRetriableError)
  })

  it('lets thrown fetch errors propagate so the queue treats them as transient', async () => {
    const handler = HANDLERS.check_file!
    state.check.throw = new TypeError('Failed to fetch')
    await expect(handler(CHECK_PAYLOAD)).rejects.toThrow(/fetch/i)
    try {
      await handler(CHECK_PAYLOAD)
    } catch (err) {
      expect(err).not.toBeInstanceOf(NonRetriableError)
    }
  })
})

describe('acsi_submit handler', () => {
  it('returns the row on success', async () => {
    const handler = HANDLERS.acsi_submit!
    state.acsi.next = { data: { id: 'acsi-1', display_id: 'ACSI-2026-0001' }, error: null }
    const result = await handler(ACSI_PAYLOAD)
    expect(result).toEqual({ id: 'acsi-1', display_id: 'ACSI-2026-0001' })
    expect(state.acsi.calls).toHaveLength(1)
  })

  it('throws NonRetriableError when fileAcsiInspection returns a structured error', async () => {
    const handler = HANDLERS.acsi_submit!
    state.acsi.next = { data: null, error: 'You do not have permission to perform this action.' }
    await expect(handler(ACSI_PAYLOAD)).rejects.toBeInstanceOf(NonRetriableError)
  })

  it('lets thrown fetch errors propagate so the queue treats them as transient', async () => {
    const handler = HANDLERS.acsi_submit!
    state.acsi.throw = new TypeError('Failed to fetch')
    await expect(handler(ACSI_PAYLOAD)).rejects.toThrow(/fetch/i)
    try {
      await handler(ACSI_PAYLOAD)
    } catch (err) {
      expect(err).not.toBeInstanceOf(NonRetriableError)
    }
  })
})

describe('daily_review_sign handler', () => {
  it('signs successfully when the slot is unsigned', async () => {
    const handler = HANDLERS.daily_review_sign!
    state.dailyReview.existing = { id: 'r1', day_amsl_signed_at: null }
    state.dailyReview.next = { data: { id: 'r1', day_amsl_signed_at: '2026-04-25T12:00:00Z' }, error: null }
    const result = await handler(DAILY_REVIEW_PAYLOAD)
    expect(result).toMatchObject({ id: 'r1' })
    expect(state.dailyReview.calls).toHaveLength(1)
  })

  it('signs successfully when no row exists yet (first slot of the day)', async () => {
    const handler = HANDLERS.daily_review_sign!
    state.dailyReview.existing = null
    state.dailyReview.next = { data: { id: 'r-new' }, error: null }
    const result = await handler(DAILY_REVIEW_PAYLOAD)
    expect(result).toMatchObject({ id: 'r-new' })
  })

  it('throws ConflictError when the slot is already signed', async () => {
    const handler = HANDLERS.daily_review_sign!
    state.dailyReview.existing = { id: 'r1', day_amsl_signed_at: '2026-04-25T11:00:00Z' }
    await expect(handler(DAILY_REVIEW_PAYLOAD)).rejects.toBeInstanceOf(ConflictError)
    // signDailyReview should NOT have been called
    expect(state.dailyReview.calls).toHaveLength(0)
  })

  it('throws NonRetriableError on a structured signDailyReview error', async () => {
    const handler = HANDLERS.daily_review_sign!
    state.dailyReview.existing = null
    state.dailyReview.next = { data: null, error: 'You do not have permission to perform this action.' }
    await expect(handler(DAILY_REVIEW_PAYLOAD)).rejects.toBeInstanceOf(NonRetriableError)
  })

  it('lets thrown fetch errors propagate as transient', async () => {
    const handler = HANDLERS.daily_review_sign!
    state.dailyReview.existing = null
    state.dailyReview.throw = new TypeError('Failed to fetch')
    await expect(handler(DAILY_REVIEW_PAYLOAD)).rejects.toThrow(/fetch/i)
    try {
      await handler(DAILY_REVIEW_PAYLOAD)
    } catch (err) {
      expect(err).not.toBeInstanceOf(NonRetriableError)
      expect(err).not.toBeInstanceOf(ConflictError)
    }
  })
})

describe('airfield_status_update handler', () => {
  it('returns true on success', async () => {
    const handler = HANDLERS.airfield_status_update!
    state.airfieldStatus.next = true
    const result = await handler({ updates: { bwc_value: 'MOD' }, baseId: 'base-a' })
    expect(result).toBe(true)
    expect(state.airfieldStatus.calls).toHaveLength(1)
  })

  it('throws NonRetriable when updateAirfieldStatus returns false while online', async () => {
    const handler = HANDLERS.airfield_status_update!
    state.airfieldStatus.next = false
    await expect(
      handler({ updates: { bwc_value: 'MOD' }, baseId: 'base-a' }),
    ).rejects.toBeInstanceOf(NonRetriableError)
  })
})

describe('infrastructure_feature_status_update handler', () => {
  it('returns the count of updated rows on success', async () => {
    const handler = HANDLERS.infrastructure_feature_status_update!
    state.bulkUpdate.next = 3
    const result = await handler({ ids: ['a', 'b', 'c'], status: 'inoperative' })
    expect(result).toBe(3)
  })

  it('returns 0 cleanly for empty input', async () => {
    const handler = HANDLERS.infrastructure_feature_status_update!
    state.bulkUpdate.next = 0
    const result = await handler({ ids: [], status: 'inoperative' })
    expect(result).toBe(0)
  })

  it('throws transient when input is non-empty but bulkUpdateStatus updates 0 rows', async () => {
    const handler = HANDLERS.infrastructure_feature_status_update!
    state.bulkUpdate.next = 0
    let caught: unknown = null
    try {
      await handler({ ids: ['a', 'b'], status: 'inoperative' })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
    expect(caught).not.toBeInstanceOf(NonRetriableError)
  })
})

describe('outage_event_create handler', () => {
  it('returns the created row on success', async () => {
    const handler = HANDLERS.outage_event_create!
    state.outageEvent.next = { id: 'oe-1' }
    const result = await handler({
      base_id: 'base-a',
      feature_id: 'feat-1',
      event_type: 'reported',
    })
    expect(result).toMatchObject({ id: 'oe-1' })
  })

  it('throws transient when createOutageEvent returns null', async () => {
    const handler = HANDLERS.outage_event_create!
    state.outageEvent.next = null
    let caught: unknown = null
    try {
      await handler({
        base_id: 'base-a',
        feature_id: 'feat-1',
        event_type: 'reported',
      })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
    expect(caught).not.toBeInstanceOf(NonRetriableError)
  })
})

describe('activity_log_insert handler', () => {
  it('passes the captured createdAt through to logActivity', async () => {
    const handler = HANDLERS.activity_log_insert!
    state.activity.next = { error: null }
    await handler({
      action: 'completed',
      entity_type: 'inspection',
      entity_id: 'insp-1',
      entity_display_id: 'AI-2026-1234',
      metadata: { details: 'AFLD3 off airfield' },
      baseId: 'base-a',
      createdAt: '2026-04-25T14:32:00Z',
    })
    expect(state.activity.calls).toHaveLength(1)
    expect((state.activity.calls[0] as { createdAt?: string }).createdAt).toBe(
      '2026-04-25T14:32:00Z',
    )
  })

  it('throws NonRetriableError on a structured error', async () => {
    const handler = HANDLERS.activity_log_insert!
    state.activity.next = { error: 'You do not have permission to perform this action.' }
    await expect(
      handler({
        action: 'completed',
        entity_type: 'inspection',
        entity_id: 'insp-1',
        createdAt: '2026-04-25T14:32:00Z',
      }),
    ).rejects.toBeInstanceOf(NonRetriableError)
  })

  it('treats "Failed to fetch" as transient', async () => {
    const handler = HANDLERS.activity_log_insert!
    state.activity.next = { error: 'Failed to fetch' }
    await expect(
      handler({
        action: 'completed',
        entity_type: 'inspection',
        entity_id: 'insp-1',
        createdAt: '2026-04-25T14:32:00Z',
      }),
    ).rejects.not.toBeInstanceOf(NonRetriableError)
  })
})

describe('inspection_save_draft handler', () => {
  it('passes the pre-allocated id through to createInspectionDraftWithId', async () => {
    const handler = HANDLERS.inspection_save_draft!
    state.inspectionDraft.next = { data: { id: 'preset-uuid' }, error: null }
    await handler({
      id: 'preset-uuid',
      inspection_type: 'airfield',
      draft_data: {} as unknown,
      items: [],
      total_items: 0,
      passed_count: 0,
      failed_count: 0,
      na_count: 0,
      bwc_value: null,
      notes: null,
      daily_group_id: 'g-1',
      construction_meeting: false,
      joint_monthly: false,
    })
    expect((state.inspectionDraft.calls[0] as { id?: string }).id).toBe('preset-uuid')
  })

  it('throws NonRetriable on a structured error', async () => {
    const handler = HANDLERS.inspection_save_draft!
    state.inspectionDraft.next = { data: null, error: 'You do not have permission to perform this action.' }
    await expect(
      handler({
        id: 'x',
        inspection_type: 'airfield',
        draft_data: {} as unknown,
        items: [],
        total_items: 0,
        passed_count: 0,
        failed_count: 0,
        na_count: 0,
        bwc_value: null,
        notes: null,
        daily_group_id: 'g-1',
        construction_meeting: false,
        joint_monthly: false,
      }),
    ).rejects.toBeInstanceOf(NonRetriableError)
  })

  it('treats "Failed to fetch" as transient', async () => {
    const handler = HANDLERS.inspection_save_draft!
    state.inspectionDraft.next = { data: null, error: 'Failed to fetch' }
    await expect(
      handler({
        id: 'x',
        inspection_type: 'airfield',
        draft_data: {} as unknown,
        items: [],
        total_items: 0,
        passed_count: 0,
        failed_count: 0,
        na_count: 0,
        bwc_value: null,
        notes: null,
        daily_group_id: 'g-1',
        construction_meeting: false,
        joint_monthly: false,
      }),
    ).rejects.not.toBeInstanceOf(NonRetriableError)
  })
})

describe('discrepancy_create handler', () => {
  it('returns the row on success', async () => {
    const handler = HANDLERS.discrepancy_create!
    state.discrepancy.next = { data: { id: 'pre-allocated-uuid', display_id: 'D-2026-ABCD' }, error: null }
    const result = await handler({
      id: 'pre-allocated-uuid',
      title: 'BWN runway light out',
      description: 'TWY K south side bulb 3',
      location_text: 'TWY K',
      type: 'lighting',
      base_id: 'base-a',
    })
    expect(result).toMatchObject({ id: 'pre-allocated-uuid' })
    // The pre-allocated id must be passed through to createDiscrepancy
    expect((state.discrepancy.calls[0] as { id?: string }).id).toBe('pre-allocated-uuid')
  })

  it('throws NonRetriableError on a structured error', async () => {
    const handler = HANDLERS.discrepancy_create!
    state.discrepancy.next = { data: null, error: 'You do not have permission to perform this action.' }
    await expect(
      handler({
        id: 'x',
        title: 't',
        description: 'd',
        location_text: 'L',
        type: 'other',
      }),
    ).rejects.toBeInstanceOf(NonRetriableError)
  })

  it('treats "Failed to fetch" as transient', async () => {
    const handler = HANDLERS.discrepancy_create!
    state.discrepancy.next = { data: null, error: 'Failed to fetch' }
    await expect(
      handler({
        id: 'x',
        title: 't',
        description: 'd',
        location_text: 'L',
        type: 'other',
      }),
    ).rejects.not.toBeInstanceOf(NonRetriableError)
  })
})

describe('registerAllHandlers + queue end-to-end', () => {
  it('inspection: queues a transient failure and drains it once the next attempt succeeds', async () => {
    const storage = new MemoryStorage()
    let now = new Date('2026-04-25T12:00:00Z')
    const queue = new WriteQueue({
      storage,
      isOnline: () => true,
      now: () => now,
      uuid: () => 'test-uuid-1',
    })
    registerAllHandlers(queue)

    state.inspection.throw = new TypeError('Failed to fetch')
    const r1 = await queue.enqueueOrExecute('inspection_file', INSPECTION_PAYLOAD, {
      baseId: 'base-a',
      userId: 'user-a',
    })
    expect(r1.status).toBe('queued')
    expect((await storage.list())[0].attempts).toBe(1)

    state.inspection.throw = null
    state.inspection.next = {
      data: { id: 'insp-1', display_id: 'AFLD-2026-0001' },
      error: null,
    }
    now = new Date('2026-04-25T12:00:30Z')

    const summary = await queue.drain()
    expect(summary.committed).toBe(1)
    expect(await storage.list()).toHaveLength(0)
  })

  it('check: queues a transient failure and drains it once reconnected', async () => {
    const storage = new MemoryStorage()
    let now = new Date('2026-04-25T12:00:00Z')
    const queue = new WriteQueue({
      storage,
      isOnline: () => true,
      now: () => now,
      uuid: () => 'test-uuid-2',
    })
    registerAllHandlers(queue)

    state.check.throw = new TypeError('NetworkError when fetching')
    const r1 = await queue.enqueueOrExecute('check_file', CHECK_PAYLOAD, {
      baseId: 'base-a',
      userId: 'user-a',
    })
    expect(r1.status).toBe('queued')

    state.check.throw = null
    state.check.next = { data: { id: 'chk-1', display_id: 'AC-AAAA' }, error: null }
    now = new Date('2026-04-25T12:00:30Z')

    const summary = await queue.drain()
    expect(summary.committed).toBe(1)
    expect(await storage.list()).toHaveLength(0)
  })

  it('marks an RLS denial failed without retrying', async () => {
    const storage = new MemoryStorage()
    const queue = new WriteQueue({
      storage,
      isOnline: () => true,
      now: () => new Date('2026-04-25T12:00:00Z'),
      uuid: () => 'test-uuid-3',
    })
    registerAllHandlers(queue)

    state.inspection.next = {
      data: null,
      error: 'You do not have permission to perform this action.',
    }
    await expect(
      queue.enqueueOrExecute('inspection_file', INSPECTION_PAYLOAD, {
        baseId: 'base-a',
        userId: 'user-a',
      }),
    ).rejects.toBeInstanceOf(NonRetriableError)
    expect(await storage.list()).toHaveLength(0)
  })
})
