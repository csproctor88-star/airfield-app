/**
 * AOMS: PDF Text Cache Manager
 *
 * Manages the offline text search index:
 *  1. Checks Supabase for pre-extracted text (pdf_text_pages table)
 *  2. Stores it in IndexedDB for offline full-text search
 *  3. Falls back to client-side PDF.js extraction if server text isn't available
 */

import { pdfjs } from 'react-pdf'
import {
  idbSet,
  idbGet,
  idbGetAll,
  idbGetAllKeys,
  idbClear,
  STORE_TEXT,
  STORE_TEXT_META,
} from './idb'

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────

export interface TextPage {
  page: number
  text: string
}

interface CachedTextEntry {
  pages: TextPage[]
  source: 'server' | 'client'
  cachedAt: number
}

interface TextMetaEntry {
  status: 'complete' | 'extracting'
  totalPages: number
}

export interface OfflineSearchResult {
  fileName: string
  page: number
  position: number
  snippet: string
}

export interface ServerSearchResult {
  fileName: string
  page: number
  headline: string
  rank: number
}

// ── Client-side PDF.js text extraction ───────────────────────

async function extractTextWithPdfjs(uint8Array: Uint8Array): Promise<TextPage[]> {
  const loadingTask = pdfjs.getDocument({ data: uint8Array })
  const pdf = await loadingTask.promise
  const pages: TextPage[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push({ page: i, text })
  }
  return pages
}

// ── Text Cache API ───────────────────────────────────────────

