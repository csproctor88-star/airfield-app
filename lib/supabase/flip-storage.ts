// lib/supabase/flip-storage.ts
import { createClient } from './client'

/** Authenticated proxy URL for a flip-bucket storage_path. */
export function flipFileUrl(storagePath: string): string {
  if (!storagePath) return storagePath
  return `/api/flip-file?path=${encodeURIComponent(storagePath)}`
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/**
 * Upload a file to the flip bucket under <baseId>/<kind>/<uuid>.<ext>.
 * Returns the storage path (no bucket prefix) for DB persistence.
 */
export async function uploadFlipFile(
  baseId: string, kind: 'references' | 'changes', file: File,
): Promise<{ path: string | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { path: null, error: 'Supabase not configured' }
  const ext = extOf(file.name) || 'bin'
  const path = `${baseId}/${kind}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('flip').upload(path, file)
  if (error) return { path: null, error: error.message }
  return { path, error: null }
}
