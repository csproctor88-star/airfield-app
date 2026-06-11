// Photos storage helper — resolve a photos-bucket storage_path to a fetchable
// URL. storage_path is stored WITHOUT the bucket prefix (see project memory).
//
// H-5: the bucket is being made private (migration 2026062015), so we no longer
// hand out public URLs. Instead every read goes through the authenticated proxy
// at /api/photos, which streams the object via the caller's RLS-scoped session
// (base-scoped by the storage SELECT policy). photoUrl() stays SYNCHRONOUS so
// no call site needs async plumbing, and the URL is stable (no expiry), so
// helpers that persist/return a URL keep working. data: URLs (inline upload
// fallback) pass straight through.

/** Authenticated proxy URL for a photos-bucket storage_path. */
export function photoUrl(storagePath: string): string {
  if (!storagePath) return storagePath
  if (storagePath.startsWith('data:')) return storagePath
  return `/api/photos?path=${encodeURIComponent(storagePath)}`
}

/**
 * @deprecated Name kept for back-compat. No longer a Supabase public URL — it
 * now returns the authenticated /api/photos proxy URL (H-5). Prefer photoUrl().
 */
export function getPublicUrl(storagePath: string): string {
  return photoUrl(storagePath)
}
