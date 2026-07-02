// app/api/flip-file/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Authenticated file proxy for the `flip` storage bucket.
//
// Callers point fetch at /api/flip-file?path=<storage_path>. This route
// streams the object using the caller's RLS-scoped session client — so the
// storage.objects SELECT policy decides what each user can read. No
// service-role bypass: a user can only read flip files for bases they belong
// to, with no public URL and an authenticated request on every fetch.
//
// storage_path is the bare path (no bucket prefix), exactly as stored in the
// flip_attachments table.

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const path = new URL(request.url).searchParams.get('path')
  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase.storage.from('flip').download(path)
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
