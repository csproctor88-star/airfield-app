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

/**
 * Window event fired after a queued write commits via drain. Feature
 * pages listen for this to re-fetch their lists when realtime would
 * otherwise miss the change (e.g., inspection status flipping from
 * in_progress to completed via UPDATE).
 *
 * detail shape: WriteCommittedDetail
 */
export const WRITE_COMMITTED_EVENT = 'glidepath:write-committed'

export interface WriteCommittedDetail {
  type: WriteType
  id: string
  optimisticEntityId?: string
}

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
   * Returns the currently signed-in user's id (or null). When provided, the
   * queue is "user-scoped": drain, list, and counts only touch items queued by
   * that user. This prevents one user's offline writes from draining under a
   * different user's session on a shared device — which RLS rejects cross-base
   * ("no row or RLS") and would misattribute same-base. When omitted, the queue
   * is unscoped (legacy behaviour; used by unit tests).
   */
  getUserId?: () => Promise<string | null> | string | null
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
  private getUserIdFn: (() => Promise<string | null> | string | null) | null
  private readonly handlers = new Map<WriteType, WriteHandler<any, any>>()

  /** Single-flight guard so concurrent triggers don't double-drain. */
  private draining: Promise<DrainSummary> | null = null

  constructor(opts: WriteQueueOptions = {}) {
    this.storage = opts.storage ?? getDefaultStorage()
    this.isOnline = opts.isOnline ?? defaultIsOnline
    this.now = opts.now ?? (() => new Date())
    this.uuid = opts.uuid ?? defaultUuid
    this.getUserIdFn = opts.getUserId ?? null
  }

  /**
   * Wire (or replace) the current-user provider at runtime. Used by the app
   * shell to make the singleton user-scoped once a Supabase session exists.
   */
  setUserIdProvider(fn: () => Promise<string | null> | string | null): void {
    this.getUserIdFn = fn
  }

  private get userScoped(): boolean {
    return this.getUserIdFn != null
  }

  private async currentUserId(): Promise<string | null> {
    if (!this.getUserIdFn) return null
    try {
      return await this.getUserIdFn()
    } catch {
      return null
    }
  }

  /**
   * Whether a queued item belongs to the signed-in user. Unscoped queues own
   * everything (legacy/tests). Scoped queues own an item when the user is known
   * and the item's userId matches (or is absent — legacy items predating the
   * userId field, drained best-effort under the current user). When the user
   * can't be determined, nothing is owned, so no one else's writes drain.
   */
  private ownsItem(item: QueuedWrite, currentUserId: string | null): boolean {
    if (!this.userScoped) return true
    if (currentUserId == null) return false
    // An empty-string userId is treated the same as an absent one: unowned,
    // drained best-effort under the current user. Inspection-start writes were
    // briefly enqueued with userId '' — a non-null value that never equals the
    // real id, so the strict check orphaned them forever (in_progress locally,
    // nothing in the DB). Guard here so already-queued rows recover on drain.
    return !item.userId || item.userId === currentUserId
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

  async list(): Promise<QueuedWrite[]> {
    const all = await this.storage.list()
    if (!this.userScoped) return all
    const uid = await this.currentUserId()
    return all.filter((w) => this.ownsItem(w, uid))
  }

  async pendingCount(): Promise<number> {
    const mine = await this.list()
    return mine.filter((w) => w.status === 'pending').length
  }

  /**
   * Count of items that have hit a terminal failure ('failed') or are
   * blocked on user action ('conflict'). These do not count toward the
   * pending pill — they need a Retry or Discard from the inspector.
   */
  async needsAttentionCount(): Promise<number> {
    const mine = await this.list()
    return mine.filter((w) => w.status === 'failed' || w.status === 'conflict').length
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
    // Resolve once per drain: only the signed-in user's writes are eligible.
    // Another user's items stay queued (untouched) until that user returns.
    const currentUserId = this.userScoped ? await this.currentUserId() : null

    for (const item of items) {
      if (item.status !== 'pending') {
        summary.skipped++
        continue
      }
      if (!this.ownsItem(item, currentUserId)) {
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
        // Fire a window event so feature pages can re-fetch their lists.
        // Realtime only fires on INSERT for inspections / checks, so an
        // UPDATE arriving via a queue drain wouldn't otherwise be visible
        // until the user manually refreshes.
        this.dispatchCommitted(item)
      } catch (err) {
        await this.recordFailure(item, err, summary)
      }
    }

    return summary
  }

  private dispatchCommitted(item: QueuedWrite): void {
    if (typeof window === 'undefined') return
    try {
      window.dispatchEvent(
        new CustomEvent(WRITE_COMMITTED_EVENT, {
          detail: {
            type: item.type,
            id: item.id,
            optimisticEntityId: item.optimisticEntityId,
          },
        }),
      )
    } catch {
      // CustomEvent may not be available in some test runners; safe no-op.
    }
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
