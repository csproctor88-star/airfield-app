/**
 * User Documents Service
 *
 * Manages user-uploaded personal PDFs: upload, delete, list, cache,
 * text extraction, and sync. Completely separate from official regulations.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  idbSet,
  idbGet,
  idbGetAllKeys,
  idbDelete,
  STORE_USER_BLOBS,
  STORE_USER_TEXT,
} from './idb'

const BUCKET = 'user-uploads'

export interface UserDocument {
  id: string
  user_id: string
  file_name: string
  display_name: string
  file_size: number | null
  total_pages: number | null
  status: 'uploaded' | 'extracting' | 'ready' | 'failed'
  base_id: string | null
  notes: string | null
  uploaded_at: string
  extracted_at: string | null
}

export interface UserDocTextPage {
  page: number
  text: string
}

interface CachedUserText {
  pages: UserDocTextPage[]
  cachedAt: number
}

function sanitizeFileName(name: string): string {
  const ext = name.match(/\.(pdf|jpe?g|png)$/i)?.[0]?.toLowerCase() || '.pdf'
  const base = name
    .replace(/\.(pdf|jpe?g|png)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base + ext
}

function isImageFile(fileName: string): boolean {
  return /\.(jpg|jpeg|png)$/i.test(fileName)
}

export const userDocService = {
  /**
   * Upload a PDF, extract text, and cache for offline use.
   * Returns the created document row.
   */
  async upload(
    supabase: SupabaseClient,
    userId: string,
    file: File,
    onProgress?: (stage: string) => void,
  ): Promise<UserDocument> {
    const fileName = sanitizeFileName(file.name)
    const storagePath = `${userId}/${fileName}`

    // 1. Upload to Storage
    onProgress?.('Uploading...')
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { upsert: true, contentType: file.type })
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`)

    // 2. Read the file as ArrayBuffer for extraction + caching
    const arrayBuffer = await file.arrayBuffer()

    // 3. Insert metadata row
    onProgress?.('Saving metadata...')
    const { data: doc, error: insertErr } = await supabase
      .from('user_documents')
      .insert({
        user_id: userId,
        file_name: fileName,
        display_name: file.name.replace(/\.pdf$/i, ''),
        file_size: file.size,
        status: 'extracting',
      })
      .select()
      .single()
    if (insertErr) throw new Error(`Metadata insert failed: ${insertErr.message}`)

    // 4. Extract text client-side (PDFs only — images skip extraction)
    let pages: UserDocTextPage[] = []
    let totalPages = 0

    if (!isImageFile(fileName)) {
      onProgress?.('Extracting text...')
      try {
        const { pdfjs } = await import('react-pdf')
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise
        totalPages = pdf.numPages
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          const text = content.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ')
          pages.push({ page: i, text })
        }
      } catch (e) {
        console.warn('Text extraction failed:', e)
        await supabase
          .from('user_documents')
          .update({ status: 'failed', total_pages: totalPages || null })
          .eq('id', doc.id)
        await idbSet(STORE_USER_BLOBS, fileName, arrayBuffer).catch(() => {})
        return { ...doc, status: 'failed', total_pages: totalPages || null } as UserDocument
      }

      // 5. Insert extracted text into user_document_pages
      onProgress?.('Indexing pages...')
      for (let i = 0; i < pages.length; i += 50) {
        const batch = pages.slice(i, i + 50).map((p) => ({
          user_id: userId,
          document_id: doc.id,
          file_name: fileName,
          page_number: p.page,
          text_content: p.text,
        }))
        const { error: textErr } = await supabase
          .from('user_document_pages')
          .insert(batch)
        if (textErr) console.warn('Text insert batch failed:', textErr.message)
      }
    } else {
      totalPages = 1
    }

    // 6. Update status to ready
    await supabase
      .from('user_documents')
      .update({
        status: 'ready',
        total_pages: totalPages,
        extracted_at: new Date().toISOString(),
      })
      .eq('id', doc.id)

    // 7. Cache blob + text to IndexedDB for offline
    onProgress?.('Caching for offline...')
    await idbSet(STORE_USER_BLOBS, fileName, arrayBuffer).catch((e) =>
      console.warn('Failed to cache user blob:', e),
    )
    await idbSet(STORE_USER_TEXT, fileName, { pages, cachedAt: Date.now() } as CachedUserText).catch((e) =>
      console.warn('Failed to cache user text:', e),
    )

    onProgress?.('Done')
    return {
      ...doc,
      status: 'ready',
      total_pages: totalPages,
      extracted_at: new Date().toISOString(),
    } as UserDocument
  },

  /** Delete a user document from Storage, database, and IndexedDB. */
  async deleteDocument(
    supabase: SupabaseClient,
    userId: string,
    doc: UserDocument,
  ): Promise<void> {
    // Storage
    await supabase.storage
      .from(BUCKET)
      .remove([`${userId}/${doc.file_name}`])

    // Database (CASCADE deletes user_document_pages rows)
    await supabase.from('user_documents').delete().eq('id', doc.id)

    // IndexedDB
    await idbDelete(STORE_USER_BLOBS, doc.file_name).catch(() => {})
    await idbDelete(STORE_USER_TEXT, doc.file_name).catch(() => {})
  },

  /** List all documents for the current user. */
  async listDocuments(supabase: SupabaseClient): Promise<UserDocument[]> {
    const { data, error } = await supabase
      .from('user_documents')
      .select('*')
      .order('uploaded_at', { ascending: false })
    if (error) throw new Error(`Failed to list documents: ${error.message}`)
    return (data || []) as UserDocument[]
  },

  /** Cache a document's PDF blob to IndexedDB for offline viewing. */
  async cacheBlob(
    supabase: SupabaseClient,
    userId: string,
    fileName: string,
  ): Promise<boolean> {
    const storagePath = `${userId}/${fileName}`
    const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
    if (error || !data) return false
    const arrayBuffer = await data.arrayBuffer()
    await idbSet(STORE_USER_BLOBS, fileName, arrayBuffer)
    return true
  },

  /** Remove a document's cached blob from IndexedDB. */
  async uncacheBlob(fileName: string): Promise<void> {
    await idbDelete(STORE_USER_BLOBS, fileName)
  },

  /** Check which files are cached in IndexedDB. */
  async getCachedFileNames(): Promise<Set<string>> {
    const keys = await idbGetAllKeys(STORE_USER_BLOBS)
    return new Set(keys as string[])
  },

  /** Get a cached blob from IndexedDB. */
  async getCachedBlob(fileName: string): Promise<ArrayBuffer | null> {
    const cached = await idbGet<ArrayBuffer | Blob>(STORE_USER_BLOBS, fileName)
    if (!cached) return null
    return cached instanceof Blob ? cached.arrayBuffer() : cached
  },

  /**
   * Sync user document text from Supabase to IndexedDB.
   * Call on app startup when online.
   */
  async syncText(supabase: SupabaseClient): Promise<{ synced: number; skipped: number }> {
    if (!navigator.onLine) return { synced: 0, skipped: 0 }

    const { data: docs } = await supabase
      .from('user_documents')
      .select('id, file_name')
      .eq('status', 'ready')
    if (!docs?.length) return { synced: 0, skipped: 0 }

    const localKeys = new Set(await idbGetAllKeys(STORE_USER_TEXT))
    let synced = 0
    let skipped = 0

    for (const doc of docs) {
      if (localKeys.has(doc.file_name)) { skipped++; continue }

      const { data: rows } = await supabase
        .from('user_document_pages')
        .select('page_number, text_content')
        .eq('document_id', doc.id)
        .order('page_number', { ascending: true })

      if (rows?.length) {
        const pages: UserDocTextPage[] = rows.map((r: { page_number: number; text_content: string }) => ({
          page: r.page_number,
          text: r.text_content,
        }))
        await idbSet(STORE_USER_TEXT, doc.file_name, { pages, cachedAt: Date.now() } as CachedUserText)
        synced++
      }
    }

    return { synced, skipped }
  },
}
