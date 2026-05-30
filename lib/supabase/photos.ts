// Photos storage helper — resolve a photos-bucket storage_path to a public URL.
// storage_path is stored WITHOUT the bucket prefix (see project memory), so the
// caller passes the bare path and gets back a fetchable URL.
import { createClient } from './client'

/** Public URL for a photos-bucket storage_path. Falls back to the raw path. */
export function getPublicUrl(storagePath: string): string {
  const supabase = createClient()
  if (!supabase) return storagePath
  const { data } = supabase.storage.from('photos').getPublicUrl(storagePath)
  return data?.publicUrl || storagePath
}
