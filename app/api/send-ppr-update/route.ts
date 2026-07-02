export const maxDuration = 15

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { formatPprColumnValue } from '@/lib/supabase/ppr'
import { notifyCoordinatingAgencies } from '@/lib/ppr-agency-notify'
import { callerCanActOnPpr, PPR_EMAIL_PERMS } from '@/lib/ppr-authorize'
import { checkRateLimits } from '@/lib/rate-limit'
import type { PprChange } from '@/lib/ppr-changes'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

/**
 * PPR "updated" notification — informational. When AMOPS edits a PPR after
 * coordinating agencies have coordinated, this emails the AMOPS-selected
 * agencies the change summary + current details so they have the latest info.
 * It is NOT a re-coordination and does not change any status.
 *
 * Authenticated route. Body: { entryId, agencyIds, changes }. `changes` is the
 * client-computed before→after diff (the client has the pre-edit values);
 * current details are rebuilt here from the authoritative entry. Recipients are
 * scoped to `agencyIds` (the dialog's selection). Reuses notifyCoordinatingAgencies.
 */
export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Server not configured — RESEND_API_KEY missing' }, { status: 500 })
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const cookieStore = await cookies()
    const sb = createServerClient(url, anonKey, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    })
    const { data: { user } } = await sb.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as {
      entryId?: string
      agencyIds?: string[]
      changes?: PprChange[]
    }
    const { entryId } = body
    const agencyIds = Array.isArray(body.agencyIds) ? body.agencyIds.filter((id) => typeof id === 'string') : []
    if (!entryId) {
      return NextResponse.json({ error: 'Missing entryId' }, { status: 400 })
    }
    if (agencyIds.length === 0) {
      return NextResponse.json({ error: 'No agencies selected' }, { status: 400 })
    }
    // Sanitize the client-supplied change summary into plain strings.
    const changes: PprChange[] = Array.isArray(body.changes)
      ? body.changes
          .filter((c) => c && typeof c === 'object')
          .map((c) => ({ label: String(c.label ?? ''), from: String(c.from ?? ''), to: String(c.to ?? '') }))
      : []

    const reader = serviceKey ? createServiceClient(url, serviceKey) : sb
    const { data: entry, error: entryErr } = await reader
      .from('ppr_entries')
      .select('id, base_id, ppr_number, requester_name, arrival_date, column_values, notes')
      .eq('id', entryId)
      .single<{
        id: string
        base_id: string
        ppr_number: string
        requester_name: string | null
        arrival_date: string
        column_values: Record<string, string> | null
        notes: string | null
      }>()

    if (entryErr || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // AUTHORIZATION (H-1): entry read via service role (RLS bypass) — gate on
    // ppr:write (the edit action's permission) plus base access. Also stops
    // the attacker-supplied `changes` summary from being injected into an
    // outbound "{Base} AMOPS" email by an unauthorized account.
    const authorized = await callerCanActOnPpr(reader, user.id, entry.base_id, PPR_EMAIL_PERMS.update)
    if (!authorized) {
      return NextResponse.json({ error: 'You do not have permission to send this PPR notification.' }, { status: 403 })
    }
    const withinLimits = await checkRateLimits(reader, [
      { bucket: `ppr-email:user:${user.id}`, max: 60, windowSeconds: 300 },
      { bucket: `ppr-email:entry:${entry.id}`, max: 12, windowSeconds: 3600 },
    ])
    if (!withinLimits) {
      return NextResponse.json({ error: 'Too many PPR notifications sent — please wait a moment and try again.' }, { status: 429 })
    }

    const { data: base } = await reader
      .from('bases')
      .select('name, amops_email')
      .eq('id', entry.base_id)
      .single<{ name: string; amops_email: string | null }>()

    if (!base) {
      return NextResponse.json({ error: 'Base not found' }, { status: 404 })
    }

    // Build the full current request details from the authoritative entry —
    // every non-empty, non-info column plus notes.
    const { data: columns } = await reader
      .from('ppr_columns')
      .select('id, column_name, column_type, time_display, info_text, sort_order')
      .eq('base_id', entry.base_id)
      .order('sort_order', { ascending: true })

    const colRows =
      ((columns ?? []) as {
        id: string
        column_name: string
        column_type: string
        time_display: 'zulu' | 'local' | null
        info_text: string | null
        sort_order: number
      }[]) || []

    const currentDetails: { label: string; value: string }[] = []
    for (const c of colRows) {
      if (c.column_type === 'info_only') continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = formatPprColumnValue(c as any, (entry.column_values || {})[c.id])
      if (v) currentDetails.push({ label: c.column_name, value: v })
    }
    if (entry.notes && entry.notes.trim()) {
      currentDetails.push({ label: 'Notes', value: entry.notes.trim() })
    }

    const result = await notifyCoordinatingAgencies({
      reader,
      resend: getResend(),
      entry: {
        id: entry.id,
        base_id: entry.base_id,
        ppr_number: entry.ppr_number,
        arrival_date: entry.arrival_date,
        requester_name: entry.requester_name,
      },
      base: { name: base.name, amops_email: base.amops_email },
      outcome: 'updated',
      changes,
      currentDetails,
      agencyIds,
    })

    return NextResponse.json({ success: true, agencies: result })
  } catch (err) {
    console.error('[send-ppr-update] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
