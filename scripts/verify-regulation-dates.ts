/**
 * AOMS Regulation Date Verifier
 *
 * Scrapes e-Publishing.af.mil and eCFR.gov to verify current publication dates
 * for all regulations in the database. Run monthly or quarterly.
 *
 * Run with: npx tsx scripts/verify-regulation-dates.ts
 *
 * Modes:
 *   --check     (default) Check dates and print report only
 *   --update    Check dates AND update the database
 *   --dry-run   Check dates, show what would change, but don't write
 *
 * Output: A report showing each regulation's stored date vs. the live date,
 * flagging any mismatches for review.
 */

const args = process.argv.slice(2)
const MODE = args.includes('--update') ? 'update' : args.includes('--dry-run') ? 'dry-run' : 'check'

// --- Date extraction patterns by source ---

interface DateCheckResult {
  reg_id: string
  stored_date: string | null
  live_date: string | null
  status: 'current' | 'updated' | 'unable_to_check' | 'new_version'
  notes?: string
}

/**
 * Scrape e-Publishing.af.mil for a DAF publication's current date.
 * The PDF URL pattern contains the publication ID — we check the product page.
 */
async function checkEPublishing(url: string): Promise<string | null> {
  try {
    // Convert PDF URL to product page URL
    // e.g., .../dafman13-204v1/dafman13-204v1.pdf -> .../dafman13-204v1/
    const productUrl = url.replace(/\/[^/]+\.pdf$/, '/')

    const response = await fetch(productUrl, {
      headers: { 'User-Agent': 'AOMS-DateVerifier/1.0' },
      redirect: 'follow',
    })

    if (!response.ok) return null

    const html = await response.text()

    // Look for "Certified Current" or date patterns in the page
    // e-Publishing pages typically show: "Date: DD Mon YYYY"
    const datePatterns = [
      /(?:Certified Current|Date)[:\s]*(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})/i,
      /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
      /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i,
    ]

    for (const pattern of datePatterns) {
      const match = html.match(pattern)
      if (match) return match[1].trim()
    }

    // Check for DAFGM (Guidance Memorandum) which supersedes the base date
    const dafgmPattern = /DAFGM\s*\d{4}-\d+[,\s]*(\d{1,2}\s+\w+\s+\d{4})/i
    const dafgmMatch = html.match(dafgmPattern)
    if (dafgmMatch) return `DAFGM ${dafgmMatch[1].trim()}`

    return null
  } catch {
    return null
  }
}

/**
 * Check eCFR.gov for a CFR part's last amendment date.
 */
async function checkEcfr(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AOMS-DateVerifier/1.0' },
      redirect: 'follow',
    })

    if (!response.ok) return null

    const html = await response.text()

    // eCFR shows "Source:" and amendment dates
    const amendPattern = /(?:Amdt\.|Amendment).*?(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i
    const match = html.match(amendPattern)
    if (match) return match[1].trim()

    // Also check for "as of" date
    const asOfPattern = /as of\s+(\w+\s+\d{1,2},?\s+\d{4})/i
    const asOfMatch = html.match(asOfPattern)
    if (asOfMatch) return asOfMatch[1].trim()

    return null
  } catch {
    return null
  }
}

/**
 * Check FAA orders page for current date.
 */
async function checkFaa(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AOMS-DateVerifier/1.0' },
      redirect: 'follow',
    })

    if (!response.ok) return null

    const html = await response.text()

    // FAA pages show "Effective Date:" or "Date Issued:"
    const datePatterns = [
      /(?:Effective Date|Date Issued|Issue Date)[:\s]*(\w+\s+\d{1,2},?\s+\d{4})/i,
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
    ]

    for (const pattern of datePatterns) {
      const match = html.match(pattern)
      if (match) return match[1].trim()
    }

    return null
  } catch {
    return null
  }
}

/**
 * Check WBDG.org for UFC publication dates.
 */
async function checkWbdg(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AOMS-DateVerifier/1.0' },
      redirect: 'follow',
    })

    if (!response.ok) return null

    const html = await response.text()

    // WBDG shows "Date:" or specific date patterns
    const datePatterns = [
      /(?:Document Date|Date)[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i,
      /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    ]

    for (const pattern of datePatterns) {
      const match = html.match(pattern)
      if (match) return match[1].trim()
    }

    return null
  } catch {
    return null
  }
}

/**
 * Route a regulation URL to the appropriate scraper.
 */
async function checkDate(url: string): Promise<string | null> {
  if (url.includes('e-publishing.af.mil')) return checkEPublishing(url)
  if (url.includes('ecfr.gov')) return checkEcfr(url)
  if (url.includes('faa.gov')) return checkFaa(url)
  if (url.includes('wbdg.org')) return checkWbdg(url)
  // ICAO — can't easily scrape, return null
  return null
}

