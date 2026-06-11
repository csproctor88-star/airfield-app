import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/admin/role-checks'
import { photoUrl } from '@/lib/supabase/photos'

// Upload / delete the airfield diagram for a base.
//
// POST   /api/admin/airfield-diagram   (multipart: baseId, file)  → uploads, overwrites
// DELETE /api/admin/airfield-diagram?baseId=…                     → removes
//
// Uses the service-role client for the storage write, which bypasses the
// per-path RLS on storage.objects. Without this route, users were hitting
// "new row violates row-level security policy" even with photos:write in
// their matrix — too many failure modes tucked inside storage RLS. Gating
// here on the higher-level base_setup:write permission matches how the UI
// is gated (Base Setup → Airfield Diagram tab).

const STORAGE_FOLDER = 'airfield-diagrams'
// PNG/JPG only — PDFs don't render in the UI <img> preview and jsPDF's
// addImage can't embed them in downstream exports (inspection/check
// reports etc.), so disallow at the API layer to keep uploads from
// silently ending up in a broken state.
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg'])
// 4 MB — Vercel's serverless body limit is 4.5 MB and the client resizes
// to ~1 MB first, so this mostly just serves as a defensive upper bound.
const MAX_BYTES = 4 * 1024 * 1024

function storagePath(baseId: string): string {
  return `${STORAGE_FOLDER}/${baseId}/diagram`
}

async function authorize(baseId: string) {
  const admin = getAdminClient()
  if (!admin) return { error: 'Service not configured', status: 500 as const }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { error: 'Service not configured', status: 500 as const }

  const cookieStore = cookies()
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const { data: hasPerm, error: permErr } = await admin.rpc(
    'user_has_permission',
    { p_user_id: user.id, p_key: 'base_setup:write' },
  )
  if (permErr) {
    return { error: `Permission check failed: ${permErr.message}`, status: 500 as const }
  }
  if (!hasPerm) {
    return { error: 'Forbidden — base_setup:write required', status: 403 as const }
  }

  // Sys admins may manage any base; everyone else must be a member.
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'sys_admin') {
    const { data: membership } = await admin
      .from('base_members')
      .select('base_id')
      .eq('user_id', user.id)
      .eq('base_id', baseId)
      .maybeSingle()

    if (!membership) {
      return { error: 'Forbidden — not a member of this base', status: 403 as const }
    }
  }

  return { admin }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const baseId = form.get('baseId')
    const file = form.get('file')

    if (typeof baseId !== 'string' || !baseId) {
      return NextResponse.json({ error: 'baseId is required' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type (${file.type || 'unknown'}). Use PNG or JPG.` },
        { status: 400 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 4 MB.` },
        { status: 400 },
      )
    }

    const auth = await authorize(baseId)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const path = storagePath(baseId)
    const bytes = new Uint8Array(await file.arrayBuffer())

    // Explicit delete-then-upload instead of upsert: true. Service role
    // bypasses RLS on both, and this avoids upsert edge cases where the
    // existing object's owner metadata (set to the user who first uploaded)
    // conflicts with a subsequent service-role update. remove() returns
    // successfully even when the object doesn't exist, so this is safe
    // for the first-ever upload too.
    const { error: removeErr } = await auth.admin.storage
      .from('photos')
      .remove([path])
    if (removeErr) {
      // Log but don't fail — on a first-time upload the object genuinely
      // doesn't exist, and some SDK versions surface that as an error.
      console.warn('[airfield-diagram] pre-upload remove non-fatal:', removeErr.message)
    }

    const { error } = await auth.admin.storage
      .from('photos')
      .upload(path, bytes, {
        contentType: file.type,
        cacheControl: '0',
      })

    if (error) {
      console.error('[airfield-diagram] upload failed:', {
        message: error.message,
        name: (error as { name?: string }).name,
        baseId,
        fileType: file.type,
        fileSize: file.size,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, publicUrl: photoUrl(path) })
  } catch (err) {
    console.error('[airfield-diagram] POST error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}

// GET /api/admin/airfield-diagram?baseId=…
// Authoritative existence + cache-busting metadata for the client. Returns
// { publicUrl, updatedAt } or { publicUrl: null } if no diagram exists. The
// service-role list() sidesteps CDN cache and any storage.objects SELECT
// policy gaps. Requires auth — doesn't leak which bases have diagrams to
// anonymous probes, but doesn't require base_setup:write since any
// authenticated user at any base may legitimately view a diagram.
export async function GET(request: Request) {
  try {
    const baseId = new URL(request.url).searchParams.get('baseId')
    if (!baseId) {
      return NextResponse.json({ error: 'baseId is required' }, { status: 400 })
    }

    const admin = getAdminClient()
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!admin || !envUrl || !envKey) {
      return NextResponse.json({ error: 'Service not configured' }, { status: 500 })
    }

    const cookieStore = cookies()
    const supabase = createServerClient(envUrl, envKey, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const folder = `${STORAGE_FOLDER}/${baseId}`
    const { data: files, error: listErr } = await admin.storage
      .from('photos')
      .list(folder)

    if (listErr) {
      console.error('[airfield-diagram] list failed:', listErr)
      return NextResponse.json({ error: listErr.message }, { status: 500 })
    }

    const entry = files?.find(f => f.name === 'diagram')
    if (!entry) return NextResponse.json({ publicUrl: null })

    // updated_at isn't always populated on newly-created objects; fall back
    // to created_at, then to 'now' so the URL still cache-busts on first
    // fetch.
    const version = entry.updated_at || entry.created_at || new Date().toISOString()
    return NextResponse.json({
      publicUrl: photoUrl(storagePath(baseId)),
      updatedAt: version,
    })
  } catch (err) {
    console.error('[airfield-diagram] GET error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const baseId = new URL(request.url).searchParams.get('baseId')
    if (!baseId) {
      return NextResponse.json({ error: 'baseId is required' }, { status: 400 })
    }

    const auth = await authorize(baseId)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { error } = await auth.admin.storage
      .from('photos')
      .remove([storagePath(baseId)])

    if (error) {
      console.error('[airfield-diagram] delete failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[airfield-diagram] DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
