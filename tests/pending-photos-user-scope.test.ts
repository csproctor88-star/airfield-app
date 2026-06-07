import { describe, it, expect, beforeEach } from 'vitest'
import {
  persistPendingPhoto,
  listPendingPhotosForCurrentUser,
  countPendingPhotosForCurrentUser,
  setPendingPhotoUserIdProvider,
  _resetPendingPhotoStorageForTests,
} from '@/lib/sync/pending-photos'

// Companion guard to write-queue-user-scope: the pending-photo inspector + badge
// must show only the signed-in user's photos on a shared device.

const blob = () => new Blob(['x'], { type: 'image/jpeg' })

beforeEach(() => {
  _resetPendingPhotoStorageForTests()
})

describe('pending photos — user scoping', () => {
  it('scopes list + count to the current user', async () => {
    const current = { value: 'user-a' as string | null }
    setPendingPhotoUserIdProvider(() => current.value)

    await persistPendingPhoto({ entityType: 'inspection', entityId: 'i1', blob: blob(), filename: 'a.jpg', mime: 'image/jpeg' })
    current.value = 'user-b'
    await persistPendingPhoto({ entityType: 'inspection', entityId: 'i2', blob: blob(), filename: 'b.jpg', mime: 'image/jpeg' })

    current.value = 'user-a'
    expect(await countPendingPhotosForCurrentUser()).toBe(1)
    expect((await listPendingPhotosForCurrentUser()).map((p) => p.filename)).toEqual(['a.jpg'])

    current.value = 'user-b'
    expect(await countPendingPhotosForCurrentUser()).toBe(1)
    expect((await listPendingPhotosForCurrentUser()).map((p) => p.filename)).toEqual(['b.jpg'])
  })
})