async function main() {
  console.log('=== AOMS Regulation Date Verifier ===')
  console.log(`Mode: ${MODE}\n`)

  // Try Supabase first, fall back to local data
  let regulations: { reg_id: string; publication_date: string | null; url: string | null }[] = []

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (supabaseUrl && supabaseKey) {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data, error } = await supabase
      .from('regulations')
      .select('reg_id, publication_date, url')
      .order('reg_id')

    if (!error && data) {
      regulations = data
      console.log(`Loaded ${regulations.length} regulations from Supabase\n`)
    }
  }

  if (regulations.length === 0) {
    // Fallback to local data
    const { ALL_REGULATIONS } = await import('../lib/regulations-data')
    regulations = ALL_REGULATIONS.map(r => ({
      reg_id: r.reg_id,
      publication_date: r.publication_date,
      url: r.url,
    }))
    console.log(`Loaded ${regulations.length} regulations from local data\n`)
  }

  const results: DateCheckResult[] = []
  const checkable = regulations.filter(r => r.url)

  for (let i = 0; i < checkable.length; i++) {
    const reg = checkable[i]
    process.stdout.write(`[${i + 1}/${checkable.length}] ${reg.reg_id}... `)

    const liveDate = await checkDate(reg.url!)

    let status: DateCheckResult['status'] = 'unable_to_check'
    let notes: string | undefined

    if (liveDate === null) {
      status = 'unable_to_check'
      notes = 'Could not scrape date from source'
    } else if (reg.publication_date === 'Current Ed.' || !reg.publication_date) {
      status = 'new_version'
      notes = `Found date: ${liveDate}`
    } else if (liveDate.includes(reg.publication_date) || reg.publication_date.includes(liveDate)) {
      status = 'current'
    } else {
      status = 'updated'
      notes = `Stored: "${reg.publication_date}" → Live: "${liveDate}"`
    }

    results.push({
      reg_id: reg.reg_id,
      stored_date: reg.publication_date,
      live_date: liveDate,
      status,
      notes,
    })

    const statusIcon = {
      current: '\x1b[32m✓\x1b[0m',
      updated: '\x1b[33m⚠\x1b[0m',
      unable_to_check: '\x1b[90m?\x1b[0m',
      new_version: '\x1b[36m★\x1b[0m',
    }[status]

    console.log(`${statusIcon} ${status}${notes ? ` — ${notes}` : ''}`)

    // Be polite — 300ms between requests
    await new Promise(r => setTimeout(r, 300))
  }

  // Summary
  const current = results.filter(r => r.status === 'current').length
  const updated = results.filter(r => r.status === 'updated').length
  const newVersion = results.filter(r => r.status === 'new_version').length
  const unable = results.filter(r => r.status === 'unable_to_check').length

  console.log('\n=== Summary ===')
  console.log(`\x1b[32m✓ Current:           ${current}\x1b[0m`)
  console.log(`\x1b[33m⚠ Date changed:      ${updated}\x1b[0m`)
  console.log(`\x1b[36m★ New dates found:    ${newVersion}\x1b[0m`)
  console.log(`\x1b[90m? Unable to check:   ${unable}\x1b[0m`)

  // Show changed entries
  if (updated > 0) {
    console.log('\n=== Regulations with Date Changes ===')
    results
      .filter(r => r.status === 'updated')
      .forEach(r => {
        console.log(`  ${r.reg_id}`)
        console.log(`    ${r.notes}`)
      })
  }

  // Show newly discovered dates
  if (newVersion > 0) {
    console.log('\n=== Regulations with Discovered Dates ===')
    results
      .filter(r => r.status === 'new_version')
      .forEach(r => {
        console.log(`  ${r.reg_id}: ${r.live_date}`)
      })
  }

  // If --update mode, write changes to DB
  if (MODE === 'update' && supabaseUrl && supabaseKey) {
    const toUpdate = results.filter(r => r.status === 'updated' || r.status === 'new_version')
    if (toUpdate.length > 0) {
      console.log(`\nUpdating ${toUpdate.length} records in database...`)
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)

      for (const r of toUpdate) {
        if (!r.live_date) continue
        const { error } = await supabase
          .from('regulations')
          .update({
            publication_date: r.live_date,
            verified_date: r.live_date,
            last_verified_at: new Date().toISOString(),
          })
          .eq('reg_id', r.reg_id)

        if (error) {
          console.error(`  Failed to update ${r.reg_id}: ${error.message}`)
        } else {
          console.log(`  Updated: ${r.reg_id} → ${r.live_date}`)
        }
      }
    }

    // Mark all checked entries as verified
    const verified = results.filter(r => r.status === 'current')
    if (verified.length > 0) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)
      for (const r of verified) {
        await supabase
          .from('regulations')
          .update({ last_verified_at: new Date().toISOString() })
          .eq('reg_id', r.reg_id)
      }
      console.log(`Marked ${verified.length} regulations as verified.`)
    }
  }

  // Write report to file
  const reportDate = new Date().toISOString().split('T')[0]
  const reportLines = [
    `AOMS Regulation Date Verification Report — ${reportDate}`,
    `Mode: ${MODE}`,
    `Total checked: ${results.length}`,
    `Current: ${current} | Changed: ${updated} | New dates: ${newVersion} | Unable: ${unable}`,
    '',
    'REG_ID | STORED_DATE | LIVE_DATE | STATUS',
    '-'.repeat(80),
    ...results.map(r =>
      `${r.reg_id} | ${r.stored_date || 'N/A'} | ${r.live_date || 'N/A'} | ${r.status}${r.notes ? ` — ${r.notes}` : ''}`
    ),
  ]

  const reportPath = `scripts/date-verification-report-${reportDate}.txt`
  const fs = await import('fs')
  fs.writeFileSync(reportPath, reportLines.join('\n'))
  console.log(`\nReport saved to: ${reportPath}`)
}

main().catch(console.error)
