import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Authenticated image proxy for the `photos` storage bucket (H-5).
//
// Once the bucket is private (migration 2026062015), public URLs stop working
// and reads must be authorized. Rather than thread async signed-URL plumbing
// (and short-lived URLs) through every PDF generator and gallery, callers point
// <img>/fetch at /api/photos?path=<storage_path>. This route streams the object
// using the CALLER's RLS-scoped session client — so the storage.objects SELECT
// policy (base-scoped) decides what each user can read. No service-role bypass:
// a user can only read photos for bases they belong to, with no public URL and
// an authenticated request on every fetch.
//
// storage_path is the bare path (no bucket prefix), exactly as stored in the
// photos table. data: URLs are never proxied (callers pass them through inline).

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const path = new URL(request.url).searchParams.get('path')
  if (!path || path.startsWith('data:')) {
    return NextResponse.json({ error: 'Missing or invalid path' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Download via the caller's client — storage RLS (photos_select_path_scoped)
  // confines this to bases the user belongs to. A path they can't see returns
  // an error, which we surface as 404 (no existence oracle).
  const { data, error } = await supabase.storage.from('photos').download(path)
  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const buf = await data.arrayBuffer()
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': data.type || 'application/octet-stream',
      // Private, per-user content — never cache in a shared/CDN cache.
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
