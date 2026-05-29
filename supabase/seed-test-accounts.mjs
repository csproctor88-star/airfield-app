// Seed clearly-marked test bases + users for the cross-base RLS isolation test
// (tests/rls-cross-base-isolation.test.ts). Idempotent — safe to re-run.
//
//   node supabase/seed-test-accounts.mjs          # create / refresh
//   node supabase/seed-test-accounts.mjs --down    # remove everything it created
//
// Creates (all prefixed/clearly fake so they're obvious in the dashboard):
//   • 2 bases: "__TEST_RLS__ Base A", "__TEST_RLS__ Base B"
//   • 3 users (status=active): writer@A (amops), readonly@A (read_only), writer@B (amops)
//   • 1 discrepancy in each base (display_id __TESTRLS_*)
//
// Writes TEST_RLS_PASSWORD / TEST_RLS_BASE_A / TEST_RLS_BASE_B back into
// .env.local (gitignored) so the env-gated test can sign in. The password is
// random and never committed.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'

const ENV_PATH = path.resolve(process.cwd(), '.env.local')
const PREFIX = '__TEST_RLS__'
const DOMAIN = 'glidepath-rls-test.com'
const USERS = [
  { key: 'writerA', email: `rls-writer-a@${DOMAIN}`, role: 'amops', base: 'A' },
  { key: 'readonlyA', email: `rls-readonly-a@${DOMAIN}`, role: 'read_only', base: 'A' },
  { key: 'writerB', email: `rls-writer-b@${DOMAIN}`, role: 'amops', base: 'B' },
]

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

function upsertEnvVar(key, value) {
  let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : ''
  const re = new RegExp(`^${key}=.*$`, 'm')
  if (re.test(content)) content = content.replace(re, `${key}=${value}`)
  else content += (content === '' || content.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`
  writeFileSync(ENV_PATH, content)
}

const env = loadEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const DOWN = process.argv.includes('--down')

async function profileIdByEmail(email) {
  const { data } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  return data?.id ?? null
}

async function baseIdByName(name) {
  const { data } = await admin.from('bases').select('id').eq('name', name).maybeSingle()
  return data?.id ?? null
}

async function down() {
  // Delete users first (profiles + base_members cascade via FK on auth user delete).
  for (const u of USERS) {
    const id = await profileIdByEmail(u.email)
    if (id) { await admin.auth.admin.deleteUser(id); console.log(`deleted user ${u.email}`) }
  }
  for (const label of ['A', 'B']) {
    const id = await baseIdByName(`${PREFIX} Base ${label}`)
    if (id) {
      await admin.from('discrepancies').delete().eq('base_id', id)
      await admin.from('bases').delete().eq('id', id)
      console.log(`deleted base ${label}`)
    }
  }
  console.log('teardown complete')
}

async function up() {
  const password = env.TEST_RLS_PASSWORD || ('Tr1!' + randomBytes(18).toString('base64url'))

  // Bases
  const baseIds = {}
  for (const label of ['A', 'B']) {
    const name = `${PREFIX} Base ${label}`
    let id = await baseIdByName(name)
    if (!id) {
      const { data, error } = await admin.from('bases').insert({ name }).select('id').single()
      if (error) throw new Error(`base ${label}: ${error.message}`)
      id = data.id
    }
    baseIds[label] = id
    console.log(`base ${label}: ${id}`)
  }

  // Users
  for (const u of USERS) {
    const baseId = baseIds[u.base]
    let id = await profileIdByEmail(u.email)
    if (id) {
      await admin.auth.admin.updateUserById(id, { password })
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password,
        email_confirm: true,
        user_metadata: { name: `RLS Test ${u.key}`, role: u.role, primary_base_id: baseId },
      })
      if (error) throw new Error(`user ${u.email}: ${error.message}`)
      id = data.user.id
    }
    // Force role/status/base regardless of what the trigger did (idempotent).
    await admin.from('profiles').update({ role: u.role, status: 'active', primary_base_id: baseId }).eq('id', id)
    await admin.from('base_members').upsert({ base_id: baseId, user_id: id, role: u.role }, { onConflict: 'base_id,user_id' })
    console.log(`user ${u.email} (${u.role}) → base ${u.base}`)
  }

  // One discrepancy per base so cross-base reads have something to (not) see.
  for (const label of ['A', 'B']) {
    const displayId = `__TESTRLS_${label}1__`
    const { data: existing } = await admin.from('discrepancies').select('id').eq('display_id', displayId).maybeSingle()
    if (!existing) {
      const { error } = await admin.from('discrepancies').insert({
        display_id: displayId,
        type: 'other',
        title: `${PREFIX} discrepancy ${label}`,
        description: 'RLS isolation fixture — safe to delete',
        location_text: 'Test',
        base_id: baseIds[label],
      })
      if (error) throw new Error(`discrepancy ${label}: ${error.message}`)
    }
  }

  upsertEnvVar('TEST_RLS_PASSWORD', password)
  upsertEnvVar('TEST_RLS_BASE_A', baseIds.A)
  upsertEnvVar('TEST_RLS_BASE_B', baseIds.B)
  console.log('\nSeed complete. TEST_RLS_PASSWORD / TEST_RLS_BASE_A / TEST_RLS_BASE_B written to .env.local.')
}

;(DOWN ? down() : up()).catch((e) => { console.error(e); process.exit(1) })
