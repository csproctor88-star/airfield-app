import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryStorage } from '@/lib/sync/queue-storage'
import {
  ConflictError,
  NonRetriableError,
  type WriteHandler,
} from '@/lib/sync/types'
import {
  WriteQueue,
  WRITE_COMMITTED_EVENT,
  type WriteCommittedDetail,
} from '@/lib/sync/write-queue'
import { MAX_ATTEMPTS } from '@/lib/sync/backoff'

interface Clock {
  current: Date
  advanceMs(ms: number): void
}

const makeClock = (start: string): Clock => {
  let current = new Date(start)
  return {
    get current() {
      return current
    },
    advanceMs(ms: number) {
      current = new Date(current.getTime() + ms)
    },
  }
}

interface Harness {
  queue: WriteQueue
  storage: MemoryStorage
  clock: Clock
  online: { value: boolean }
}

const makeHarness = (opts: { online?: boolean } = {}): Harness => {
  const storage = new MemoryStorage()
  const clock = makeClock('2026-04-25T12:00:00Z')
  const online = { value: opts.online ?? true }
  let counter = 0
  const queue = new WriteQueue({
    storage,
    isOnline: () => online.value,
    now: () => clock.current,
    uuid: () => `uuid-${++counter}`,
  })
  return { queue, storage, clock, online }
}

const META = { baseId: 'base-a', userId: 'user-a' }

describe('enqueueOrExecute — online path', () => {
  it('runs the handler inline and returns committed', async () => {
    const { queue } = makeHarness()
    const handler: WriteHandler<{ x: number }, string> = async (p) =>
      `done-${p.x}`
    queue.registerHandler('inspection_file', handler)

    const result = await queue.enqueueOrExecute<{ x: number }, string>(
      'inspection_file',
      { x: 7 },
      META,
    )

    expect(result).toEqual({ status: 'committed', data: 'done-7' })
    expect(await queue.list()).toHaveLength(0)
  })

  it('queues when handler throws a transient error', async () => {
    const { queue, storage } = makeHarness()
    queue.registerHandler('inspection_file', async () => {
      throw new Error('network blip')
    })

    const result = await queue.enqueueOrExecute(
      'inspection_file',
      { foo: 1 },
      META,
    )

    expect(result.status).toBe('queued')
    const stored = await storage.list()
    expect(stored).toHaveLength(1)
    expect(stored[0].attempts).toBe(1)
    expect(stored[0].lastError).toBe('network blip')
    expect(stored[0].status).toBe('pending')
  })

  it('rethrows NonRetriableError without queuing', async () => {
    const { queue, storage } = makeHarness()
    queue.registerHandler('inspection_file', async () => {
      throw new NonRetriableError('400 bad payload')
    })

    await expect(
      queue.enqueueOrExecute('inspection_file', {}, META),
    ).rejects.toThrow(/bad payload/)

    expect(await storage.list()).toHaveLength(0)
  })

  it('rethrows ConflictError without queuing', async () => {
    const { queue, storage } = makeHarness()
    queue.registerHandler('inspection_file', async () => {
      throw new ConflictError('row mutated')
    })

    await expect(
      queue.enqueueOrExecute('inspection_file', {}, META),
    ).rejects.toThrow(/mutated/)
    expect(await storage.list()).toHaveLength(0)
  })
})

describe('enqueueOrExecute — offline path', () => {
  it('queues without invoking the handler', async () => {
    const { queue, storage } = makeHarness({ online: false })
    const handler = vi.fn(async () => 'never')
    queue.registerHandler('inspection_file', handler)

    const result = await queue.enqueueOrExecute(
      'inspection_file',
      { foo: 1 },
      META,
    )

    expect(result.status).toBe('queued')
    expect(handler).not.toHaveBeenCalled()
    expect(await storage.list()).toHaveLength(1)
  })

  it('queues even with no handler registered yet', async () => {
    const { queue } = makeHarness({ online: false })
    const result = await queue.enqueueOrExecute(
      'inspection_file',
      { foo: 1 },
      META,
    )
    expect(result.status).toBe('queued')
  })
})

