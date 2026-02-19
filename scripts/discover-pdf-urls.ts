/**
 * AF e-Publishing URL Discovery Script
 *
 * The static PDF URLs follow this pattern:
 *   https://static.e-publishing.af.mil/production/1/{org_code}/publication/{pub_id}/{pub_id}.pdf
 *
 * The org_code varies and our seed data may have the wrong one.
 * This script brute-forces all known org codes + filename variations to find working URLs.
 *
 * Run with: npx tsx scripts/discover-pdf-urls.ts
 */

const BASE = 'https://static.e-publishing.af.mil/production/1'

// All known AF org codes used in e-publishing paths
const ORG_CODES = [
  'af_a1', 'af_a2', 'af_a3', 'af_a4', 'af_a5', 'af_a6', 'af_a7', 'af_a8', 'af_a9', 'af_a10',
  'af_se', 'af_ja', 'af_te', 'af_cv', 'af_sg', 'af_re',
  'saf_aa', 'saf_aq', 'saf_cn', 'saf_fm', 'saf_gca', 'saf_ig', 'saf_ll', 'saf_mr', 'saf_pa',
  'saf_sq', 'saf_am', 'saf_ie', 'saf_us', 'saf_cda', 'saf_fm',
  'aetc', 'amc', 'acc', 'afgsc', 'afspc', 'afmc', 'afrc', 'ang', 'pacaf', 'usafe', 'afsoc',
  'afmc', 'usafa', 'afdw',
]

// Extract the e-publishing URLs and their reg_ids from the seed data
// We'll parse them from the known data
interface RegEntry {
  reg_id: string
  current_url: string
  pub_id: string  // e.g. "dafman13-204v1"
}

// Parse a reg_id into possible pub_id formats
function regIdToPubIds(regId: string): string[] {
  // Normalize: "DAFMAN 13-204, Vol. 4" -> "dafman13-204v4"
  const base = regId
    .replace(/,\s*/g, '')
    .replace(/Vol\.\s*/i, 'v')
    .replace(/\s+/g, '')
    .toLowerCase()

  const ids = [base]

  // Also try with underscores before version: "dafman13-204_v4"
  const vMatch = base.match(/^(.+?)(v\d+)$/)
  if (vMatch) {
    ids.push(`${vMatch[1]}_${vMatch[2]}`)
  }

  // Try with dash before version: "afman11-202-v3"
  if (vMatch) {
    ids.push(`${vMatch[1]}-${vMatch[2]}`)
  }

  // For AFTTP with dots: "afttp3-4.4" might need variations
  if (base.includes('.')) {
    ids.push(base.replace(/\./g, '_'))
    ids.push(base.replace(/\./g, '-'))
  }

  return [...new Set(ids)]
}

