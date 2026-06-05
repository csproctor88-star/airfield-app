import { describe, it, expect } from 'vitest'
import { MemoryStorage } from '@/lib/sync/queue-storage'
import { WriteQueue } from '@/lib/sync/write-queue'
import { enqueueAirfieldStatus } from '@/lib/airfield-status-write'

/**
 * Regression guard for the airfield-status board offline bug.
 *
 * The board (lib/dashboard-context.tsx) used to call updateAirfieldStatus
 * directly, so a status change made while offline was silently dropped — no
 * queue entry, no retry, only a stale realtime-down toast that usually never
 * fired. Inspections / checks / ACSI / daily-review signing all route through
 * the offline write queue; the board did not. enqueueAirfieldStatus is the
 * single entry point that fixes that, and these tests lock the behavior in.
 */

function makeQueue(online: boolean) {
  return new WriteQueue({ storage: new MemoryStorage(), isOnline: () => online })
}

describe('enqueueAirfieldStatus — board writes route through the offline queue', () => {
  it('queues an airfield_status_update when offline (the regression: board writes used to drop)', async () => {
    const q = makeQueue(false)
    const calls: unknown[] = []
    q.registerHandler('airfield_status_update', async (p) => {
      calls.push(p)
      return true
    })

    const res = await enqueueAirfieldStatus({ runway_status: 'closed' }, 'base-1', 'user-1', q)

    expect(res.status).toBe('queued')
    expect(calls).toHaveLength(0) // NOT executed while offline
    const items = await q.list()
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('airfield_status_update')
    expect(items[0].payload).toEqual({ updates: { runway_status: 'closed' }, baseId: 'base-1' })
    expect(items[0].baseId).toBe('base-1')
  })

  it('commits inline when online', async () => {
    const q = makeQueue(true)
    const calls: unknown[] = []
    q.registerHandler('airfield_status_update', async (p) => {
      calls.push(p)
      return true
    })

    const res = await enqueueAirfieldStatus({ bwc_value: 'MODERATE' }, 'base-1', 'user-1', q)

    expect(res.status).toBe('committed')
    expect(calls).toHaveLength(1)
  })

  it('drains queued board writes on reconnect', async () => {
    let online = false
    const q = new WriteQueue({ storage: new MemoryStorage(), isOnline: () => online })
    const calls: unknown[] = []
    q.registerHandler('airfield_status_update', async (p) => {
      calls.push(p)
      return true
    })

    await enqueueAirfieldStatus({ afm_closed: true }, 'base-1', 'user-1', q)
    expect(await q.list()).toHaveLength(1)

    online = true
    const summary = await q.drain()

    expect(summary.committed).toBe(1)
    expect(calls).toHaveLength(1)
    expect(await q.list()).toHaveLength(0)
  })
})
