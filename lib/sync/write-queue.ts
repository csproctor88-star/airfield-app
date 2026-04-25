/**
 * Offline write queue — public API.
 *
 * Single point of entry for any feature that needs to "submit this even
 * if we're offline". See docs/Offline_Write_Queue_Spec.md for design.
 *
 * Foundation only — no Supabase calls, no UI. Features wrap onto this in
 * follow-up sessions by calling `registerHandler('inspection_file', ...)`
 * during app startup, then routing their submit calls through
 * `enqueueOrExecute('inspection_file', payload, meta)`.
 */

import {
  hasExhaustedRetries,
  isReadyForRetry,
  nextRetryDelayMs,
} from './backoff'
import { getDefaultStorage, type QueueStorage } from './queue-storage'
import {
  ConflictError,
  NonRetriableError,
  type EnqueueResult,
  type QueuedWrite,
  type WriteHandler,
  type WriteType,
} from './types'

export interface DrainSummary {
  attempted: number
  committed: number
  retried: number
  failed: number
  conflict: number
  skipped: number
}

export interface WriteQueueOptions {
  storage?: QueueStorage
  /**
   * Override navigator.onLine. Useful for tests and for narrowing what
   * counts as "online" (e.g., gating on a heartbeat ping).
   */
  isOnline?: () => boolean
  /**
   * Injected clock for deterministic tests. Returns the current time
   * as `new Date()` would.
   */
  now?: () => Date
  /**
   * Injected uuid generator. Defaults to `crypto.randomUUID` when
   * available, falling back to a Math.random-backed v4-ish string.
   */
  uuid?: () => string
}

const defaultUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Non-cryptographic fallback for older environments. Collisions on a
  // single-device queue are vanishingly unlikely; if one occurs the put
  // will overwrite the older entry, which is acceptable.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const defaultIsOnline = (): boolean => {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export class WriteQueue {
  private readonly storage: QueueStorage
  private readonly isOnline: () => boolean
  private readonly now: () => Date
  private readonly uuid: () => string
  private readonly handlers = new Map<WriteType, WriteHandler<any, any>>()

  /** Single-flight guard so concurrent triggers don't double-drain. */
  private draining: Promise<DrainSummary> | null = null

  constructor(opts: WriteQueueOptions = {}) {
    this.storage = opts.storage ?? getDefaultStorage()
    this.isOnline = opts.isOnline ?? defaultIsOnline
    this.now = opts.now ?? (() => new Date())
    this.uuid = opts.uuid ?? defaultUuid
  }

  // -------------------------------------------------------------------
  // Handler registry
  // -------------------------------------------------------------------

  registerHandler<P, R>(type: WriteType, handler: WriteHandler<P, R>): void {
    this.handlers.set(type, handler as WriteHandler<unknown, unknown>)
  }

  hasHandler(type: WriteType): boolean {
    return this.handlers.has(type)
  }

  // -------------------------------------------------------------------
  // Enqueue / execute
  // -------------------------------------------------------------------

  /**
   * If online and a handler is registered, run inline and return
   * `{ status: 'committed' }`. Otherwise persist to storage and return
   * `{ status: 'queued' }`. Errors thrown by the handler propagate to
   * the caller in the online path — only failures *after* a write was
   * already persisted go into retry land.
   */
  async enqueueOrExecute<P, R>(
    type: WriteType,
    payload: P,
    meta: {
      baseId: string
      userId: string
      optimisticEntityId?: string
    },
  ): Promise<EnqueueResult<R>> {
    if (this.isOnline() && this.handlers.has(type)) {
      const handler = this.handlers.get(type) as WriteHandler<P, R>
      try {
        const data = await handler(payload)
        return { status: 'committed', data }
      } catch (err) {
        // Non-retriable / conflict errors bubble — caller decides.
        if (err instanceof NonRetriableError) throw err
        if (err instanceof ConflictError) throw err
        // Transient error after we tried online → fall through to enqueue.
        // The drain pass will retry on the next online / visibility event.
        return this.enqueue(type, payload, meta, errMessage(err))
      }
    }

    return this.enqueue(type, payload, meta, null)
  }

  private async enqueue<P>(
    type: WriteType,
    payload: P,
    meta: {
      baseId: string
      userId: string
      optimisticEntityId?: string
    },
    initialError: string | null,
  ): Promise<EnqueueResult<never>> {
    const item: QueuedWrite<P> = {
      id: this.uuid(),
      type,
      payload,
      createdAt: this.now().toISOString(),
      attempts: initialError === null ? 0 : 1,
      lastAttemptAt: initialError === null ? null : this.now().toISOString(),
      lastError: initialError,
      baseId: meta.baseId,
      userId: meta.userId,
      status: 'pending',
      optimisticEntityId: meta.optimisticEntityId,
    }
    await this.storage.put(item as QueuedWrite)
    return { status: 'queued', id: item.id }
  }

  // -------------------------------------------------------------------
  // Inspection helpers
  // -------------------------------------------------------------------

  list(): Promise<QueuedWrite[]> {
    return this.storage.list()
  }

  async pendingCount(): Promise<number> {
    const all = await this.storage.list()
    return all.filter((w) => w.status === 'pending').length
  }

  async clear(): Promise<void> {
    await this.storage.clear()
  }

  /** Manual retry for a write the user resolved via the conflict UI. */
  async resetForRetry(id: string): Promise<void> {
    const item = await this.storage.get(id)
    if (!item) return
    await this.storage.put({
      ...item,
      status: 'pending',
      attempts: 0,
      lastAttemptAt: null,
      lastError: null,
      conflictAt: undefined,
    })
  }

  /** Discard a write the user no longer wants applied. */
  async discard(id: string): Promise<void> {
    await this.storage.delete(id)
  }

  // -------------------------------------------------------------------
  // Drain
  // -------------------------------------------------------------------

  /**
   * Walk the queue oldest-first and execute pending writes whose backoff
   * window has elapsed. Single-flight: if another drain is in progress,
   * the new caller awaits the same promise.
   */
  drain(): Promise<DrainSummary> {
    if (this.draining) return this.draining
    this.draining = this.runDrain().finally(() => {
      this.draining = null
    })
    return this.draining
  }

  private async runDrain(): Promise<DrainSummary> {
    const summary: DrainSummary = {
      attempted: 0,
      committed: 0,
      retried: 0,
      failed: 0,
      conflict: 0,
      skipped: 0,
    }

    if (!this.isOnline()) return summary

    const items = await this.storage.list()
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    const nowMs = this.now().getTime()

    for (const item of items) {
      if (item.status !== 'pending') {
        summary.skipped++
        continue
      }
      if (!isReadyForRetry(item.attempts, item.lastAttemptAt, nowMs)) {
        summary.skipped++
        continue
      }
      const handler = this.handlers.get(item.type)
      if (!handler) {
        // No registered handler — leave it in the queue for a later session
        // that does register one. This keeps types safe even if a feature
        // wrap is rolled out incrementally.
        summary.skipped++
        continue
      }

      summary.attempted++
      try {
        await handler(item.payload)
        await this.storage.delete(item.id)
        summary.committed++
      } catch (err) {
        await this.recordFailure(item, err, summary)
      }
    }

    return summary
  }

  private async recordFailure(
    item: QueuedWrite,
    err: unknown,
    summary: DrainSummary,
  ): Promise<void> {
    const message = errMessage(err)
    const nextAttempts = item.attempts + 1
    const nowIso = this.now().toISOString()

    if (err instanceof ConflictError) {
      await this.storage.put({
        ...item,
        attempts: nextAttempts,
        lastAttemptAt: nowIso,
        lastError: message,
        status: 'conflict',
        conflictAt: nowIso,
      })
      summary.conflict++
      return
    }

    if (err instanceof NonRetriableError || hasExhaustedRetries(nextAttempts)) {
      await this.storage.put({
        ...item,
        attempts: nextAttempts,
        lastAttemptAt: nowIso,
        lastError: message,
        status: 'failed',
      })
      summary.failed++
      return
    }

    await this.storage.put({
      ...item,
      attempts: nextAttempts,
      lastAttemptAt: nowIso,
      lastError: message,
      status: 'pending',
    })
    summary.retried++
  }

  // -------------------------------------------------------------------
  // Browser wiring
  // -------------------------------------------------------------------

  /**
   * Subscribe to `online` and `visibilitychange` and trigger drains.
   * Returns an unsubscriber for cleanup. Safe to call in SSR (no-op).
   */
  attach(): () => void {
    if (typeof window === 'undefined') return () => {}

    const onOnline = () => {
      void this.drain()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void this.drain()
    }

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }
}

// Re-export the cap so UI surfaces ("Retry in N seconds") can use it
// without pulling in backoff.ts directly.
export { nextRetryDelayMs }

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

// ---------------------------------------------------------------------------
// Singleton accessor
// ---------------------------------------------------------------------------

let singleton: WriteQueue | null = null

/**
 * Lazy singleton used by the app at runtime. Tests should construct
 * their own `new WriteQueue({ storage: new MemoryStorage(), ... })`
 * instead of touching this.
 */
export function getWriteQueue(): WriteQueue {
  if (!singleton) singleton = new WriteQueue()
  return singleton
}

/** Test-only: reset the singleton so each test gets a fresh queue. */
export function _resetWriteQueueForTests(): void {
  singleton = null
}
