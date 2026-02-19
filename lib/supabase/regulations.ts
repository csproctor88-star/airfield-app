import { createClient } from './client'

export type RegulationRow = {
  id: string
  reg_id: string
  title: string
  description: string
  publication_date: string | null
  url: string | null
  source_section: string
  source_volume: string | null
  category: string
  pub_type: string
  is_core: boolean
  is_cross_ref: boolean
  is_scrubbed: boolean
  tags: string[]
  storage_path: string | null
  file_size_bytes: number | null
  last_verified_at: string | null
  verified_date: string | null
  created_at: string
}

export async function fetchRegulations(): Promise<RegulationRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('regulations')
    .select('*')
    .order('reg_id', { ascending: true })

  if (error) {
    console.error('Failed to fetch regulations:', error.message)
    return []
  }

  return data as RegulationRow[]
}

export async function fetchRegulation(id: string): Promise<RegulationRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('regulations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch regulation:', error.message)
    return null
  }

  return data as RegulationRow
}

export async function searchRegulations(query: string): Promise<RegulationRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('regulations')
    .select('*')
    .textSearch('reg_id', query, { type: 'websearch' })
    .order('reg_id', { ascending: true })

  if (error) {
    // Fallback to ilike search
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('regulations')
      .select('*')
      .or(`reg_id.ilike.%${query}%,title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('reg_id', { ascending: true })

    if (fallbackError) {
      console.error('Failed to search regulations:', fallbackError.message)
      return []
    }
    return fallbackData as RegulationRow[]
  }

  return data as RegulationRow[]
}

/**
 * List all PDF files in the regulation-pdfs bucket.
 * Checks both root level and one level of subfolders.
 * Returns an array of storage paths like "dafman_13-204-_vol._1.pdf".
 */
export async function listCachedRegulationPdfs(): Promise<string[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase.storage
    .from('regulation-pdfs')
    .list('', { limit: 500 })

  if (error || !data) return []

  const pdfFiles: string[] = []

  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    if (item.name.endsWith('.pdf')) {
      pdfFiles.push(item.name)
    } else if (item.id === null && item.name !== 'user-uploads') {
      // This is a folder — list its contents too
      const { data: subData } = await supabase.storage
        .from('regulation-pdfs')
        .list(item.name, { limit: 200 })
      if (subData) {
        for (let j = 0; j < subData.length; j++) {
          if (subData[j].name.endsWith('.pdf')) {
            pdfFiles.push(`${item.name}/${subData[j].name}`)
          }
        }
      }
    }
  }

  return pdfFiles
}

/**
 * Get a URL for a cached PDF in Supabase Storage.
 * Tries a signed URL first; falls back to the public URL if the bucket
 * is public but signed-URL creation fails (e.g. missing storage policies
 * for the anon key).
 */
export async function getRegulationPdfUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null

  // 1. Try signed URL (works for private buckets with correct policies)
  const { data, error } = await supabase.storage
    .from('regulation-pdfs')
    .createSignedUrl(storagePath, 3600) // 1 hour expiry

  if (!error && data?.signedUrl) return data.signedUrl

  if (error) {
    console.warn('[Regs] Signed URL failed for', storagePath, '–', error.message)
  }

  // 2. Fallback: public URL (works if bucket has a public access policy)
  const { data: pubData } = supabase.storage
    .from('regulation-pdfs')
    .getPublicUrl(storagePath)

  return pubData?.publicUrl ?? null
}

// ── User-uploaded regulation PDFs ──────────────────────────────

export type UserRegulationPdf = {
  id: string
  user_id: string
  reg_id: string
  storage_path: string
  file_name: string
  file_size_bytes: number | null
  uploaded_at: string
}

const USER_PDF_BUCKET = 'regulation-pdfs'

/**
 * Upload a personal PDF copy of a regulation for the current user.
 * Replaces any existing upload for the same regulation.
 */
export async function uploadUserRegulationPdf(
  userId: string,
  regId: string,
  file: File
): Promise<UserRegulationPdf | null> {
  const supabase = createClient()
  if (!supabase) return null

  const storagePath = `user-uploads/${userId}/${sanitizeStorageName(regId)}.pdf`

  // Upload file to storage (upsert to replace existing)
  const { error: uploadError } = await supabase.storage
    .from(USER_PDF_BUCKET)
    .upload(storagePath, file, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    console.error('Failed to upload PDF:', uploadError.message)
    return null
  }

  // Upsert the database record
  const { data, error: dbError } = await supabase
    .from('user_regulation_pdfs')
    .upsert(
      {
        user_id: userId,
        reg_id: regId,
        storage_path: storagePath,
        file_name: file.name,
        file_size_bytes: file.size,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,reg_id' }
    )
    .select()
    .single()

  if (dbError) {
    console.error('Failed to save upload record:', dbError.message)
    return null
  }

  return data as UserRegulationPdf
}

/**
 * Fetch all user-uploaded PDFs for the current user, keyed by reg_id.
 */
export async function fetchUserRegulationPdfs(
  userId: string
): Promise<Map<string, UserRegulationPdf>> {
  const supabase = createClient()
  if (!supabase) return new Map()

  const { data, error } = await supabase
    .from('user_regulation_pdfs')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to fetch user PDFs:', error.message)
    return new Map()
  }

  const map = new Map<string, UserRegulationPdf>()
  for (const row of data as UserRegulationPdf[]) {
    map.set(row.reg_id, row)
  }
  return map
}

/**
 * Get a signed URL for a user-uploaded PDF.
 */
export async function getUserPdfSignedUrl(storagePath: string): Promise<string | null> {
  return getRegulationPdfUrl(storagePath)
}

/**
 * Delete a user's uploaded PDF for a regulation.
 */
export async function deleteUserRegulationPdf(
  userId: string,
  regId: string,
  storagePath: string
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  // Remove from storage
  const { error: storageError } = await supabase.storage
    .from(USER_PDF_BUCKET)
    .remove([storagePath])

  if (storageError) {
    console.error('Failed to delete PDF from storage:', storageError.message)
  }

  // Remove database record
  const { error: dbError } = await supabase
    .from('user_regulation_pdfs')
    .delete()
    .eq('user_id', userId)
    .eq('reg_id', regId)

  if (dbError) {
    console.error('Failed to delete upload record:', dbError.message)
    return false
  }

  return true
}

function sanitizeStorageName(regId: string): string {
  return regId
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/,\s*/g, '-')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '-')
    .toLowerCase()
}
