/**
 * Airfield diagram storage — saves/retrieves diagram images per base.
 * Uses Supabase Storage (photos bucket) in live mode, IndexedDB in demo mode.
 */

import { createClient } from './supabase/client'
import { idbSet, idbGet, idbDelete, STORE_USER_BLOBS } from './idb'

const IDB_KEY_PREFIX = 'airfield-diagram-'
const STORAGE_FOLDER = 'airfield-diagrams'

function idbKey(baseId: string) {
  return `${IDB_KEY_PREFIX}${baseId}`
}

function storagePath(baseId: string) {
  return `${STORAGE_FOLDER}/${baseId}/diagram`
}

/** Convert a File to a data URL string */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Save an airfield diagram for a base */
export async function saveAirfieldDiagram(baseId: string, file: File): Promise<void> {
  const supabase = createClient()

  if (!supabase) {
    // Demo mode — save to IndexedDB
    const dataUrl = await fileToDataUrl(file)
    await idbSet(STORE_USER_BLOBS, idbKey(baseId), dataUrl)
    return
  }

  // Live mode — route through /api/admin/airfield-diagram so the upload
  // runs under the service-role client. Direct client-side uploads kept
  // tripping storage.objects RLS even for users with photos:write; the
  // server-side route uses base_setup:write (the same gate as the Base
  // Setup UI) as the authorization check.
  const form = new FormData()
  form.append('baseId', baseId)
  form.append('file', file)

  const res = await fetch('/api/admin/airfield-diagram', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`Failed to upload diagram: ${msg.error || res.statusText}`)
  }
}

/** Get the diagram URL for a base, or null if none saved */
export async function getAirfieldDiagram(baseId: string): Promise<string | null> {
  const supabase = createClient()

  if (!supabase) {
    // Demo mode — read from IndexedDB
    return idbGet<string>(STORE_USER_BLOBS, idbKey(baseId))
  }

  // Live mode — go through the admin endpoint for authoritative existence
  // + an updated_at cache-buster. The storage path is fixed per base, so
  // without a cache-buster the browser / CDN keep serving the old diagram
  // after a replace.
  try {
    const res = await fetch(
      `/api/admin/airfield-diagram?baseId=${encodeURIComponent(baseId)}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    const body = await res.json() as { publicUrl: string | null; updatedAt?: string | null }
    if (!body.publicUrl) return null
    const version = body.updatedAt ? encodeURIComponent(body.updatedAt) : Date.now().toString()
    return `${body.publicUrl}?v=${version}`
  } catch {
    return null
  }
}

/** Delete the diagram for a base */
export async function deleteAirfieldDiagram(baseId: string): Promise<void> {
  const supabase = createClient()

  if (!supabase) {
    // Demo mode — delete from IndexedDB
    await idbDelete(STORE_USER_BLOBS, idbKey(baseId))
    return
  }

  // Live mode — route through the service-role admin endpoint so the
  // delete is gated on base_setup:write rather than photos:delete.
  const res = await fetch(
    `/api/admin/airfield-diagram?baseId=${encodeURIComponent(baseId)}`,
    { method: 'DELETE' },
  )

  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`Failed to delete diagram: ${msg.error || res.statusText}`)
  }
}
