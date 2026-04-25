import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryStorage } from '@/lib/sync/queue-storage'
import type { QueuedWrite } from '@/lib/sync/types'

const sample = (overrides: Partial<QueuedWrite> = {}): QueuedWrite => ({
  id: 'item-1',
  type: 'inspection_file',
  payload: { foo: 'bar' },
  createdAt: '2026-04-25T12:00:00Z',
  attempts: 0,
  lastAttemptAt: null,
  lastError: null,
  baseId: 'base-a',
  userId: 'user-a',
  status: 'pending',
  ...overrides,
})

describe('MemoryStorage', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
  })

  it('round-trips a put → get', async () => {
    await storage.put(sample())
    const got = await storage.get('item-1')
    expect(got).not.toBeNull()
    expect(got?.id).toBe('item-1')
    expect(got?.payload).toEqual({ foo: 'bar' })
  })

  it('returns null for missing ids', async () => {
    expect(await storage.get('nope')).toBeNull()
  })

  it('list() returns all items', async () => {
    await storage.put(sample({ id: 'a' }))
    await storage.put(sample({ id: 'b' }))
    await storage.put(sample({ id: 'c' }))
    const all = await storage.list()
    expect(all.map((w) => w.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('delete removes an item', async () => {
    await storage.put(sample({ id: 'a' }))
    await storage.delete('a')
    expect(await storage.get('a')).toBeNull()
  })

  it('clear removes all items', async () => {
    await storage.put(sample({ id: 'a' }))
    await storage.put(sample({ id: 'b' }))
    await storage.clear()
    expect(await storage.list()).toEqual([])
  })

  it('put on existing id replaces the row', async () => {
    await storage.put(sample({ id: 'a', attempts: 0 }))
    await storage.put(sample({ id: 'a', attempts: 3 }))
    const got = await storage.get('a')
    expect(got?.attempts).toBe(3)
  })

  it('isolates stored copies — mutating the input does not mutate the store', async () => {
    const item = sample({ id: 'a', payload: { count: 1 } })
    await storage.put(item)
    // Mutate the original after put
    ;(item.payload as { count: number }).count = 999
    const got = await storage.get('a')
    expect((got?.payload as { count: number }).count).toBe(1)
  })

  it('isolates retrieved copies — mutating the result does not mutate the store', async () => {
    await storage.put(sample({ id: 'a', payload: { count: 1 } }))
    const first = await storage.get('a')
    ;(first?.payload as { count: number }).count = 999
    const second = await storage.get('a')
    expect((second?.payload as { count: number }).count).toBe(1)
  })
})
