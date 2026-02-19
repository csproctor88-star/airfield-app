/**
 * AOMS Regulation PDF Downloader
 *
 * Downloads all regulation PDFs and uploads them to Supabase Storage.
 * Run with: npx tsx scripts/download-regulations.ts
 *
 * Prerequisites:
 *   1. Supabase project with Storage bucket "regulation-pdfs" created
 *   2. Environment variables set:
 *      - NEXT_PUBLIC_SUPABASE_URL
 *      - SUPABASE_SERVICE_ROLE_KEY  (not the anon key — needs storage write access)
 *
 * What this script does:
 *   1. Reads all 78 regulations from the database (or falls back to local data)
 *   2. For each regulation with a .pdf URL:
 *      - Downloads the PDF from the source URL
 *      - Uploads it to Supabase Storage under regulation-pdfs/{sanitized_reg_id}.pdf
 *      - Updates the regulations table with storage_path and file_size_bytes
 *   3. Prints a summary of successes and failures
 *
 * Non-PDF URLs (eCFR web pages, ICAO store, etc.) are skipped — those must be
 * accessed online.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET_NAME = 'regulation-pdfs'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing environment variables:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL')
  console.error('  SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function sanitizeFileName(regId: string): string {
  return regId
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/,\s*/g, '-')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '-')
    .toLowerCase()
}

async function downloadPdf(url: string): Promise<{ buffer: ArrayBuffer; size: number } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AOMS-RegDownloader/1.0 (Airfield OPS Management Suite)',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      console.error(`  HTTP ${response.status} for ${url}`)
      return null
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
      console.warn(`  Unexpected content-type: ${contentType} — skipping`)
      return null
    }

    const buffer = await response.arrayBuffer()
    return { buffer, size: buffer.byteLength }
  } catch (err) {
    console.error(`  Download failed: ${(err as Error).message}`)
    return null
  }
}

async function uploadToStorage(fileName: string, buffer: ArrayBuffer): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (error) {
    console.error(`  Upload failed: ${error.message}`)
    return null
  }

  return data.path
}

async function updateRegulationRecord(regId: string, storagePath: string, fileSize: number): Promise<void> {
  const { error } = await supabase
    .from('regulations')
    .update({
      storage_path: storagePath,
      file_size_bytes: fileSize,
    })
    .eq('reg_id', regId)

  if (error) {
    console.error(`  DB update failed for ${regId}: ${error.message}`)
  }
}

async function main() {
  console.log('=== AOMS Regulation PDF Downloader ===\n')

  // Check if bucket exists
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
  if (bucketError) {
    console.error('Failed to list storage buckets:', bucketError.message)
    process.exit(1)
  }

  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME)
  if (!bucketExists) {
    console.log(`Creating storage bucket "${BUCKET_NAME}"...`)
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 52428800, // 50MB max per file
    })
    if (error) {
      console.error(`Failed to create bucket: ${error.message}`)
      process.exit(1)
    }
    console.log('Bucket created.\n')
  }

  // Fetch all regulations
  const { data: regulations, error: fetchError } = await supabase
    .from('regulations')
    .select('reg_id, url, storage_path')
    .order('reg_id')

  if (fetchError || !regulations) {
    console.error('Failed to fetch regulations:', fetchError?.message)
    process.exit(1)
  }

  const pdfRegs = regulations.filter(r => r.url?.toLowerCase().endsWith('.pdf'))
  const nonPdfRegs = regulations.filter(r => r.url && !r.url.toLowerCase().endsWith('.pdf'))
  const alreadyCached = pdfRegs.filter(r => r.storage_path)
  const toDownload = pdfRegs.filter(r => !r.storage_path)

  const noUrlRegs = regulations.filter(r => !r.url)

  console.log(`Total regulations: ${regulations.length}`)
  console.log(`PDF URLs: ${pdfRegs.length}`)
  console.log(`Non-PDF URLs (web pages): ${nonPdfRegs.length} — skipped`)
  console.log(`No URL: ${noUrlRegs.length}`)
  console.log(`Already cached: ${alreadyCached.length}`)
  console.log(`To download: ${toDownload.length}\n`)

  if (nonPdfRegs.length > 0) {
    console.log('Non-PDF regulations (skipped):')
    for (const r of nonPdfRegs) {
      console.log(`  - ${r.reg_id}: ${r.url}`)
    }
    console.log()
  }

  let success = 0
  let failed = 0

  for (let i = 0; i < toDownload.length; i++) {
    const reg = toDownload[i]
    const fileName = `${sanitizeFileName(reg.reg_id)}.pdf`
    console.log(`[${i + 1}/${toDownload.length}] ${reg.reg_id}`)
    console.log(`  URL: ${reg.url}`)

    const result = await downloadPdf(reg.url!)
    if (!result) {
      failed++
      continue
    }

    console.log(`  Downloaded: ${(result.size / 1024).toFixed(0)} KB`)

    const storagePath = await uploadToStorage(fileName, result.buffer)
    if (!storagePath) {
      failed++
      continue
    }

    await updateRegulationRecord(reg.reg_id, storagePath, result.size)
    console.log(`  Stored: ${storagePath}`)
    success++

    // Be polite — 500ms between downloads
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\n=== Summary ===')
  console.log(`Downloaded & uploaded: ${success}`)
  console.log(`Failed: ${failed}`)
  console.log(`Skipped (already cached): ${alreadyCached.length}`)
  console.log(`Skipped (non-PDF): ${nonPdfRegs.length}`)
}

main().catch(console.error)