// Extract pub_id from an existing URL
function pubIdFromUrl(url: string): string | null {
  // https://static.e-publishing.af.mil/production/1/af_a3/publication/dafman13-204v1/dafman13-204v1.pdf
  const match = url.match(/\/publication\/([^/]+)\//)
  return match ? match[1] : null
}

// All e-publishing regulations from the seed data
const EPUB_REGULATIONS: RegEntry[] = [
  // Core
  { reg_id: 'DAFMAN 13-204, Vol. 1', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafman13-204v1/dafman13-204v1.pdf', pub_id: 'dafman13-204v1' },
  { reg_id: 'DAFMAN 13-204, Vol. 2', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafman13-204v2/dafman13-204v2.pdf', pub_id: 'dafman13-204v2' },
  { reg_id: 'DAFMAN 13-204, Vol. 3', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafman13-204v3/dafman13-204v3.pdf', pub_id: 'dafman13-204v3' },
  // Section I
  { reg_id: 'DAFI 90-160', current_url: 'https://static.e-publishing.af.mil/production/1/saf_aa/publication/dafi90-160/dafi90-160.pdf', pub_id: 'dafi90-160' },
  { reg_id: 'DAFI 90-302', current_url: 'https://static.e-publishing.af.mil/production/1/saf_ig/publication/dafi90-302/dafi90-302.pdf', pub_id: 'dafi90-302' },
  { reg_id: 'DAFMAN 90-161', current_url: 'https://static.e-publishing.af.mil/production/1/saf_aa/publication/dafman90-161/dafman90-161.pdf', pub_id: 'dafman90-161' },
  { reg_id: 'AFI 10-1002', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afi10-1002/afi10-1002.pdf', pub_id: 'afi10-1002' },
  { reg_id: 'AFI 10-1801', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afi10-1801/afi10-1801.pdf', pub_id: 'afi10-1801' },
  { reg_id: 'AFI 38-402', current_url: 'https://static.e-publishing.af.mil/production/1/af_a1/publication/afi38-402/afi38-402.pdf', pub_id: 'afi38-402' },
  // Section II
  { reg_id: 'AFI 10-1001', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afi10-1001/afi10-1001.pdf', pub_id: 'afi10-1001' },
  { reg_id: 'AFI 10-2501', current_url: 'https://static.e-publishing.af.mil/production/1/af_a4/publication/afi10-2501/afi10-2501.pdf', pub_id: 'afi10-2501' },
  { reg_id: 'AFH 32-7084', current_url: 'https://static.e-publishing.af.mil/production/1/af_a4/publication/afh32-7084/afh32-7084.pdf', pub_id: 'afh32-7084' },
  { reg_id: 'DAFMAN 32-1084', current_url: 'https://static.e-publishing.af.mil/production/1/af_a4/publication/dafman32-1084/dafman32-1084.pdf', pub_id: 'dafman32-1084' },
  // Section III
  { reg_id: 'AFI 17-221', current_url: 'https://static.e-publishing.af.mil/production/1/saf_cn/publication/afi17-221/afi17-221.pdf', pub_id: 'afi17-221' },
  { reg_id: 'AFI 33-322', current_url: 'https://static.e-publishing.af.mil/production/1/saf_cn/publication/afi33-322/afi33-322.pdf', pub_id: 'afi33-322' },
  // Section VI-A
  { reg_id: 'AFPD 13-2', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afpd13-2/afpd13-2.pdf', pub_id: 'afpd13-2' },
  { reg_id: 'DAFI 13-213', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafi13-213/dafi13-213.pdf', pub_id: 'dafi13-213' },
  { reg_id: 'DAFMAN 13-217', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafman13-217/dafman13-217.pdf', pub_id: 'dafman13-217' },
  { reg_id: 'DAFI 91-212', current_url: 'https://static.e-publishing.af.mil/production/1/af_se/publication/dafi91-212/dafi91-212.pdf', pub_id: 'dafi91-212' },
  { reg_id: 'DAFI 91-202', current_url: 'https://static.e-publishing.af.mil/production/1/af_se/publication/dafi91-202/dafi91-202.pdf', pub_id: 'dafi91-202' },
  { reg_id: 'DAFI 91-204', current_url: 'https://static.e-publishing.af.mil/production/1/af_se/publication/dafi91-204/dafi91-204.pdf', pub_id: 'dafi91-204' },
  { reg_id: 'DAFMAN 91-203', current_url: 'https://static.e-publishing.af.mil/production/1/af_se/publication/dafman91-203/dafman91-203.pdf', pub_id: 'dafman91-203' },
  { reg_id: 'AFI 33-332', current_url: 'https://static.e-publishing.af.mil/production/1/saf_cn/publication/afi33-332/afi33-332.pdf', pub_id: 'afi33-332' },
  { reg_id: 'AFI 36-2101', current_url: 'https://static.e-publishing.af.mil/production/1/af_a1/publication/afi36-2101/afi36-2101.pdf', pub_id: 'afi36-2101' },
  { reg_id: 'AFI 36-2670', current_url: 'https://static.e-publishing.af.mil/production/1/af_a1/publication/afi36-2670/afi36-2670.pdf', pub_id: 'afi36-2670' },
  { reg_id: 'AFI 32-1041', current_url: 'https://static.e-publishing.af.mil/production/1/af_a4/publication/afi32-1041/afi32-1041.pdf', pub_id: 'afi32-1041' },
  { reg_id: 'AFMAN 11-230', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afman11-230/afman11-230.pdf', pub_id: 'afman11-230' },
  { reg_id: 'AFMAN 11-202 Vol 3', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afman11-202v3/afman11-202v3.pdf', pub_id: 'afman11-202v3' },
  // Section VII-A
  { reg_id: 'DAFMAN 13-204, Vol. 4', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafman13-204v4/dafman13-204v4.pdf', pub_id: 'dafman13-204v4' },
  { reg_id: 'DAFMAN 36-2806', current_url: 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafman36-2806/dafman36-2806.pdf', pub_id: 'dafman36-2806' },
  { reg_id: 'AFMAN 91-223', current_url: 'https://static.e-publishing.af.mil/production/1/af_se/publication/afman91-223/afman91-223.pdf', pub_id: 'afman91-223' },
  { reg_id: 'AFI 36-701', current_url: 'https://static.e-publishing.af.mil/production/1/af_a1/publication/afi36-701/afi36-701.pdf', pub_id: 'afi36-701' },
  { reg_id: 'AFI 36-129', current_url: 'https://static.e-publishing.af.mil/production/1/af_a1/publication/afi36-129/afi36-129.pdf', pub_id: 'afi36-129' },
  { reg_id: 'AFI 51-403', current_url: 'https://static.e-publishing.af.mil/production/1/af_ja/publication/afi51-403/afi51-403.pdf', pub_id: 'afi51-403' },
  { reg_id: 'AFI 10-401', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afi10-401/afi10-401.pdf', pub_id: 'afi10-401' },
  { reg_id: 'AFMAN 11-502', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afman11-502/afman11-502.pdf', pub_id: 'afman11-502' },
  { reg_id: 'AFI 36-2619', current_url: 'https://static.e-publishing.af.mil/production/1/af_a1/publication/afi36-2619/afi36-2619.pdf', pub_id: 'afi36-2619' },
  // Section VII-C
  { reg_id: 'AFI 11-208', current_url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afi11-208/afi11-208.pdf', pub_id: 'afi11-208' },
  { reg_id: 'AFI 36-2110', current_url: 'https://static.e-publishing.af.mil/production/1/af_a1/publication/afi36-2110/afi36-2110.pdf', pub_id: 'afi36-2110' },
]

// ── FAA / MIL-STD currency-check URLs ─────────────────────────────
// These are the FAA info pages used to verify whether newer editions
// have been published. The DB stores direct PDF links for downloading;
// these web pages are for manual or scripted currency verification only.
export const FAA_CURRENCY_URLS: Record<string, string> = {
  'FAA Order JO 7210.3': 'https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1040564',
  'FAA Order JO 7110.10': 'https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1040566',
  'FAA Order JO 1900.47': 'https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1042413',
  'FAA AC 150/5300-13': 'https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.current/documentNumber/150_5300-13',
  'FAA Order 8260.3': 'https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1029737',
  'FAA JO 7110.65': 'https://www.faa.gov/air_traffic/publications/atpubs/atc_html/',
  'FAA Order JO 7610.14': 'https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1040568',
  'FAAO 8200.1D': 'https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1029824',
  'MIL-STD 3007': 'https://www.wbdg.org/ffc/dod/mil-std/mil_std_3007f',
}

async function checkUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'follow',
    })

    if (!response.ok) return false

    const ct = response.headers.get('content-type') || ''
    return ct.includes('pdf') || ct.includes('octet-stream')
  } catch {
    return false
  }
}

async function discoverUrl(reg: RegEntry): Promise<{ reg_id: string; current_url: string; found_url: string | null; status: string }> {
  // First check if the current URL works
  const currentWorks = await checkUrl(reg.current_url)
  if (currentWorks) {
    return { reg_id: reg.reg_id, current_url: reg.current_url, found_url: reg.current_url, status: 'OK (current)' }
  }

  console.log(`  ${reg.reg_id}: current URL failed, trying alternatives...`)

  // Generate all pub_id variations
  const pubIds = regIdToPubIds(reg.reg_id)
  // Also include the current pub_id from the URL
  const currentPubId = pubIdFromUrl(reg.current_url)
  if (currentPubId && !pubIds.includes(currentPubId)) {
    pubIds.unshift(currentPubId)
  }

  // Try all combinations of org_code x pub_id
  // Do it in batches to avoid hammering the server
  for (const pubId of pubIds) {
    const batch = ORG_CODES.map(org => {
      // Try both: filename matching dir name, and filename matching pub_id
      const url1 = `${BASE}/${org}/publication/${pubId}/${pubId}.pdf`
      return url1
    })

    // Check in parallel batches of 10
    for (let i = 0; i < batch.length; i += 10) {
      const chunk = batch.slice(i, i + 10)
      const results = await Promise.all(chunk.map(async url => ({ url, ok: await checkUrl(url) })))
      const found = results.find(r => r.ok)
      if (found) {
        return { reg_id: reg.reg_id, current_url: reg.current_url, found_url: found.url, status: 'FOUND (new)' }
      }
    }

    // Small delay between pub_id variations
    await new Promise(r => setTimeout(r, 200))
  }

  return { reg_id: reg.reg_id, current_url: reg.current_url, found_url: null, status: 'NOT FOUND' }
}

async function main() {
  console.log('=== AF e-Publishing URL Discovery ===')
  console.log(`Testing ${EPUB_REGULATIONS.length} e-publishing URLs...\n`)

  const results: { reg_id: string; current_url: string; found_url: string | null; status: string }[] = []

  // Process sequentially to be polite to the server
  for (let i = 0; i < EPUB_REGULATIONS.length; i++) {
    const reg = EPUB_REGULATIONS[i]
    console.log(`[${i + 1}/${EPUB_REGULATIONS.length}] ${reg.reg_id}`)
    const result = await discoverUrl(reg)
    results.push(result)
    console.log(`  -> ${result.status}${result.found_url && result.found_url !== result.current_url ? ': ' + result.found_url : ''}`)

    // Polite delay
    await new Promise(r => setTimeout(r, 300))
  }

  // Summary
  const ok = results.filter(r => r.status === 'OK (current)')
  const found = results.filter(r => r.status === 'FOUND (new)')
  const notFound = results.filter(r => r.status === 'NOT FOUND')

  console.log('\n=== SUMMARY ===')
  console.log(`Current URL works: ${ok.length}`)
  console.log(`New URL found:     ${found.length}`)
  console.log(`Not found:         ${notFound.length}`)

  if (found.length > 0) {
    console.log('\n=== URL CORRECTIONS NEEDED ===')
    for (const r of found) {
      console.log(`\n${r.reg_id}:`)
      console.log(`  OLD: ${r.current_url}`)
      console.log(`  NEW: ${r.found_url}`)
    }
  }

  if (notFound.length > 0) {
    console.log('\n=== STILL NOT FOUND (may be restricted/removed) ===')
    for (const r of notFound) {
      console.log(`  ${r.reg_id}: ${r.current_url}`)
    }
  }

  // Output as JSON for easy processing
  const corrections = found.map(r => ({ reg_id: r.reg_id, old_url: r.current_url, new_url: r.found_url }))
  if (corrections.length > 0) {
    console.log('\n=== JSON CORRECTIONS ===')
    console.log(JSON.stringify(corrections, null, 2))
  }
}

main().catch(console.error)
