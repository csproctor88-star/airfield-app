import { describe, it, expect, beforeEach } from 'vitest'
import {
  MemoryPendingPhotoStorage,
  type PendingPhoto,
} from '@/lib/sync/pending-photos'

const fakeBlob = (text: string): Blob => new Blob([text], { type: 'image/jpeg' })

const sample = (overrides: Partial<PendingPhoto> = {}): PendingPhoto => ({
  id: 'p-1',
  entityType: 'inspection',
  entityId: 'insp-a',
  blob: fakeBlob('photo'),
  filename: 'photo.jpg',
  mime: 'image/jpeg',
  itemId: null,
  issueIndex: null,
  latitude: null,
  longitude: null,
  baseId: null,
  createdAt: '2026-04-25T12:00:00Z',
  ...overrides,
})

describe('MemoryPendingPhotoStorage', () => {
  let storage: MemoryPendingPhotoStorage

  beforeEach(() => {
    storage = new MemoryPendingPhotoStorage()
  })

  it('round-trips a put → get', async () => {
    await storage.put(sample())
    const got = await storage.get('p-1')
    expect(got).not.toBeNull()
    expect(got?.entityId).toBe('insp-a')
    expect(got?.filename).toBe('photo.jpg')
  })

  it('returns null for missing ids', async () => {
    expect(await storage.get('nope')).toBeNull()
  })

  it('list returns all items', async () => {
    await storage.put(sample({ id: 'a' }))
    await storage.put(sample({ id: 'b' }))
    await storage.put(sample({ id: 'c' }))
    const all = await storage.list()
    expect(all.map((p) => p.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('listForEntity filters by entityType + entityId', async () => {
    await storage.put(sample({ id: 'a', entityId: 'insp-1' }))
    await storage.put(sample({ id: 'b', entityId: 'insp-1' }))
    await storage.put(sample({ id: 'c', entityId: 'insp-2' }))
    await storage.put(sample({ id: 'd', entityType: 'check', entityId: 'insp-1' }))
    const inspOnePhotos = await storage.listForEntity('inspection', 'insp-1')
    expect(inspOnePhotos.map((p) => p.id).sort()).toEqual(['a', 'b'])
    const checkPhotos = await storage.listForEntity('check', 'insp-1')
    expect(checkPhotos.map((p) => p.id)).toEqual(['d'])
  })

  it('count reflects current size', async () => {
    expect(await storage.count()).toBe(0)
    await storage.put(sample({ id: 'a' }))
    await storage.put(sample({ id: 'b' }))
    expect(await storage.count()).toBe(2)
    await storage.delete('a')
    expect(await storage.count()).toBe(1)
  })

  it('delete removes a single item', async () => {
    await storage.put(sample({ id: 'a' }))
    await storage.put(sample({ id: 'b' }))
    await storage.delete('a')
    expect(await storage.get('a')).toBeNull()
    expect((await storage.list()).map((p) => p.id)).toEqual(['b'])
  })

  it('clear empties the store', async () => {
    await storage.put(sample({ id: 'a' }))
    await storage.put(sample({ id: 'b' }))
    await storage.clear()
    expect(await storage.list()).toEqual([])
  })

  it('put on existing id replaces the row', async () => {
    await storage.put(sample({ id: 'a', filename: 'old.jpg' }))
    await storage.put(sample({ id: 'a', filename: 'new.jpg' }))
    const got = await storage.get('a')
    expect(got?.filename).toBe('new.jpg')
  })

  it('preserves Blob references (does not deep clone)', async () => {
    const blob = fakeBlob('original')
    await storage.put(sample({ id: 'a', blob }))
    const got = await storage.get('a')
    expect(got?.blob).toBe(blob)
  })
})
