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

  // Live mode — upload to Supabase Storage (photos bucket)
  const path = storagePath(baseId)

  // Delete existing diagram first (upsert)
  await supabase.storage.from('photos').remove([path])

  const { error } = await supabase.storage
    .from('photos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    throw new Error(`Failed to upload diagram: ${error.message}`)
  }
}

/** Get the diagram URL for a base, or null if none saved */
export async function getAirfieldDiagram(baseId: string): Promise<string | null> {
  const supabase = createClient()

  if (!supabase) {
    // Demo mode — read from IndexedDB
    return idbGet<string>(STORE_USER_BLOBS, idbKey(baseId))
  }

  // Live mode — get public URL from Supabase Storage
  const path = storagePath(baseId)

  const { data } = supabase.storage
    .from('photos')
    .getPublicUrl(path)

  if (!data?.publicUrl) return null

  // Verify the file actually exists by fetching headers
  try {
    const res = await fetch(data.publicUrl, { method: 'HEAD' })
    if (!res.ok) return null
    return data.publicUrl
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

  // Live mode — remove from Supabase Storage
  const path = storagePath(baseId)
  await supabase.storage.from('photos').remove([path])
}
