import { describe, it, expect, vi, beforeEach } from 'vitest'

type Call = {
  table: string
  op: 'select' | 'update' | 'delete' | 'insert'
  payload?: unknown
  filters: Array<{ kind: string; arg: unknown; arg2?: unknown }>
}

const calls: Call[] = []
let updateError: { message: string } | null = null
let existingPhotoCount: number | null = 3

function makeBuilder(table: string) {
  let current: Call | null = null
  const builder: Record<string, unknown> = {}

  builder.select = vi.fn((_cols?: string) => {
    current = { table, op: 'select', filters: [] }
    calls.push(current)
    return builder
  })
  builder.update = vi.fn((payload: unknown) => {
    current = { table, op: 'update', payload, filters: [] }
    calls.push(current)
    return builder
  })
  builder.eq = vi.fn((col: string, val: unknown) => {
    current?.filters.push({ kind: 'eq', arg: col, arg2: val })
    return builder
  })
  builder.in = vi.fn((col: string, vals: unknown) => {
    current?.filters.push({ kind: 'in', arg: col, arg2: vals })
    return builder
  })
  builder.single = vi.fn(async () => {
    if (table === 'discrepancies' && current?.op === 'select') {
      return existingPhotoCount === null
        ? { data: null, error: null }
        : { data: { photo_count: existingPhotoCount }, error: null }
    }
    return { data: null, error: null }
  })
  // Direct awaits on the builder (no `.single()`) — used by `.update().in()` chains
  builder.then = (resolve: (v: unknown) => unknown) => {
    if (current?.op === 'update' && current.table === 'photos') {
      return resolve({ error: updateError })
    }
    return resolve({ error: null })
  }

  return builder
}

const supabaseStub = {
  from: vi.fn((table: string) => makeBuilder(table)),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabaseStub,
}))

// `discrepancies.ts` imports from the relative path './client' — alias both forms
vi.mock('../lib/supabase/client', () => ({
  createClient: () => supabaseStub,
}))

import { linkPhotosToDiscrepancy } from '@/lib/supabase/discrepancies'

describe('linkPhotosToDiscrepancy', () => {
  beforeEach(() => {
    calls.length = 0
    updateError = null
    existingPhotoCount = 3
  })

  it('returns early without touching supabase when no photo ids are passed', async () => {
    const res = await linkPhotosToDiscrepancy([], 'disc-1')
    expect(res.error).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('updates each photo with the discrepancy id and bumps photo_count', async () => {
    const res = await linkPhotosToDiscrepancy(['p1', 'p2'], 'disc-1')
    expect(res.error).toBeNull()

    const photoUpdate = calls.find((c) => c.table === 'photos' && c.op === 'update')
    expect(photoUpdate).toBeTruthy()
    expect(photoUpdate?.payload).toMatchObject({ discrepancy_id: 'disc-1' })
    expect(photoUpdate?.filters).toContainEqual({ kind: 'in', arg: 'id', arg2: ['p1', 'p2'] })

    const countUpdate = calls
      .filter((c) => c.table === 'discrepancies' && c.op === 'update')
      .at(-1)
    expect(countUpdate?.payload).toEqual({ photo_count: 5 })
  })

  it('surfaces a friendly error when the photo update fails', async () => {
    updateError = { message: 'permission denied for table photos' }
    const res = await linkPhotosToDiscrepancy(['p1'], 'disc-1')
    expect(res.error).toBeTruthy()
    expect(res.error?.toLowerCase()).not.toContain('permission denied for table photos')

    const countUpdate = calls.find(
      (c) => c.table === 'discrepancies' && c.op === 'update',
    )
    expect(countUpdate).toBeUndefined()
  })

  it('handles a missing discrepancy row by skipping the count bump', async () => {
    existingPhotoCount = null
    const res = await linkPhotosToDiscrepancy(['p1'], 'disc-missing')
    expect(res.error).toBeNull()

    const countUpdate = calls.find(
      (c) => c.table === 'discrepancies' && c.op === 'update',
    )
    expect(countUpdate).toBeUndefined()
  })
})