describe('drain', () => {
  it('processes pending items oldest-first', async () => {
    const { queue, online, clock } = makeHarness({ online: false })
    const calls: number[] = []
    queue.registerHandler('inspection_file', async (p: any) => {
      calls.push(p.n)
    })

    // Insert in reverse chronological order
    clock.advanceMs(3000)
    await queue.enqueueOrExecute('inspection_file', { n: 3 }, META)
    clock.advanceMs(-2000) // before #3
    await queue.enqueueOrExecute('inspection_file', { n: 1 }, META)
    clock.advanceMs(1000)
    await queue.enqueueOrExecute('inspection_file', { n: 2 }, META)

    online.value = true
    clock.advanceMs(60_000) // outside any backoff window

    const summary = await queue.drain()
    expect(calls).toEqual([1, 2, 3])
    expect(summary.committed).toBe(3)
    expect(summary.attempted).toBe(3)
    expect(await queue.list()).toHaveLength(0)
  })

  it('removes committed items and increments retried on transient failure', async () => {
    const { queue, online, clock, storage } = makeHarness({ online: false })
    let fail = true
    queue.registerHandler('inspection_file', async () => {
      if (fail) throw new Error('boom')
    })

    await queue.enqueueOrExecute('inspection_file', { n: 1 }, META)
    online.value = true
    clock.advanceMs(60_000)

    const summary1 = await queue.drain()
    expect(summary1.retried).toBe(1)
    expect(summary1.committed).toBe(0)
    const after1 = await storage.list()
    expect(after1[0].attempts).toBe(1)
    expect(after1[0].status).toBe('pending')
    expect(after1[0].lastError).toBe('boom')

    // Pass the backoff window then succeed
    fail = false
    clock.advanceMs(60_000)
    const summary2 = await queue.drain()
    expect(summary2.committed).toBe(1)
    expect(await storage.list()).toHaveLength(0)
  })

  it('skips items still inside their backoff window', async () => {
    const { queue, online, clock, storage } = makeHarness({ online: false })
    queue.registerHandler('inspection_file', async () => {
      throw new Error('blip')
    })
    await queue.enqueueOrExecute('inspection_file', { n: 1 }, META)
    online.value = true
    clock.advanceMs(60_000)

    await queue.drain()
    const summary = await queue.drain() // immediate retry
    expect(summary.attempted).toBe(0)
    expect(summary.skipped).toBe(1)

    const stored = await storage.list()
    expect(stored[0].attempts).toBe(1) // not bumped a second time
  })

  it('marks failed when retry cap is hit', async () => {
    const { queue, online, clock, storage } = makeHarness({ online: false })
    queue.registerHandler('inspection_file', async () => {
      throw new Error('always fails')
    })
    await queue.enqueueOrExecute('inspection_file', { n: 1 }, META)
    online.value = true

    // Drain MAX_ATTEMPTS - 1 more times (enqueue counted attempt #1 already
    // because the harness was offline → enqueue path uses attempts=0).
    // Actually offline enqueue starts at attempts=0, so we need MAX_ATTEMPTS drains.
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      clock.advanceMs(10 * 60 * 1000) // beyond backoff cap
      await queue.drain()
    }

    const stored = await storage.list()
    expect(stored).toHaveLength(1)
    expect(stored[0].status).toBe('failed')
    expect(stored[0].attempts).toBe(MAX_ATTEMPTS)
  })

  it('marks failed immediately on NonRetriableError', async () => {
    const { queue, online, clock, storage } = makeHarness({ online: false })
    queue.registerHandler('inspection_file', async () => {
      throw new NonRetriableError('400 schema')
    })
    await queue.enqueueOrExecute('inspection_file', { n: 1 }, META)
    online.value = true
    clock.advanceMs(60_000)

    const summary = await queue.drain()
    expect(summary.failed).toBe(1)
    expect(summary.retried).toBe(0)
    const stored = await storage.list()
    expect(stored[0].status).toBe('failed')
    expect(stored[0].attempts).toBe(1)
  })

  it('marks conflict on ConflictError and stops retrying', async () => {
    const { queue, online, clock, storage } = makeHarness({ online: false })
    queue.registerHandler('inspection_file', async () => {
      throw new ConflictError('row newer on server')
    })
    await queue.enqueueOrExecute('inspection_file', { n: 1 }, META)
    online.value = true
    clock.advanceMs(60_000)

    await queue.drain()
    const stored = await storage.list()
    expect(stored[0].status).toBe('conflict')
    expect(stored[0].conflictAt).toBeTruthy()

    // Subsequent drain must skip the conflicted entry
    clock.advanceMs(10 * 60 * 1000)
    const summary = await queue.drain()
    expect(summary.attempted).toBe(0)
    expect(summary.skipped).toBe(1)
  })

  it('skips items whose handler is not yet registered', async () => {
    const { queue, online, clock, storage } = makeHarness({ online: false })
    await queue.enqueueOrExecute('inspection_file', { n: 1 }, META)
    online.value = true
    clock.advanceMs(60_000)

    const summary = await queue.drain()
    expect(summary.skipped).toBe(1)
    expect(summary.attempted).toBe(0)
    expect(await storage.list()).toHaveLength(1)
  })

  it('returns empty summary when offline', async () => {
    const { queue } = makeHarness({ online: false })
    queue.registerHandler('inspection_file', async () => {})
    await queue.enqueueOrExecute('inspection_file', { n: 1 }, META)

    const summary = await queue.drain()
    expect(summary).toEqual({
      attempted: 0,
      committed: 0,
      retried: 0,
      failed: 0,
      conflict: 0,
      skipped: 0,
    })
  })

  it('dispatches a window event on each successful commit so feature pages can refresh', async () => {
    const { queue, online, clock } = makeHarness({ online: false })
    queue.registerHandler('inspection_file', async () => 'ok')
    queue.registerHandler('check_file', async () => 'ok')

    const events: WriteCommittedDetail[] = []
    const onCommit = (e: Event) => {
      events.push((e as CustomEvent<WriteCommittedDetail>).detail)
    }
    window.addEventListener(WRITE_COMMITTED_EVENT, onCommit)

    try {
      await queue.enqueueOrExecute(
        'inspection_file',
        { foo: 1 },
        { ...META, optimisticEntityId: 'opt-insp-1' },
      )
      await queue.enqueueOrExecute('check_file', { foo: 2 }, META)

      online.value = true
      clock.advanceMs(60_000)
      await queue.drain()

      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('inspection_file')
      expect(events[0].optimisticEntityId).toBe('opt-insp-1')
      expect(events[1].type).toBe('check_file')
    } finally {
      window.removeEventListener(WRITE_COMMITTED_EVENT, onCommit)
    }
  })

  it('does not dispatch the commit event for retried / failed items', async () => {
    const { queue, online, clock } = makeHarness({ online: false })
    let attempt = 0
    queue.registerHandler('inspection_file', async () => {
      attempt++
      if (attempt === 1) throw new Error('transient')
      throw new NonRetriableError('schema')
    })

    const events: WriteCommittedDetail[] = []
    const onCommit = (e: Event) => {
      events.push((e as CustomEvent<WriteCommittedDetail>).detail)
    }
    window.addEventListener(WRITE_COMMITTED_EVENT, onCommit)

    try {
      await queue.enqueueOrExecute('inspection_file', { foo: 1 }, META)
      online.value = true
      clock.advanceMs(60_000)
      await queue.drain() // retry path
      clock.advanceMs(60_000)
      await queue.drain() // non-retriable → failed

      expect(events).toHaveLength(0)
    } finally {
      window.removeEventListener(WRITE_COMMITTED_EVENT, onCommit)
    }
  })

  it('single-flight: concurrent drain calls share one in-flight pass', async () => {
    const { queue, online, clock } = makeHarness({ online: false })
    let calls = 0
    queue.registerHandler('inspection_file', async () => {
      calls++
      // Yield to let a concurrent drain() see the in-flight promise
      await new Promise((r) => setTimeout(r, 0))
    })
    await queue.enqueueOrExecute('inspection_file', { n: 1 }, META)
    online.value = true
    clock.advanceMs(60_000)

    const [a, b] = await Promise.all([queue.drain(), queue.drain()])
    expect(calls).toBe(1)
    // Both callers see the same summary
    expect(a).toEqual(b)
  })
})

