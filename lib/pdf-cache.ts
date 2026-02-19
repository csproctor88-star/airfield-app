const DB_NAME = 'airfield-pdf-cache'
const STORE_NAME = 'pdfs'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Retrieve a cached PDF blob by key (reg_id). Returns null on miss. */
export async function getCachedPdf(key: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/** Store a PDF blob in the cache, keyed by reg_id. */
export async function cachePdf(key: string, data: ArrayBuffer): Promise<void> {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.put(data, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Silently fail — cache is best-effort
  }
}

/** Remove a single cached PDF. */
export async function removeCachedPdf(key: string): Promise<void> {
  try {
    const db = await openDb()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    })
  } catch {
    // ignore
  }
}
