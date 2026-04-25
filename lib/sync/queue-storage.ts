/**
 * Storage backends for the write queue.
 *
 * Two implementations:
 *
 * - IndexedDBStorage  — production. Uses a dedicated DB so version bumps
 *                       don't entangle with the AOMS PDF cache (lib/idb.ts).
 * - MemoryStorage     — in-memory Map; used by unit tests so we don't need
 *                       fake-indexeddb as a devDependency.
 *
 * The interface is intentionally minimal — get / put / list / delete /
 * clear is all the queue needs. No transactions exposed; the queue
 * drains serially so concurrent writes to a single id are not possible.
 */

import type { QueuedWrite } from './types'

export interface QueueStorage {
  put(item: QueuedWrite): Promise<void>
  get(id: string): Promise<QueuedWrite | null>
  list(): Promise<QueuedWrite[]>
  delete(id: string): Promise<void>
  clear(): Promise<void>
}

// ---------------------------------------------------------------------------
// MemoryStorage
// ---------------------------------------------------------------------------

export class MemoryStorage implements QueueStorage {
  private items = new Map<string, QueuedWrite>()

  async put(item: QueuedWrite): Promise<void> {
    this.items.set(item.id, structuredClone(item))
  }

  async get(id: string): Promise<QueuedWrite | null> {
    const item = this.items.get(id)
    return item ? structuredClone(item) : null
  }

  async list(): Promise<QueuedWrite[]> {
    return Array.from(this.items.values()).map((item) => structuredClone(item))
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id)
  }

  async clear(): Promise<void> {
    this.items.clear()
  }
}

// ---------------------------------------------------------------------------
// IndexedDBStorage
// ---------------------------------------------------------------------------

const DB_NAME = 'glidepath-write-queue'
const DB_VERSION = 1
const STORE_NAME = 'queue'

let dbPromise: Promise<IDBDatabase> | null = null

function openQueueDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
        store.createIndex('userId', 'userId')
        store.createIndex('type', 'type')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })

  return dbPromise
}

export class IndexedDBStorage implements QueueStorage {
  async put(item: QueuedWrite): Promise<void> {
    const db = await openQueueDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async get(id: string): Promise<QueuedWrite | null> {
    const db = await openQueueDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(id)
      req.onsuccess = () => resolve((req.result as QueuedWrite | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async list(): Promise<QueuedWrite[]> {
    const db = await openQueueDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => resolve((req.result as QueuedWrite[]) ?? [])
      req.onerror = () => reject(req.error)
    })
  }

  async delete(id: string): Promise<void> {
    const db = await openQueueDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async clear(): Promise<void> {
    const db = await openQueueDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}

/**
 * Default storage selector. Falls back to MemoryStorage in environments
 * without IndexedDB (SSR, ancient browsers, some test runners). Calling
 * code can also pass a backend directly.
 */
export function getDefaultStorage(): QueueStorage {
  if (typeof indexedDB === 'undefined') return new MemoryStorage()
  return new IndexedDBStorage()
}
