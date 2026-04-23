/**
 * Demo Role Accounts — Supabase Seed Script
 * ==========================================
 * Creates one demo account per P2.1 role for video walkthroughs on
 * Demo AFB (name='Demo AFB', icao='KDMO'). Idempotent — re-running only
 * updates role + base_members; existing auth rows are reused.
 *
 * Prerequisites:
 *   1. `supabase/seed-demo-base.sql` has been run (Demo AFB exists).
 *   2. `.env.local` has the current SUPABASE_SERVICE_ROLE_KEY (sb_secret_*).
 *
 * Usage:
 *   npx tsx scripts/seed-demo-role-users.ts               # Apply
 *   npx tsx scripts/seed-demo-role-users.ts --dry-run     # Preview
 *
 * Login flow after running:
 *   /login?demo=safety
 *   /login?demo=ppr
 *   /login?demo=majcom_rfm
 *   /login?demo=airfield_status
 * Password for all demo accounts: DemoGlidepath2026!
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

// ── Load .env.local into process.env (Node has no built-in loader) ──
const envPath = path.resolve(__dirname, '../.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const dryRun = process.argv.includes('--dry-run')
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_PASSWORD = 'DemoGlidepath2026!'

// Role → demo user spec. Keep email consistent with login page roleMap.
const ROLE_USERS: Array<{
  role: 'safety' | 'ppr' | 'majcom_rfm' | 'airfield_status'
  email: string
  name: string
  rank: string | null
}> = [
  { role: 'safety',          email: 'safety@demo.glidepathops.com',   name: 'Safety Demo',   rank: 'TSgt' },
  { role: 'ppr',             email: 'ppr@demo.glidepathops.com',      name: 'PPR Demo',      rank: 'SSgt' },
  { role: 'majcom_rfm',      email: 'majcom@demo.glidepathops.com',   name: 'MAJCOM Demo',   rank: 'Maj' },
  { role: 'airfield_status', email: 'kiosk@demo.glidepathops.com',    name: 'Airfield Status Kiosk', rank: null },
]

async function findOrCreateAuthUser(email: string, password: string): Promise<string | null> {
  // listUsers pages through auth.users; for our low-volume demo setup
  // we can filter client-side.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) { console.error('listUsers failed:', listErr.message); return null }
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (existing) return existing.id

  if (dryRun) {
    console.log(`  [dry-run] would create auth user ${email}`)
    return 'dry-run-placeholder-id'
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) { console.error(`  createUser ${email} failed:`, error?.message); return null }
  return data.user.id
}

async function main() {
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Seeding demo role accounts on Demo AFB...`)

  // Resolve Demo AFB id
  const { data: bases, error: baseErr } = await admin
    .from('bases')
    .select('id, name')
    .eq('name', 'Demo AFB')
    .limit(1)
  if (baseErr) { console.error('Failed to look up Demo AFB:', baseErr.message); process.exit(1) }
  if (!bases || bases.length === 0) {
    console.error('Demo AFB not found. Run supabase/seed-demo-base.sql first.')
    process.exit(1)
  }
  const demoBaseId = bases[0].id
  console.log(`  Demo AFB id: ${demoBaseId}`)

  for (const spec of ROLE_USERS) {
    console.log(`\n→ ${spec.role} (${spec.email})`)

    const userId = await findOrCreateAuthUser(spec.email, DEMO_PASSWORD)
    if (!userId) { console.error('  skipped — auth provisioning failed'); continue }

    if (dryRun) {
      console.log(`  [dry-run] would upsert profile with role=${spec.role}, primary_base_id=${demoBaseId}`)
      console.log(`  [dry-run] would insert base_members(${demoBaseId}, ${userId}, ${spec.role})`)
      continue
    }

    // Upsert profile (row may already exist from a signup trigger).
    const { error: profErr } = await admin
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: spec.email,
          name: spec.name,
          rank: spec.rank,
          role: spec.role,
          primary_base_id: demoBaseId,
          status: 'active',
        },
        { onConflict: 'id' },
      )
    if (profErr) { console.error('  profile upsert failed:', profErr.message); continue }

    // Ensure base_members row on Demo AFB. For majcom_rfm we can add
    // more memberships post-seed if the walkthrough needs them.
    await admin.from('base_members').delete().eq('user_id', userId).eq('base_id', demoBaseId)
    const { error: memErr } = await admin
      .from('base_members')
      .insert({ base_id: demoBaseId, user_id: userId, role: spec.role })
    if (memErr) { console.error('  base_members insert failed:', memErr.message); continue }

    console.log(`  ✓ ready — login via /login?demo=${spec.role}`)
  }

  console.log(`\n${dryRun ? '[DRY RUN] no changes applied' : 'Done.'}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