export const textCache = {
  /**
   * Get text for a specific file. Priority:
   * 1. IndexedDB (instant, works offline)
   * 2. Supabase pdf_text_pages table (pre-extracted on server)
   * 3. Client-side PDF.js extraction (fallback, requires PDF data)
   */
  async getTextForFile(
    supabase: SupabaseClient | null,
    fileName: string,
    pdfUint8Array: Uint8Array | null = null,
  ): Promise<TextPage[]> {
    // 1. Try IndexedDB first
    const cached = await idbGet<CachedTextEntry>(STORE_TEXT, fileName)
    if (cached?.pages?.length) return cached.pages

    // 2. Try Supabase (if online)
    if (navigator.onLine && supabase) {
      try {
        const { data, error } = await supabase
          .from('pdf_text_pages')
          .select('page_number, text_content')
          .eq('file_name', fileName)
          .order('page_number', { ascending: true })

        if (!error && data?.length) {
          const pages: TextPage[] = data.map((row: { page_number: number; text_content: string }) => ({
            page: row.page_number,
            text: row.text_content,
          }))
          await idbSet(STORE_TEXT, fileName, { pages, source: 'server', cachedAt: Date.now() })
          await idbSet(STORE_TEXT_META, fileName, { status: 'complete', totalPages: pages.length })
          return pages
        }
      } catch (e) {
        console.warn('Server text fetch failed:', e)
      }
    }

    // 3. Fallback: extract client-side
    if (pdfUint8Array) {
      const pages = await extractTextWithPdfjs(pdfUint8Array)
      await idbSet(STORE_TEXT, fileName, { pages, source: 'client', cachedAt: Date.now() })
      await idbSet(STORE_TEXT_META, fileName, { status: 'complete', totalPages: pages.length })

      // Upload to Supabase in background
      if (navigator.onLine && supabase) {
        textCache.uploadTextToServer(supabase, fileName, pages).catch((e) =>
          console.warn('Background text upload failed:', e),
        )
      }
      return pages
    }

    return []
  },

  /** Upload client-extracted text to Supabase. */
  async uploadTextToServer(
    supabase: SupabaseClient,
    fileName: string,
    pages: TextPage[],
  ): Promise<void> {
    for (let i = 0; i < pages.length; i += 50) {
      const batch = pages.slice(i, i + 50).map((p) => ({
        file_name: fileName,
        page_number: p.page,
        text_content: p.text,
      }))
      await supabase
        .from('pdf_text_pages')
        .upsert(batch, { onConflict: 'file_name,page_number' })
    }

    await supabase.from('pdf_extraction_status').upsert({
      file_name: fileName,
      total_pages: pages.length,
      status: 'complete',
      extracted_at: new Date().toISOString(),
    })
  },

  /**
   * Sync all pre-extracted text from Supabase to IndexedDB.
   * Call this during app startup. Only downloads text not already cached locally.
   */
  async syncAllFromServer(
    supabase: SupabaseClient,
  ): Promise<{ synced: number; skipped: number; error?: unknown }> {
    if (!navigator.onLine) return { synced: 0, skipped: 0 }

    const { data: serverFiles, error } = await supabase
      .from('pdf_extraction_status')
      .select('file_name, total_pages')
      .eq('status', 'complete')

    if (error || !serverFiles) return { synced: 0, skipped: 0, error }

    const localKeys = new Set(await idbGetAllKeys(STORE_TEXT))
    let synced = 0
    let skipped = 0

    for (const file of serverFiles) {
      if (localKeys.has(file.file_name)) {
        skipped++
        continue
      }

      try {
        const { data: rows } = await supabase
          .from('pdf_text_pages')
          .select('page_number, text_content')
          .eq('file_name', file.file_name)
          .order('page_number', { ascending: true })

        if (rows?.length) {
          const pages: TextPage[] = rows.map((r: { page_number: number; text_content: string }) => ({
            page: r.page_number,
            text: r.text_content,
          }))
          await idbSet(STORE_TEXT, file.file_name, { pages, source: 'server', cachedAt: Date.now() })
          await idbSet(STORE_TEXT_META, file.file_name, { status: 'complete', totalPages: pages.length })
          synced++
        }
      } catch (e) {
        console.warn(`Sync failed for ${file.file_name}:`, e)
      }
    }

    return { synced, skipped }
  },

  /** Search OFFLINE across all cached text in IndexedDB. */
  async searchOffline(query: string, maxResults = 100): Promise<OfflineSearchResult[]> {
    if (!query || query.length < 2) return []

    const allTextData = await idbGetAll<CachedTextEntry>(STORE_TEXT)
    const allKeys = await idbGetAllKeys(STORE_TEXT)
    const term = query.toLowerCase()
    const results: OfflineSearchResult[] = []

    for (let i = 0; i < allKeys.length && results.length < maxResults; i++) {
      const fileName = allKeys[i] as string
      const data = allTextData[i]
      if (!data?.pages) continue

      for (const page of data.pages) {
        if (results.length >= maxResults) break
        const lower = page.text.toLowerCase()
        let pos = 0

        while ((pos = lower.indexOf(term, pos)) !== -1 && results.length < maxResults) {
          const start = Math.max(0, pos - 50)
          const end = Math.min(page.text.length, pos + term.length + 50)
          results.push({
            fileName,
            page: page.page,
            position: pos,
            snippet:
              (start > 0 ? '\u2026' : '') +
              page.text.slice(start, end) +
              (end < page.text.length ? '\u2026' : ''),
          })
          pos += 1
        }
      }
    }

    return results
  },

  /** Search server-side using Postgres full-text search. Falls back to offline. */
  async searchServer(
    supabase: SupabaseClient,
    query: string,
    maxResults = 50,
  ): Promise<ServerSearchResult[] | OfflineSearchResult[]> {
    if (!navigator.onLine) return textCache.searchOffline(query, maxResults)

    try {
      const { data, error } = await supabase.rpc('search_all_pdfs', {
        search_query: query,
        max_results: maxResults,
      })
      if (error) throw error
      return (data || []).map((row: { file_name: string; page_number: number; headline: string; rank: number }) => ({
        fileName: row.file_name,
        page: row.page_number,
        headline: row.headline,
        rank: row.rank,
      }))
    } catch (e) {
      console.warn('Server search failed, falling back to offline:', e)
      return textCache.searchOffline(query, maxResults)
    }
  },

  /** Get list of all files with cached text. */
  async getCachedFileNames(): Promise<string[]> {
    return (await idbGetAllKeys(STORE_TEXT)) as string[]
  },

  /** Clear all cached text. */
  async clearAll(): Promise<void> {
    await idbClear([STORE_TEXT, STORE_TEXT_META])
  },
}

export default textCache
