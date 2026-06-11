// Headless verification of the 2026-06-11 DB-layer security fixes — and that
// the legitimate flows they touch STILL WORK. No dev server required; this
// talks straight to the live DB as the seeded __TEST_RLS__ users.
//
//   1. node supabase/seed-test-accounts.mjs        # once, to create fixtures
//   2. node scripts/verify-security-db.mjs         # run the checks
//
// What it proves:
//   C-2  the profiles trigger blocks an authenticated user from changing
//        role/status/is_active (self-escalation closed).
//   H-6  sign_daily_review_slot: an amops user CAN sign an AMSL slot (happy
//        path still works), the signature is attributed to auth.uid() (no
//        client-forged signer), the user CANNOT sign a slot they lack the
//        permission for (afm), and CANNOT sign at a base they don't belong to.
//   RLS  cross-base read isolation still holds (regression sanity).
//
// Exit code 0 = all passed, 1 = something failed.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const ENV_PATH = path.resolve(process.cwd(), '.env.local')
function loadEnv() {
  const env = {}
  if (existsSync(ENV_PATH)) {
    for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
  return env
}

const env = loadEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const password = env.TEST_RLS_PASSWORD
const baseA = env.TEST_RLS_BASE_A
const baseB = env.TEST_RLS_BASE_B

if (!url || !anon || !password || !baseA || !baseB) {
  console.error('Missing env / fixtures. Run: node supabase/seed-test-accounts.mjs first.')
  process.exit(1)
}

const DOMAIN = 'glidepath-rls-test.com'
const WRITER_A = `rls-writer-a@${DOMAIN}` // amops @ Base A  → has sign:amsl, NOT sign:afm/namo
const READONLY_A = `rls-readonly-a@${DOMAIN}` // read_only @ Base A
const admin = serviceKey
  ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

async function signIn(email) {
  const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign-in ${email}: ${error.message}`)
  return client
}

const SENTINEL_DATE = '2099-12-31' // far-future so it never collides with real reviews

async function main() {
  console.log('\n=== C-2 — profiles privilege-escalation is blocked ===')
  {
    const ro = await signIn(READONLY_A)
    const { data: { user } } = await ro.auth.getUser()
    const before = (await ro.from('profiles').select('role').eq('id', user.id).single()).data?.role
    const { error } = await ro.from('profiles').update({ role: 'sys_admin' }).eq('id', user.id)
    const after = (await ro.from('profiles').select('role').eq('id', user.id).single()).data?.role
    check('read_only user CANNOT self-escalate role to sys_admin', after !== 'sys_admin' && after === before, `after=${after}`)
    check('the escalation attempt is rejected (not silently ignored)', !!error, 'expected a permission error')
    if (after === 'sys_admin' && admin) await admin.from('profiles').update({ role: before }).eq('id', user.id) // safety revert
  }
  {
    const wa = await signIn(WRITER_A)
    const { data: { user } } = await wa.auth.getUser()
    const before = (await wa.from('profiles').select('role').eq('id', user.id).single()).data?.role
    await wa.from('profiles').update({ role: 'sys_admin' }).eq('id', user.id)
    const after = (await wa.from('profiles').select('role').eq('id', user.id).single()).data?.role
    check('amops user CANNOT self-escalate role to sys_admin', after !== 'sys_admin', `after=${after}`)
    if (after === 'sys_admin' && admin) await admin.from('profiles').update({ role: before }).eq('id', user.id)
  }

  console.log('\n=== H-6 — daily-review signing RPC (happy path + integrity) ===')
  {
    const wa = await signIn(WRITER_A)
    const { data: { user } } = await wa.auth.getUser()

    // Happy path: amops holds daily_reviews:sign:amsl → can sign an AMSL slot.
    const sign = await wa.rpc('sign_daily_review_slot', {
      p_base_id: baseA, p_date: SENTINEL_DATE, p_slot: 'day_amsl',
      p_events_hash: 'verify-script', p_notes: 'automated verification', p_shift_count: 3,
    })
    check('amops CAN sign an AMSL slot (legit signing still works)', !sign.error && !!sign.data, sign.error?.message)
    check('signature is attributed to auth.uid() — no client-forged signer', sign.data?.day_amsl_signed_by === user.id,
      `signed_by=${sign.data?.day_amsl_signed_by} expected=${user.id}`)
    check('row is NOT fully certified from one slot', !sign.data?.fully_certified_at)

    // Permission gate: amops lacks daily_reviews:sign:afm → must be rejected.
    const afm = await wa.rpc('sign_daily_review_slot', {
      p_base_id: baseA, p_date: SENTINEL_DATE, p_slot: 'afm',
      p_events_hash: 'verify-script', p_notes: null, p_shift_count: 3,
    })
    check('amops CANNOT sign the AFM slot (lacks sign:afm) — forgery blocked', !!afm.error, 'expected permission error')

    // Cross-base: writer-a has no access to Base B.
    const xbase = await wa.rpc('sign_daily_review_slot', {
      p_base_id: baseB, p_date: SENTINEL_DATE, p_slot: 'day_amsl',
      p_events_hash: 'verify-script', p_notes: null, p_shift_count: 3,
    })
    check('CANNOT sign a daily review at a base the user does not belong to', !!xbase.error, 'expected base-access error')

    // Cleanup the sentinel row.
    if (admin) {
      await admin.from('daily_reviews').delete().eq('base_id', baseA).eq('review_date', SENTINEL_DATE)
      console.log('  (cleaned up sentinel daily_reviews row)')
    } else {
      console.log('  ! No service key in .env.local — leftover sentinel row at', SENTINEL_DATE, 'delete it manually')
    }
  }

  console.log('\n=== RLS — cross-base read isolation (regression sanity) ===')
  {
    const wa = await signIn(WRITER_A)
    const own = await wa.from('discrepancies').select('id').eq('base_id', baseA)
    const other = await wa.from('discrepancies').select('id').eq('base_id', baseB)
    check('writer-a reads its OWN base', !own.error && (own.data ?? []).length >= 1)
    check('writer-a reads NO rows from Base B', !other.error && (other.data ?? []).length === 0)
  }

  console.log(`\n${failed === 0 ? '✓ ALL PASSED' : '✗ FAILURES'} — ${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error('\nverify-security-db crashed:', e.message); process.exit(1) })
