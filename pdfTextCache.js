/**
 * ═══════════════════════════════════════════════════════════════
 * AOMS: PDF Text Cache Manager
 * ═══════════════════════════════════════════════════════════════
 *
 * Manages the offline text search index. On sync:
 *  1. Checks Supabase for pre-extracted text (pdf_text_pages table)
 *  2. Stores it in IndexedDB for offline full-text search
 *  3. Falls back to client-side PDF.js extraction if server text
 *     isn't available yet
 *
 * Usage in your component:
 *   import { textCache } from './pdfTextCache';
 *
 *   // Get text for a file (tries IndexedDB first, then Supabase, then extracts)
 *   const pages = await textCache.getTextForFile(supabase, fileName, pdfUint8Array);
 *
 *   // Sync all extracted text from server to IndexedDB
 *   await textCache.syncAllFromServer(supabase);
 *
 *   // Search across all cached text offline
 *   const results = await textCache.searchOffline("obstruction criteria");
 *
 *   // Search server-side across all PDFs (uses Postgres full-text search)
 *   const results = await textCache.searchServer(supabase, "obstruction criteria");
 */

import { pdfjs } from "react-pdf";

// ─── IndexedDB Setup ─────────────────────────────────────────
const DB_NAME = "aoms_pdf_cache";
const STORE_TEXT = "text_pages";   // { file_name, pages: [{ page, text }] }
const STORE_META = "text_meta";    // { file_name, status, total_pages, extracted_at }
const DB_VERSION = 3;              // Bump from 2 → 3 to add text stores

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      // Existing stores from PDFLibrary component
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      // New text stores
      if (!db.objectStoreNames.contains(STORE_TEXT)) db.createObjectStore(STORE_TEXT);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(store, key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAllKeys(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Client-side PDF.js text extraction (fallback) ───────────
async function extractTextWithPdfjs(uint8Array) {
  const loadingTask = pdfjs.getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    pages.push({ page: i, text });
  }
  return pages;
}

// ─── Text Cache API ──────────────────────────────────────────
export const textCache = {

  /**
   * Get text for a specific file. Priority:
   * 1. IndexedDB (instant, works offline)
   * 2. Supabase pdf_text_pages table (pre-extracted on server)
   * 3. Client-side PDF.js extraction (fallback, requires PDF data)
   *
   * After retrieval from server or extraction, caches to IndexedDB.
   */
  async getTextForFile(supabase, fileName, pdfUint8Array = null) {
    // 1. Try IndexedDB first
    const cached = await idbGet(STORE_TEXT, fileName);
    if (cached && cached.pages && cached.pages.length > 0) {
      return cached.pages; // [{ page, text }]
    }

    // 2. Try Supabase (if online)
    if (navigator.onLine && supabase) {
      try {
        const { data, error } = await supabase
          .from("pdf_text_pages")
          .select("page_number, text_content")
          .eq("file_name", fileName)
          .order("page_number", { ascending: true });

        if (!error && data && data.length > 0) {
          const pages = data.map((row) => ({
            page: row.page_number,
            text: row.text_content,
          }));

          // Cache to IndexedDB
          await idbSet(STORE_TEXT, fileName, { pages, source: "server", cachedAt: Date.now() });
          await idbSet(STORE_META, fileName, { status: "complete", totalPages: pages.length });

          return pages;
        }
      } catch (e) {
        console.warn("Server text fetch failed:", e);
      }
    }

    // 3. Fallback: extract client-side
    if (pdfUint8Array) {
      const pages = await extractTextWithPdfjs(pdfUint8Array);

      // Cache locally
      await idbSet(STORE_TEXT, fileName, { pages, source: "client", cachedAt: Date.now() });
      await idbSet(STORE_META, fileName, { status: "complete", totalPages: pages.length });

      // Also upload to Supabase if online (so next time it's pre-extracted)
      if (navigator.onLine && supabase) {
        this.uploadTextToServer(supabase, fileName, pages).catch((e) =>
          console.warn("Background text upload failed:", e)
        );
      }

      return pages;
    }

    return []; // No text available
  },

  /**
   * Upload client-extracted text to Supabase so it's available
   * for other users and for server-side search.
   */
  async uploadTextToServer(supabase, fileName, pages) {
    // Upsert pages in batches
    for (let i = 0; i < pages.length; i += 50) {
      const batch = pages.slice(i, i + 50).map((p) => ({
        file_name: fileName,
        page_number: p.page,
        text_content: p.text,
      }));

      await supabase
        .from("pdf_text_pages")
        .upsert(batch, { onConflict: "file_name,page_number" });
    }

    // Update extraction status
    await supabase.from("pdf_extraction_status").upsert({
      file_name: fileName,
      total_pages: pages.length,
      status: "complete",
      extracted_at: new Date().toISOString(),
    });
  },

  /**
   * Sync all pre-extracted text from Supabase to IndexedDB.
   * Call this during app startup or on a sync button.
   * Only downloads text for files not already cached locally.
   */
  async syncAllFromServer(supabase) {
    if (!navigator.onLine) return { synced: 0, skipped: 0 };

    // Get list of files with complete extraction on server
    const { data: serverFiles, error } = await supabase
      .from("pdf_extraction_status")
      .select("file_name, total_pages")
      .eq("status", "complete");

    if (error || !serverFiles) return { synced: 0, skipped: 0, error };

    // Check what's already cached locally
    const localKeys = new Set(await idbGetAllKeys(STORE_TEXT));

    let synced = 0;
    let skipped = 0;

    for (const file of serverFiles) {
      if (localKeys.has(file.file_name)) {
        skipped++;
        continue;
      }

      try {
        const { data: rows } = await supabase
          .from("pdf_text_pages")
          .select("page_number, text_content")
          .eq("file_name", file.file_name)
          .order("page_number", { ascending: true });

        if (rows && rows.length > 0) {
          const pages = rows.map((r) => ({ page: r.page_number, text: r.text_content }));
          await idbSet(STORE_TEXT, file.file_name, { pages, source: "server", cachedAt: Date.now() });
          await idbSet(STORE_META, file.file_name, { status: "complete", totalPages: pages.length });
          synced++;
        }
      } catch (e) {
        console.warn(`Sync failed for ${file.file_name}:`, e);
      }
    }

    return { synced, skipped };
  },

  /**
   * Search OFFLINE across all cached text in IndexedDB.
   * Returns matches with file name, page number, and context snippet.
   * This is a simple substring search — for ranked results, use searchServer.
   */
  async searchOffline(query, maxResults = 100) {
    if (!query || query.length < 2) return [];

    const allTextData = await idbGetAll(STORE_TEXT);
    const allKeys = await idbGetAllKeys(STORE_TEXT);
    const term = query.toLowerCase();
    const results = [];

    for (let i = 0; i < allKeys.length && results.length < maxResults; i++) {
      const fileName = allKeys[i];
      const data = allTextData[i];
      if (!data || !data.pages) continue;

      for (const page of data.pages) {
        if (results.length >= maxResults) break;
        const text = page.text;
        const lower = text.toLowerCase();
        let pos = 0;

        while ((pos = lower.indexOf(term, pos)) !== -1 && results.length < maxResults) {
          const start = Math.max(0, pos - 50);
          const end = Math.min(text.length, pos + term.length + 50);
          const snippet =
            (start > 0 ? "…" : "") +
            text.slice(start, end) +
            (end < text.length ? "…" : "");

          results.push({
            fileName,
            page: page.page,
            position: pos,
            snippet,
          });

          pos += 1;
        }
      }
    }

    return results;
  },

  /**
   * Search SERVER-SIDE using Postgres full-text search.
   * Uses the search_all_pdfs() SQL function for ranked results.
   * Falls back to offline search if not connected.
   */
  async searchServer(supabase, query, maxResults = 50) {
    if (!navigator.onLine) {
      return this.searchOffline(query, maxResults);
    }

    try {
      const { data, error } = await supabase.rpc("search_all_pdfs", {
        search_query: query,
        max_results: maxResults,
      });

      if (error) throw error;

      return (data || []).map((row) => ({
        fileName: row.file_name,
        page: row.page_number,
        headline: row.headline,  // HTML with <b> tags for highlighting
        rank: row.rank,
      }));
    } catch (e) {
      console.warn("Server search failed, falling back to offline:", e);
      return this.searchOffline(query, maxResults);
    }
  },

  /**
   * Search within a SINGLE PDF using server-side Postgres search.
   */
  async searchServerSinglePdf(supabase, fileName, query) {
    if (!navigator.onLine) {
      // Offline fallback: search just this file's cached text
      const cached = await idbGet(STORE_TEXT, fileName);
      if (!cached || !cached.pages) return [];

      const term = query.toLowerCase();
      const results = [];
      for (const page of cached.pages) {
        const lower = page.text.toLowerCase();
        let pos = 0;
        while ((pos = lower.indexOf(term, pos)) !== -1) {
          const s = Math.max(0, pos - 40);
          const e = Math.min(page.text.length, pos + term.length + 40);
          results.push({
            page: page.page,
            position: pos,
            snippet: (s > 0 ? "…" : "") + page.text.slice(s, e) + (e < page.text.length ? "…" : ""),
          });
          pos += 1;
        }
      }
      return results;
    }

    try {
      const { data, error } = await supabase.rpc("search_pdf", {
        target_file: fileName,
        search_query: query,
      });

      if (error) throw error;

      return (data || []).map((row) => ({
        page: row.page_number,
        headline: row.headline,
        rank: row.rank,
      }));
    } catch (e) {
      console.warn("Server single-pdf search failed:", e);
      return [];
    }
  },

  /**
   * Check extraction status for a file.
   */
  async getExtractionStatus(fileName) {
    return await idbGet(STORE_META, fileName);
  },

  /**
   * Get list of all files with cached text.
   */
  async getCachedFileNames() {
    return await idbGetAllKeys(STORE_TEXT);
  },

  /**
   * Clear cached text for a specific file.
   */
  async clearFile(fileName) {
    const db = await openDB();
    const tx = db.transaction([STORE_TEXT, STORE_META], "readwrite");
    tx.objectStore(STORE_TEXT).delete(fileName);
    tx.objectStore(STORE_META).delete(fileName);
    return new Promise((resolve) => { tx.oncomplete = resolve; });
  },

  /**
   * Clear all cached text.
   */
  async clearAll() {
    const db = await openDB();
    const tx = db.transaction([STORE_TEXT, STORE_META], "readwrite");
    tx.objectStore(STORE_TEXT).clear();
    tx.objectStore(STORE_META).clear();
    return new Promise((resolve) => { tx.oncomplete = resolve; });
  },
};

export default textCache;
