import { describe, it, expect } from 'vitest'
import { MemoryStorage } from '@/lib/sync/queue-storage'
import { WriteQueue } from '@/lib/sync/write-queue'
import { enqueueNavaidStatus } from '@/lib/navaid-status-write'

/**
 * Regression guard: the Airfield Status board NAVAID grid used to call
 * updateNavaidStatus directly and drop the write when offline. enqueueNavaidStatus
 * routes it through the queue.
 */
function makeQueue(online: boolean) {
  return new WriteQueue({ storage: new MemoryStorage(), isOnline: () => online })
}

describe('enqueueNavaidStatus', () => {
  it('queues a navaid_status_update when offline', async () => {
    const q = makeQueue(false)
    const calls: unknown[] = []
    q.registerHandler('navaid_status_update', async (p) => {
      calls.push(p)
      return true
    })

    const res = await enqueueNavaidStatus('nav-1', 'red', 'PAPI out', 'base-1', 'user-1', q)

    expect(res.status).toBe('queued')
    expect(calls).toHaveLength(0)
    const items = await q.list()
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('navaid_status_update')
    expect(items[0].payload).toEqual({ id: 'nav-1', status: 'red', notes: 'PAPI out' })
  })

  it('commits inline when online', async () => {
    const q = makeQueue(true)
    const calls: unknown[] = []
    q.registerHandler('navaid_status_update', async (p) => {
      calls.push(p)
      return true
    })

    const res = await enqueueNavaidStatus('nav-1', 'green', null, 'base-1', 'user-1', q)

    expect(res.status).toBe('committed')
    expect(calls).toEqual([{ id: 'nav-1', status: 'green', notes: null }])
  })
})
