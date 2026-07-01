import { describe, it, expect } from 'vitest'
import { MemoryStorage } from '@/lib/sync/queue-storage'
import type { WriteHandler } from '@/lib/sync/types'
import { WriteQueue } from '@/lib/sync/write-queue'

// Regression guard for the cross-user offline-queue bug found in the 2026-06-07
// demo sweep: a write queued by one user drained under a different user's
// session (shared device), which RLS rejected as "no row or RLS". A user-scoped
// queue must only drain / list / count the signed-in user's own writes.

function makeScoped() {
  const storage = new MemoryStorage()
  const online = { value: true }
  const current = { value: null as string | null }
  let counter = 0
  const queue = new WriteQueue({
    storage,
    isOnline: () => online.value,
    uuid: () => `u-${++counter}`,
    getUserId: () => current.value,
  })
  const seen: string[] = []
  const handler: WriteHandler<{ tag: string }, null> = async (p) => {
    seen.push(p.tag)
    return null
  }
  queue.registerHandler('inspection_file', handler)

  const queueAs = async (userId: string, tag: string) => {
    online.value = false
    await queue.enqueueOrExecute('inspection_file', { tag }, { baseId: 'base-x', userId })
    online.value = true
  }
  return { queue, current, seen, queueAs }
}

describe('write queue — user scoping', () => {
  it('drains only the signed-in user’s writes and leaves others queued', async () => {
    const { queue, current, seen, queueAs } = makeScoped()
    await queueAs('user-a', 'a1')
    await queueAs('user-a', 'a2')
    await queueAs('user-b', 'b1')

    current.value = 'user-a'
    const summary = await queue.drain()

    expect(summary.committed).toBe(2)
    expect(seen.sort()).toEqual(['a1', 'a2'])
    // user-b's write was skipped, not failed, and remains queued for them.
    current.value = 'user-b'
    expect(await queue.list()).toHaveLength(1)
    expect(seen).not.toContain('b1')
  })

  it('list / pendingCount return only the current user’s items', async () => {
    const { queue, current, queueAs } = makeScoped()
    await queueAs('user-a', 'a1')
    await queueAs('user-b', 'b1')
    await queueAs('user-b', 'b2')

    current.value = 'user-a'
    expect(await queue.list()).toHaveLength(1)
    expect(await queue.pendingCount()).toBe(1)

    current.value = 'user-b'
    expect(await queue.pendingCount()).toBe(2)
  })

  it('drains nothing when the user is unknown (logged out)', async () => {
    const { queue, current, seen, queueAs } = makeScoped()
    await queueAs('user-a', 'a1')

    current.value = null
    const summary = await queue.drain()

    expect(summary.committed).toBe(0)
    expect(seen).toHaveLength(0)
  })

  // Regression guard for the 2026-07-01 inspection-start bug: the start writes
  // (inspection_save_draft + start activity log) were enqueued with userId ''
  // — a non-null value that never equals the real user id, so ownsItem() left
  // them orphaned forever (in_progress locally, nothing in the DB). An empty
  // userId must be treated like an absent one: unowned, drained best-effort
  // under the signed-in user so already-queued rows recover.
  it('drains empty-userId (orphaned) items under the signed-in user', async () => {
    const { queue, current, seen, queueAs } = makeScoped()
    await queueAs('', 'orphan1')
    await queueAs('user-a', 'a1')

    current.value = 'user-a'
    const summary = await queue.drain()

    expect(summary.committed).toBe(2)
    expect(seen.sort()).toEqual(['a1', 'orphan1'])
  })

  it('does not drain empty-userId items when logged out', async () => {
    const { queue, current, seen, queueAs } = makeScoped()
    await queueAs('', 'orphan1')

    current.value = null
    const summary = await queue.drain()

    expect(summary.committed).toBe(0)
    expect(seen).toHaveLength(0)
  })
})