describe('manual queue management', () => {
  beforeEach(() => {
    // No global state to reset — harness factory is stateless.
  })

  it('resetForRetry flips a failed item back to pending and zeroes attempts', async () => {
    const { queue, online, clock, storage } = makeHarness({ online: false })
    queue.registerHandler('inspection_file', async () => {
      throw new NonRetriableError('400')
    })
    const enq = await queue.enqueueOrExecute('inspection_file', { n: 1 }, META)
    if (enq.status !== 'queued') throw new Error('expected queued')
    online.value = true
    clock.advanceMs(60_000)
    await queue.drain()
    expect((await storage.list())[0].status).toBe('failed')

    await queue.resetForRetry(enq.id)
    const after = (await storage.list())[0]
    expect(after.status).toBe('pending')
    expect(after.attempts).toBe(0)
    expect(after.lastError).toBeNull()
  })

  it('discard removes an item from the queue', async () => {
    const { queue } = makeHarness({ online: false })
    const enq = await queue.enqueueOrExecute('inspection_file', { n: 1 }, META)
    if (enq.status !== 'queued') throw new Error('expected queued')
    await queue.discard(enq.id)
    expect(await queue.list()).toHaveLength(0)
  })

  it('pendingCount excludes failed and conflict entries', async () => {
    const { queue, online, clock } = makeHarness({ online: false })
    queue.registerHandler('inspection_file', async () => {
      throw new NonRetriableError('x')
    })
    queue.registerHandler('check_file', async () => {
      throw new ConflictError('x')
    })
    queue.registerHandler('discrepancy_create', async () => {
      throw new Error('transient')
    })

    await queue.enqueueOrExecute('inspection_file', {}, META)
    await queue.enqueueOrExecute('check_file', {}, META)
    await queue.enqueueOrExecute('discrepancy_create', {}, META)

    online.value = true
    clock.advanceMs(60_000)
    await queue.drain()

    expect(await queue.pendingCount()).toBe(1)
  })

  it('needsAttentionCount counts only failed and conflict entries', async () => {
    const { queue, online, clock } = makeHarness({ online: false })
    queue.registerHandler('inspection_file', async () => {
      throw new NonRetriableError('x')
    })
    queue.registerHandler('check_file', async () => {
      throw new ConflictError('x')
    })
    queue.registerHandler('discrepancy_create', async () => {
      throw new Error('transient')
    })

    await queue.enqueueOrExecute('inspection_file', {}, META) // → failed
    await queue.enqueueOrExecute('check_file', {}, META) // → conflict
    await queue.enqueueOrExecute('discrepancy_create', {}, META) // → pending after retry

    expect(await queue.needsAttentionCount()).toBe(0)

    online.value = true
    clock.advanceMs(60_000)
    await queue.drain()

    expect(await queue.needsAttentionCount()).toBe(2)
    expect(await queue.pendingCount()).toBe(1)
  })
})
