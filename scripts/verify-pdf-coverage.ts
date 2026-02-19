/**
 * AOMS Regulation PDF Coverage Verifier
 *
 * Checks that every regulation in the Supabase database is either:
 *   1. Already cached in Supabase Storage (storage_path is set), OR
 *   2. Has a direct PDF URL (url ends in .pdf) that the downloader can fetch
 *
 * Regulations with web-only URLs (eCFR, etc.) are flagged
 * as "WEB ONLY" — these must be accessed online and cannot be cached.
 *
 * Run with: npx tsx scripts/verify-pdf-coverage.ts
 *
 * Prerequisites:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing environment variables:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL')
  console.error('  SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

type Status = 'IN_STORAGE' | 'PDF_AVAILABLE' | 'WEB_ONLY'

interface RegStatus {
  reg_id: string
  pub_type: string
  url: string | null
  storage_path: string | null
  file_size_bytes: number | null
  status: Status
}

async function main() {
  console.log('=== AOMS Regulation PDF Coverage Report ===\n')

  const { data: regulations, error } = await supabase
    .from('regulations')
    .select('reg_id, pub_type, url, storage_path, file_size_bytes')
    .order('reg_id')

  if (error || !regulations) {
    console.error('Failed to fetch regulations:', error?.message)
    process.exit(1)
  }

  const results: RegStatus[] = regulations.map(r => {
    let status: Status
    if (r.storage_path) {
      status = 'IN_STORAGE'
    } else if (r.url?.toLowerCase().endsWith('.pdf')) {
      status = 'PDF_AVAILABLE'
    } else {
      status = 'WEB_ONLY'
    }
    return { ...r, status }
  })

  const inStorage = results.filter(r => r.status === 'IN_STORAGE')
  const pdfAvailable = results.filter(r => r.status === 'PDF_AVAILABLE')
  const webOnly = results.filter(r => r.status === 'WEB_ONLY')

  // Summary
  console.log(`Total regulations: ${results.length}`)
  console.log(`  IN STORAGE (cached):    ${inStorage.length}`)
  console.log(`  PDF AVAILABLE (to DL):  ${pdfAvailable.length}`)
  console.log(`  WEB ONLY (no PDF):      ${webOnly.length}`)
  console.log(`  Coverage:               ${inStorage.length}/${inStorage.length + pdfAvailable.length} downloadable PDFs cached`)
  console.log()

  // Detail: In Storage
  if (inStorage.length > 0) {
    console.log('── IN STORAGE ──────────────────────────────────────')
    for (const r of inStorage) {
      const size = r.file_size_bytes ? `${(r.file_size_bytes / 1024).toFixed(0)} KB` : '?'
      console.log(`  ✓ ${r.reg_id.padEnd(30)} ${size.padStart(10)}  ${r.storage_path}`)
    }
    console.log()
  }

  // Detail: PDF Available but not yet cached
  if (pdfAvailable.length > 0) {
    console.log('── PDF AVAILABLE (run download-regulations.ts) ─────')
    for (const r of pdfAvailable) {
      console.log(`  ○ ${r.reg_id.padEnd(30)} ${r.url}`)
    }
    console.log()
  }

  // Detail: Web Only
  if (webOnly.length > 0) {
    console.log('── WEB ONLY (access online) ────────────────────────')
    for (const r of webOnly) {
      const domain = r.url ? new URL(r.url).hostname : 'no url'
      console.log(`  ✗ ${r.reg_id.padEnd(30)} ${r.pub_type.padEnd(6)} ${domain}`)
    }
    console.log()
  }

  // Final verdict
  const downloadable = inStorage.length + pdfAvailable.length
  if (pdfAvailable.length === 0 && webOnly.length === 0) {
    console.log('ALL regulations are cached in Supabase Storage.')
  } else if (pdfAvailable.length === 0) {
    console.log(`ALL downloadable PDFs are cached. ${webOnly.length} regulations are web-only.`)
  } else {
    console.log(`${pdfAvailable.length} PDFs still need to be downloaded. Run: npx tsx scripts/download-regulations.ts`)
  }
}

main().catch(console.error)
