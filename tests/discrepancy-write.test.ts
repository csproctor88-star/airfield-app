import { describe, it, expect } from 'vitest'
import { MemoryStorage } from '@/lib/sync/queue-storage'
import { WriteQueue } from '@/lib/sync/write-queue'
import { submitDiscrepancyFanout } from '@/lib/discrepancy-write'

/**
 * Regression guard: the New Discrepancy page and the Visual NAVAIDs "Report
 * Outage" action used to write discrepancy + feature-inop + outage events
 * directly and lose them all when offline. submitDiscrepancyFanout pre-allocates
 * the discrepancy id and queues the whole fan-out, FK-consistent on drain.
 */
function makeQueue(online: boolean) {
  return new WriteQueue({ storage: new MemoryStorage(), isOnline: () => online })
}

function registerStubs(q: WriteQueue, sink: Record<string, unknown[]>) {
  q.registerHandler('discrepancy_create', async (p) => {
    sink.disc.push(p)
    return { id: (p as { id: string }).id }
  })
  q.registerHandler('infrastructure_feature_status_update', async (p) => {
    sink.inop.push(p)
    return 1
  })
  q.registerHandler('outage_event_create', async (p) => {
    sink.outage.push(p)
    return { id: 'oe' }
  })
}

describe('submitDiscrepancyFanout', () => {
  it('queues discrepancy + inop + outage with a shared pre-allocated id when offline', async () => {
    const q = makeQueue(false)
    const sink = { disc: [], inop: [], outage: [] } as Record<string, unknown[]>
    registerStubs(q, sink)

    const res = await submitDiscrepancyFanout(
      {
        discrepancy: {
          title: 'INOP: PAPI 23',
          description: 'Status: INOPERATIVE',
          location_text: 'RWY 23',
          type: 'lighting',
          base_id: 'base-1',
          infrastructure_feature_id: 'feat-9',
        },
        inopFeatureIds: ['feat-9'],
        outageEvents: [{ base_id: 'base-1', feature_id: 'feat-9', event_type: 'reported', notes: 'INOP — PAPI 23' }],
        baseId: 'base-1',
        userId: 'user-1',
      },
      q,
    )

    expect(res.status).toBe('queued')
    // Nothing executed while offline.
    expect(sink.disc).toHaveLength(0)

    const items = await q.list()
    expect(items.map((i) => i.type)).toEqual([
      'discrepancy_create',
      'infrastructure_feature_status_update',
      'outage_event_create',
    ])
    // Discrepancy payload carries the pre-allocated id...
    expect((items[0].payload as { id: string }).id).toBe(res.id)
    // ...and the outage event FKs the same id.
    expect((items[2].payload as { discrepancy_id: string }).discrepancy_id).toBe(res.id)
  })

  it('commits the whole fan-out inline when online', async () => {
    const q = makeQueue(true)
    const sink = { disc: [], inop: [], outage: [] } as Record<string, unknown[]>
    registerStubs(q, sink)

    const res = await submitDiscrepancyFanout(
      {
        discrepancy: { title: 'X', description: 'Y', location_text: 'Z', type: 'lighting', base_id: 'base-1' },
        inopFeatureIds: ['f1', 'f2'],
        outageEvents: [
          { base_id: 'base-1', feature_id: 'f1', event_type: 'reported' },
          { base_id: 'base-1', feature_id: 'f2', event_type: 'reported' },
        ],
        baseId: 'base-1',
        userId: 'user-1',
      },
      q,
    )

    expect(res.status).toBe('committed')
    expect(sink.disc).toHaveLength(1)
    expect(sink.inop).toHaveLength(2)
    expect(sink.outage).toHaveLength(2)
    expect((sink.outage[0] as { discrepancy_id: string }).discrepancy_id).toBe(res.id)
  })

  it('drains a queued fan-out in FK-safe order on reconnect', async () => {
    let online = false
    const q = new WriteQueue({ storage: new MemoryStorage(), isOnline: () => online })
    const order: string[] = []
    q.registerHandler('discrepancy_create', async (p) => {
      order.push('disc')
      return { id: (p as { id: string }).id }
    })
    q.registerHandler('infrastructure_feature_status_update', async () => {
      order.push('inop')
      return 1
    })
    q.registerHandler('outage_event_create', async () => {
      order.push('outage')
      return { id: 'oe' }
    })

    await submitDiscrepancyFanout(
      {
        discrepancy: { title: 'X', description: 'Y', location_text: 'Z', type: 'lighting', base_id: 'base-1' },
        inopFeatureIds: ['f1'],
        outageEvents: [{ base_id: 'base-1', feature_id: 'f1', event_type: 'reported' }],
        baseId: 'base-1',
        userId: 'user-1',
      },
      q,
    )

    online = true
    const summary = await q.drain()

    expect(summary.committed).toBe(3)
    expect(order).toEqual(['disc', 'inop', 'outage']) // discrepancy first → FK resolves
  })
})
