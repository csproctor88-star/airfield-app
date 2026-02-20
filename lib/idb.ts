/**
 * Shared IndexedDB helpers for the AOMS PDF cache.
 * Used by both PDFLibrary (blob cache) and pdfTextCache (text index).
 */

const DB_NAME = 'aoms_pdf_cache'
const DB_VERSION = 4

export const STORE_BLOBS = 'blobs'
export const STORE_META = 'meta'
export const STORE_TEXT = 'text_pages'
export const STORE_TEXT_META = 'text_meta'
export const STORE_USER_BLOBS = 'user_blobs'
export const STORE_USER_TEXT = 'user_text'

let dbPromise: Promise<IDBDatabase> | null = null

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_BLOBS)) db.createObjectStore(STORE_BLOBS)
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META)
      if (!db.objectStoreNames.contains(STORE_TEXT)) db.createObjectStore(STORE_TEXT)
      if (!db.objectStoreNames.contains(STORE_TEXT_META)) db.createObjectStore(STORE_TEXT_META)
      if (!db.objectStoreNames.contains(STORE_USER_BLOBS)) db.createObjectStore(STORE_USER_BLOBS)
      if (!db.objectStoreNames.contains(STORE_USER_TEXT)) db.createObjectStore(STORE_USER_TEXT)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })

  return dbPromise
}

export async function idbSet(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbGet<T = unknown>(store: string, key: string): Promise<T | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve((req.result as T) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGetAllKeys(store: string): Promise<IDBValidKey[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAllKeys()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGetAll<T = unknown>(store: string): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

export async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbClear(stores: string[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite')
    for (const s of stores) tx.objectStore(s).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
