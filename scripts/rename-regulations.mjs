/**
 * AOMS: Rename Regulation PDFs in Supabase Storage
 * 
 * Standardizes all filenames to: lowercase, hyphens only, no underscores.
 * Uses Supabase Storage .move() API — no re-upload needed.
 *
 * USAGE:
 *   1. Install dependency: npm install @supabase/supabase-js
 *   2. Set your env vars (or paste values directly below)
 *   3. Run: node rename-regulations.mjs
 *
 *   OR paste into Supabase SQL Editor won't work — this uses the Storage API.
 *   OR run in browser console on your deployed app (adjust imports).
 */

import { createClient } from '@supabase/supabase-js'

// ─── Config — use SERVICE ROLE key (not anon) for storage admin ───
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY'
const BUCKET = 'regulation-pdfs'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Explicit rename mapping (old → new) ─────────────────────
// Every file accounted for. Files already correct are included
// but will be skipped automatically.

const RENAMES = [
  // 14 CFR series — fix concatenated "cfrpart" and mixed case
  ['14_cfrpart121.pdf',         '14-cfr-part-121.pdf'],
  ['14_cfrpart139.pdf',         '14-cfr-part-139.pdf'],
  ['14_CFRPart171.pdf',         '14-cfr-part-171.pdf'],
  ['14_cfrpart380.pdf',         '14-cfr-part-380.pdf'],
  ['14_cfrpart5.pdf',           '14-cfr-part-5.pdf'],
  ['14_cfrpart77.pdf',          '14-cfr-part-77.pdf'],
  ['14-cfr-part-11.pdf',        '14-cfr-part-11.pdf'],       // already correct
  ['49_cfr830.pdf',             '49-cfr-830.pdf'],

  // AFH
  ['afh_32-7084.pdf',           'afh-32-7084.pdf'],

  // AFI series
  ['afi_10-1001.pdf',           'afi-10-1001.pdf'],
  ['afi_10-1002.pdf',           'afi-10-1002.pdf'],
  ['afi_10-1801.pdf',           'afi-10-1801.pdf'],
  ['afi_10-2501.pdf',           'afi-10-2501.pdf'],
  ['afi_10-401.pdf',            'afi-10-401.pdf'],
  ['afi_11-208.pdf',            'afi-11-208.pdf'],
  ['afi_17-221.pdf',            'afi-17-221.pdf'],
  ['afi_32-1041.pdf',           'afi-32-1041.pdf'],
  ['afi_33-322.pdf',            'afi-33-322.pdf'],
  ['afi_33-332.pdf',            'afi-33-332.pdf'],
  ['afi_36-129.pdf',            'afi-36-129.pdf'],
  ['afi_36-2101.pdf',           'afi-36-2101.pdf'],
  ['afi_36-2110.pdf',           'afi-36-2110.pdf'],
  ['afi_36-2619.pdf',           'afi-36-2619.pdf'],
  ['afi_36-2670.pdf',           'afi-36-2670.pdf'],
  ['afi_36-701.pdf',            'afi-36-701.pdf'],
  ['afi_38-402.pdf',            'afi-38-402.pdf'],
  ['afi_51-403.pdf',            'afi-51-403.pdf'],

  // AFMAN series
  ['afman_11-202_vol_3.pdf',    'afman-11-202-vol-3.pdf'],
  ['afman_11-230.pdf',          'afman-11-230.pdf'],
  ['afman_11-502.pdf',          'afman-11-502.pdf'],
  ['afman_91-223.pdf',          'afman-91-223.pdf'],

  // AFPD
  ['afpd_13-2.pdf',             'afpd-13-2.pdf'],

  // DAFI series
  ['dafi_13-213.pdf',           'dafi-13-213.pdf'],
  ['dafi_90-160.pdf',           'dafi-90-160.pdf'],
  ['dafi_90-302.pdf',           'dafi-90-302.pdf'],
  ['dafi_91-202.pdf',           'dafi-91-202.pdf'],
  ['dafi_91-204.pdf',           'dafi-91-204.pdf'],
  ['dafi_91-212.pdf',           'dafi-91-212.pdf'],

  // DAFMAN series — fix "vol._N" pattern
  ['dafman_13-204-vol._1.pdf',  'dafman-13-204-vol-1.pdf'],
  ['dafman_13-204-vol._2.pdf',  'dafman-13-204-vol-2.pdf'],
  ['dafman_13-204-vol._3.pdf',  'dafman-13-204-vol-3.pdf'],
  ['dafman_13-204-vol._4.pdf',  'dafman-13-204-vol-4.pdf'],
  ['dafman_13-217.pdf',         'dafman-13-217.pdf'],
  ['dafman_32-1084.pdf',        'dafman-32-1084.pdf'],
  ['dafman_36-2806.pdf',        'dafman-36-2806.pdf'],
  ['dafman_90-161.pdf',         'dafman-90-161.pdf'],
  ['dafman_91-203.pdf',         'dafman-91-203.pdf'],

  // FAA series
  ['faa_ac_150-5300-13.pdf',    'faa-ac-150-5300-13.pdf'],
  ['faa_jo_7110.65.pdf',        'faa-jo-7110.65.pdf'],
  ['faa_order_8260.3.pdf',      'faa-order-8260.3.pdf'],
  ['faa_order_jo_1900.47.pdf',  'faa-order-jo-1900.47.pdf'],
  ['faa_order_jo_7110.10.pdf',  'faa-order-jo-7110.10.pdf'],
  ['faa_order_jo_7210.3.pdf',   'faa-order-jo-7210.3.pdf'],
  ['faa_order_jo_7610.14.pdf',  'faa-order-jo-7610.14.pdf'],
  ['faao_8200.1d.pdf',          'faao-8200.1d.pdf'],

  // ICAO
  ['icao_annex_14.pdf',         'icao-annex-14.pdf'],

  // MIL-STD
  ['mil-std_3007.pdf',          'mil-std-3007.pdf'],

  // UFC series
  ['ufc_1-200-01.pdf',          'ufc-1-200-01.pdf'],
  ['ufc_1-200-02.pdf',          'ufc-1-200-02.pdf'],
  ['ufc_3-201-01.pdf',          'ufc-3-201-01.pdf'],
  ['ufc_3-260-02.pdf',          'ufc-3-260-02.pdf'],
  ['ufc_3-260-04.pdf',          'ufc-3-260-04.pdf'],
  ['ufc_3-260-16.pdf',          'ufc-3-260-16.pdf'],
  ['ufc_3-260-17.pdf',          'ufc-3-260-17.pdf'],
  ['ufc_3-270-01.pdf',          'ufc-3-270-01.pdf'],
  ['ufc_3-270-08.pdf',          'ufc-3-270-08.pdf'],
  ['ufc_3-460-01.pdf',          'ufc-3-460-01.pdf'],
  ['ufc_3-535-01.pdf',          'ufc-3-535-01.pdf'],
  ['ufc_4-010-01.pdf',          'ufc-4-010-01.pdf'],
  ['ufc_4-211-01.pdf',          'ufc-4-211-01.pdf'],
]

// ─── Execute renames ─────────────────────────────────────────
async function main() {
  console.log(`\nRenaming ${RENAMES.length} files in bucket: ${BUCKET}\n`)

  let renamed = 0
  let skipped = 0
  let errors = 0

  for (const [oldName, newName] of RENAMES) {
    if (oldName === newName) {
      console.log(`  SKIP  ${oldName} (already correct)`)
      skipped++
      continue
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .move(oldName, newName)

    if (error) {
      console.error(`  FAIL  ${oldName} → ${newName}: ${error.message}`)
      errors++
    } else {
      console.log(`  OK    ${oldName} → ${newName}`)
      renamed++
    }
  }

  console.log(`\nDone: ${renamed} renamed, ${skipped} skipped, ${errors} errors\n`)

  // Verify
  const { data } = await supabase.storage.from(BUCKET).list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } })
  if (data) {
    console.log('Current files in bucket:')
    data.forEach(f => console.log(`  ${f.name}`))
  }
}

main().catch(console.error)
