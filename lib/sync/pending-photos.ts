/**
 * Pending photo store.
 *
 * Companion to the write queue, but with different semantics: photos
 * are persisted when an inline upload can't run (offline, transient
 * failure, missing parent id) and stay in IDB until the user manually
 * confirms an upload from the queue inspector. They do *not* auto-drain
 * — that would re-introduce the idempotency / quota / iOS-Blob-in-IDB
 * concerns we deliberately scoped out (see Offline_Write_Queue_Spec
 * "middle option" decision, 2026-04-25).
 *
 * Photos are stored as `Blob` (Files survive structured-clone in IDB,
 * but `name`/`mime` are normalized into the entry so we don't depend
 * on File-specific properties surviving every iOS WebKit version).
 */

export type PendingPhotoEntityType =
  | 'inspection'
  | 'check'
  | 'acsi'
  | 'discrepancy'
  | 'wildlife'
  | 'parking'

export interface PendingPhoto {
  id: string
  entityType: PendingPhotoEntityType
  entityId: string
  blob: Blob
  filename: string
  mime: string
  /** Inspection-specific item context. Other entities ignore. */
  itemId?: string | null
  /** Per-issue index within an inspection item / check issue. */
  issueIndex?: number | null
  latitude?: number | null
  longitude?: number | null
  baseId?: string | null
  createdAt: string
}

export interface PendingPhotoStorage {
  put(item: PendingPhoto): Promise<void>
  get(id: string): Promise<PendingPhoto | null>
  list(): Promise<PendingPhoto[]>
  listForEntity(
    entityType: PendingPhotoEntityType,
    entityId: string,
  ): Promise<PendingPhoto[]>
  delete(id: string): Promise<void>
  clear(): Promise<void>
  count(): Promise<number>
}

// ---------------------------------------------------------------------------
// MemoryStorage
// ---------------------------------------------------------------------------

export class MemoryPendingPhotoStorage implements PendingPhotoStorage {
  private items = new Map<string, PendingPhoto>()

  async put(item: PendingPhoto): Promise<void> {
    // Shallow clone — Blob is intentionally NOT cloned (cloning Blobs
    // is expensive and unnecessary; the caller has handed off ownership).
    this.items.set(item.id, { ...item })
  }

  async get(id: string): Promise<PendingPhoto | null> {
    const item = this.items.get(id)
    return item ? { ...item } : null
  }

  async list(): Promise<PendingPhoto[]> {
    return Array.from(this.items.values()).map((item) => ({ ...item }))
  }

  async listForEntity(
    entityType: PendingPhotoEntityType,
    entityId: string,
  ): Promise<PendingPhoto[]> {
    return Array.from(this.items.values())
      .filter((p) => p.entityType === entityType && p.entityId === entityId)
      .map((item) => ({ ...item }))
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id)
  }

  async clear(): Promise<void> {
    this.items.clear()
  }

  async count(): Promise<number> {
    return this.items.size
  }
}

// ---------------------------------------------------------------------------
// IndexedDBStorage
// ---------------------------------------------------------------------------

const DB_NAME = 'glidepath-pending-photos'
const DB_VERSION = 1
const STORE_NAME = 'photos'

let dbPromise: Promise<IDBDatabase> | null = null

function openPhotoDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('entityType_entityId', ['entityType', 'entityId'])
        store.createIndex('createdAt', 'createdAt')
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

export class IndexedDBPendingPhotoStorage implements PendingPhotoStorage {
  async put(item: PendingPhoto): Promise<void> {
    const db = await openPhotoDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async get(id: string): Promise<PendingPhoto | null> {
    const db = await openPhotoDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(id)
      req.onsuccess = () => resolve((req.result as PendingPhoto | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async list(): Promise<PendingPhoto[]> {
    const db = await openPhotoDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => resolve((req.result as PendingPhoto[]) ?? [])
      req.onerror = () => reject(req.error)
    })
  }

  async listForEntity(
    entityType: PendingPhotoEntityType,
    entityId: string,
  ): Promise<PendingPhoto[]> {
    const db = await openPhotoDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const idx = tx.objectStore(STORE_NAME).index('entityType_entityId')
      const req = idx.getAll([entityType, entityId])
      req.onsuccess = () => resolve((req.result as PendingPhoto[]) ?? [])
      req.onerror = () => reject(req.error)
    })
  }

  async delete(id: string): Promise<void> {
    const db = await openPhotoDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async clear(): Promise<void> {
    const db = await openPhotoDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async count(): Promise<number> {
    const db = await openPhotoDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
}

// ---------------------------------------------------------------------------
// Singleton + helpers
// ---------------------------------------------------------------------------

let storage: PendingPhotoStorage | null = null

export function getPendingPhotoStorage(): PendingPhotoStorage {
  if (!storage) {
    storage = typeof indexedDB === 'undefined'
      ? new MemoryPendingPhotoStorage()
      : new IndexedDBPendingPhotoStorage()
  }
  return storage
}

/** Test-only: reset the singleton. */
export function _resetPendingPhotoStorageForTests(): void {
  storage = null
}

/**
 * Window event fired after a pending photo is added or removed (upload
 * succeeded, or user discarded). UI surfaces use this to refresh count
 * pills + the inspector list immediately rather than waiting on a poll.
 */
export const PENDING_PHOTOS_CHANGED_EVENT = 'glidepath:pending-photos-changed'

function dispatchChange(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(PENDING_PHOTOS_CHANGED_EVENT))
  } catch {
    // CustomEvent may not exist in some test runners.
  }
}

const defaultUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Persist a photo for later manual upload. Returns the assigned id so
 * the caller can correlate UI state.
 */
export async function persistPendingPhoto(input: {
  entityType: PendingPhotoEntityType
  entityId: string
  blob: Blob
  filename: string
  mime: string
  itemId?: string | null
  issueIndex?: number | null
  latitude?: number | null
  longitude?: number | null
  baseId?: string | null
}): Promise<string> {
  const id = defaultUuid()
  const item: PendingPhoto = {
    id,
    entityType: input.entityType,
    entityId: input.entityId,
    blob: input.blob,
    filename: input.filename,
    mime: input.mime,
    itemId: input.itemId ?? null,
    issueIndex: input.issueIndex ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    baseId: input.baseId ?? null,
    createdAt: new Date().toISOString(),
  }
  await getPendingPhotoStorage().put(item)
  dispatchChange()
  return id
}

/** Remove a pending photo (after a successful upload, or a discard). */
export async function deletePendingPhoto(id: string): Promise<void> {
  await getPendingPhotoStorage().delete(id)
  dispatchChange()
}
