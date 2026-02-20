/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  AOMS — Regulation PDF Library (Integrated)                     ║
 * ║  Supabase Storage + Pre-extracted Text + Offline Cache          ║
 * ║                                                                  ║
 * ║  Features:                                                       ║
 * ║  • Extract All — one-time text extraction, stored in Supabase   ║
 * ║  • Offline search from IndexedDB cached text                    ║
 * ║  • Cross-PDF search across all regulations                      ║
 * ║  • Native iframe viewer (desktop) / react-pdf scroll (mobile)   ║
 * ║  • Lazy page rendering for large documents                      ║
 * ║  • Platform-aware auto mode selection                           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 *  SETUP:
 *  npm install react-pdf
 *  cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
 *
 *  next.config.js:
 *  module.exports = {
 *    webpack: (config) => {
 *      config.resolve.alias.canvas = false;
 *      return config;
 *    },
 *  };
 *
 *  layout.tsx or _app.tsx:
 *  import "react-pdf/dist/Page/AnnotationLayer.css";
 *  import "react-pdf/dist/Page/TextLayer.css";
 *
 *  REQUIRED: Run 001_pdf_text_search.sql migration in Supabase
 */

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// ─── Worker — local file from public/ ────────────────────────
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// ─── Config ──────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET_NAME = "regulation-pdfs";

// ─── Platform detection ──────────────────────────────────────
function getDefaultViewMode() {
  if (typeof navigator === "undefined") return "react-pdf";
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /ipad|iphone|ipod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(ua);
  return (isIOS || isAndroid) ? "react-pdf" : "native";
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /ipad|iphone|ipod|android/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// ─── Supabase Client ─────────────────────────────────────────
function createSupabaseClient(url, key) {
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  return {
    storage: {
      from(bucket) {
        return {
          async list(folder = "", options = {}) {
            const res = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({
                prefix: folder,
                limit: options.limit || 1000,
                offset: options.offset || 0,
                sortBy: { column: "name", order: "asc" },
              }),
            });
            if (!res.ok) throw new Error(`List failed: ${res.statusText}`);
            return { data: await res.json(), error: null };
          },
          async download(path) {
            const res = await fetch(
              `${url}/storage/v1/object/${bucket}/${encodeURIComponent(path)}`,
              { headers }
            );
            if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
            return { data: await res.blob(), error: null };
          },
        };
      },
    },
    from(table) {
      let query = { table, filters: [], selects: "*", orderCol: null, orderAsc: true };
      const chain = {
        select(cols = "*") { query.selects = cols; return chain; },
        eq(col, val) { query.filters.push({ col, op: "eq", val }); return chain; },
        order(col, opts = {}) { query.orderCol = col; query.orderAsc = opts.ascending !== false; return chain; },
        async then(resolve) {
          let url2 = `${url}/rest/v1/${query.table}?select=${encodeURIComponent(query.selects)}`;
          for (const f of query.filters) url2 += `&${f.col}=${f.op}.${encodeURIComponent(f.val)}`;
          if (query.orderCol) url2 += `&order=${query.orderCol}.${query.orderAsc ? "asc" : "desc"}`;
          const res = await fetch(url2, { headers: { ...headers, "Content-Type": "application/json" } });
          if (!res.ok) return resolve({ data: null, error: { message: res.statusText } });
          return resolve({ data: await res.json(), error: null });
        },
      };
      // Upsert support
      chain.upsert = async (rows, opts = {}) => {
        const prefer = opts.onConflict
          ? `resolution=merge-duplicates,on_conflict=${opts.onConflict}`
          : "resolution=merge-duplicates";
        const res = await fetch(`${url}/rest/v1/${table}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json", Prefer: prefer },
          body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
        });
        if (!res.ok) return { data: null, error: { message: res.statusText } };
        return { data: null, error: null };
      };
      chain.insert = async (rows) => {
        const res = await fetch(`${url}/rest/v1/${table}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
        });
        if (!res.ok) return { data: null, error: { message: res.statusText } };
        return { data: null, error: null };
      };
      chain.delete = () => {
        const delChain = {
          eq(col, val) { query.filters.push({ col, op: "eq", val }); return delChain; },
          async then(resolve) {
            let url2 = `${url}/rest/v1/${query.table}?`;
            url2 += query.filters.map(f => `${f.col}=${f.op}.${encodeURIComponent(f.val)}`).join("&");
            const res = await fetch(url2, { method: "DELETE", headers });
            return resolve({ error: res.ok ? null : { message: res.statusText } });
          },
        };
        return delChain;
      };
      return chain;
    },
    rpc: async (fnName, params = {}) => {
      const res = await fetch(`${url}/rest/v1/rpc/${fnName}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) return { data: null, error: { message: res.statusText } };
      return { data: await res.json(), error: null };
    },
  };
}

const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── IndexedDB ───────────────────────────────────────────────
const DB_NAME = "aoms_pdf_cache";
const DB_VERSION = 3;
const STORE_BLOBS = "blobs";
const STORE_META = "meta";
const STORE_TEXT = "text_pages";
const STORE_TEXT_META = "text_meta";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_BLOBS)) db.createObjectStore(STORE_BLOBS);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
      if (!db.objectStoreNames.contains(STORE_TEXT)) db.createObjectStore(STORE_TEXT);
      if (!db.objectStoreNames.contains(STORE_TEXT_META)) db.createObjectStore(STORE_TEXT_META);
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

async function idbDelete(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Text extraction with PDF.js ─────────────────────────────
async function extractTextFromBuffer(arrayBuffer) {
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
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

// ─── Utilities ───────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes) return "\u2014";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderSnippet(snippet, term) {
  if (!term) return snippet;
  const parts = [];
  const lower = snippet.toLowerCase();
  const tLower = term.toLowerCase();
  let idx = 0, pos;
  while ((pos = lower.indexOf(tLower, idx)) !== -1) {
    if (pos > idx) parts.push(snippet.slice(idx, pos));
    parts.push(
      <mark key={"m" + pos} style={{ background: "rgba(250,204,21,0.4)", color: "#FDE68A", borderRadius: 2, padding: "0 1px" }}>
        {snippet.slice(pos, pos + term.length)}
      </mark>
    );
    idx = pos + term.length;
  }
  if (idx < snippet.length) parts.push(snippet.slice(idx));
  return parts;
}

// ─── LazyPage Component ──────────────────────────────────────
function LazyPage({ pageNumber, scale, searchTerm }) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setHasRendered(true);
        } else {
          setIsVisible(false);
        }
      },
      { rootMargin: "1200px" }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Highlight search matches after render
  const onRender = useCallback(() => {
    if (!searchTerm || searchTerm.length < 2 || !ref.current) return;
    setTimeout(() => {
      const layer = ref.current?.querySelector(".react-pdf__Page__textContent");
      if (!layer) return;
      const spans = layer.querySelectorAll("span");
      const term = searchTerm.toLowerCase();
      spans.forEach((span) => {
        if (span.dataset.orig) { span.innerHTML = span.dataset.orig; delete span.dataset.orig; }
      });
      spans.forEach((span) => {
        const text = span.textContent;
        if (!text) return;
        const lower = text.toLowerCase();
        if (!lower.includes(term)) return;
        span.dataset.orig = span.innerHTML;
        let result = "", i = 0, p;
        while ((p = lower.indexOf(term, i)) !== -1) {
          result += escapeHtml(text.slice(i, p));
          result += '<mark style="background:rgba(250,204,21,0.5);color:inherit;border-radius:2px;padding:0 1px">' + escapeHtml(text.slice(p, p + term.length)) + "</mark>";
          i = p + term.length;
        }
        result += escapeHtml(text.slice(i));
        span.innerHTML = result;
      });
    }, 150);
  }, [searchTerm]);

  return (
    <div ref={ref} style={{ marginBottom: 12, position: "relative" }} id={`pdf-page-${pageNumber}`}>
      <div style={{
        position: "absolute", top: 6, right: 10, zIndex: 10,
        fontSize: 10, fontWeight: 700, color: "#64748B",
        background: "rgba(15,23,42,0.85)", padding: "2px 8px",
        borderRadius: 4, fontFamily: "'JetBrains Mono', monospace",
      }}>
        {pageNumber}
      </div>
      {(isVisible || hasRendered) ? (
        <Page
          pageNumber={pageNumber}
          scale={scale}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          onRenderSuccess={onRender}
        />
      ) : (
        <div style={{
          height: Math.round(1056 * scale),
          background: "#1E293B",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#475569",
          fontSize: 12,
        }}>
          Page {pageNumber}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
export default function PDFLibrary() {
  // File list
  const [files, setFiles] = useState([]);
  const [cachedKeys, setCachedKeys] = useState(new Set());
  const [extractedKeys, setExtractedKeys] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(new Set());
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [error, setError] = useState(null);
  const [listSearch, setListSearch] = useState("");

  // Extraction
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0, fileName: "" });

  // Cross-PDF search
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalResults, setGlobalResults] = useState([]);
  const [globalSearching, setGlobalSearching] = useState(false);

  // Viewer
  const [viewingFile, setViewingFile] = useState(null);
  const [masterBuffer, setMasterBuffer] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const blobUrlRef = useRef(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(isMobileDevice() ? 0.8 : 1.2);
  const [viewMode, setViewMode] = useState(getDefaultViewMode);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  // In-document search
  const [docSearchOpen, setDocSearchOpen] = useState(false);
  const [docSearchTerm, setDocSearchTerm] = useState("");
  const [docMatches, setDocMatches] = useState([]);
  const [docMatchIdx, setDocMatchIdx] = useState(0);
  const [docPageTexts, setDocPageTexts] = useState([]);

  const searchInputRef = useRef(null);
  const viewerBodyRef = useRef(null);

  // ── Request persistent storage (prevent IndexedDB eviction) ──
  useEffect(() => {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then((granted) => {
        console.log("Persistent storage:", granted ? "granted" : "denied");
      });
    }
  }, []);

  // ── Online/offline ──
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // ── Cache helpers ──
  const refreshCache = useCallback(async () => {
    try {
      setCachedKeys(new Set(await idbGetAllKeys(STORE_BLOBS)));
      setExtractedKeys(new Set(await idbGetAllKeys(STORE_TEXT)));
    } catch (e) { console.error(e); }
  }, []);

  // ── Fetch file list ──
  const fetchFileList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (navigator.onLine) {
        const { data, error: e } = await supabase.storage.from(BUCKET_NAME).list("", { limit: 500 });
        if (e) throw e;
        const pdfs = (data || []).filter((f) => f.name && f.name.toLowerCase().endsWith(".pdf") && f.id);
        setFiles(pdfs);
        await idbSet(STORE_META, "file_list", JSON.stringify(pdfs));
      } else {
        const cached = await idbGet(STORE_META, "file_list");
        if (cached) setFiles(JSON.parse(cached));
        else { const keys = await idbGetAllKeys(STORE_BLOBS); setFiles(keys.map((k) => ({ name: k, id: k, metadata: {} }))); }
      }
    } catch (e) {
      setError(e.message);
      const cached = await idbGet(STORE_META, "file_list");
      if (cached) setFiles(JSON.parse(cached));
    } finally { setLoading(false); }
    await refreshCache();
  }, [refreshCache]);

  useEffect(() => { fetchFileList(); }, [fetchFileList]);

  // ── Sync pre-extracted text from Supabase on startup ──
  useEffect(() => {
    if (!isOnline) return;
    (async () => {
      try {
        const { data: serverFiles } = await supabase
          .from("pdf_extraction_status")
          .select("file_name,total_pages")
          .eq("status", "complete");
        if (!serverFiles) return;

        const localKeys = new Set(await idbGetAllKeys(STORE_TEXT));
        for (const file of serverFiles) {
          if (localKeys.has(file.file_name)) continue;
          const { data: rows } = await supabase
            .from("pdf_text_pages")
            .select("page_number,text_content")
            .eq("file_name", file.file_name)
            .order("page_number", { ascending: true });
          if (rows && rows.length > 0) {
            const pages = rows.map((r) => ({ page: r.page_number, text: r.text_content }));
            await idbSet(STORE_TEXT, file.file_name, { pages, source: "server", cachedAt: Date.now() });
          }
        }
        await refreshCache();
      } catch (e) { console.warn("Text sync:", e); }
    })();
  }, [isOnline, refreshCache]);

  // ── Download & cache PDF blob ──
  const downloadAndCache = useCallback(async (fileName) => {
    setDownloading((p) => new Set([...p, fileName]));
    try {
      const { data: blob, error: e } = await supabase.storage.from(BUCKET_NAME).download(fileName);
      if (e) throw e;
      const arrayBuffer = await blob.arrayBuffer();
      await idbSet(STORE_BLOBS, fileName, arrayBuffer);
      await refreshCache();
    } catch (e) { setError("Download failed: " + e.message); }
    finally { setDownloading((p) => { const n = new Set(p); n.delete(fileName); return n; }); }
  }, [refreshCache]);

  // ── Cache All PDFs ──
  const cacheAll = useCallback(async () => {
    for (const f of files.filter((f) => !cachedKeys.has(f.name))) {
      await downloadAndCache(f.name);
    }
  }, [files, cachedKeys, downloadAndCache]);

  // ═══════════════════════════════════════════════════════════
  // EXTRACT ALL — download each PDF, extract text, store in
  // Supabase + IndexedDB. One-time operation.
  // ═══════════════════════════════════════════════════════════
  const extractAll = useCallback(async () => {
    if (extracting) return;
    setExtracting(true);
    const toProcess = files.filter((f) => !extractedKeys.has(f.name));
    setExtractProgress({ current: 0, total: toProcess.length, fileName: "" });

    for (let i = 0; i < toProcess.length; i++) {
      const fileName = toProcess[i].name;
      setExtractProgress({ current: i + 1, total: toProcess.length, fileName });

      try {
        // Get PDF data (from cache or download)
        let arrayBuffer = await idbGet(STORE_BLOBS, fileName);
        if (!arrayBuffer && navigator.onLine) {
          const { data: blob, error: e } = await supabase.storage.from(BUCKET_NAME).download(fileName);
          if (e) throw e;
          arrayBuffer = await blob.arrayBuffer();
          await idbSet(STORE_BLOBS, fileName, arrayBuffer);
        }
        if (!arrayBuffer) { console.warn("Skip (no data):", fileName); continue; }

        // Extract text with PDF.js
        const pages = await extractTextFromBuffer(arrayBuffer);

        // Store in IndexedDB
        await idbSet(STORE_TEXT, fileName, { pages, source: "client", cachedAt: Date.now() });

        // Upload to Supabase if online
        if (navigator.onLine) {
          // Delete existing rows
          await supabase.from("pdf_text_pages").delete().eq("file_name", fileName);

          // Insert in batches of 50
          for (let j = 0; j < pages.length; j += 50) {
            const batch = pages.slice(j, j + 50).map((p) => ({
              file_name: fileName,
              page_number: p.page,
              text_content: p.text,
            }));
            await supabase.from("pdf_text_pages").insert(batch);
          }

          // Update extraction status
          await supabase.from("pdf_extraction_status").upsert({
            file_name: fileName,
            total_pages: pages.length,
            status: "complete",
            extracted_at: new Date().toISOString(),
          }, { onConflict: "file_name" });
        }
      } catch (e) {
        console.error("Extract failed:", fileName, e);
      }
    }

    await refreshCache();
    setExtracting(false);
    setExtractProgress({ current: 0, total: 0, fileName: "" });
  }, [files, extractedKeys, extracting, refreshCache]);

  // ═══════════════════════════════════════════════════════════
  // CROSS-PDF SEARCH
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!globalSearch || globalSearch.length < 2) { setGlobalResults([]); return; }

    const timer = setTimeout(async () => {
      setGlobalSearching(true);
      try {
        if (navigator.onLine) {
          // Use Postgres full-text search
          const { data, error: e } = await supabase.rpc("search_all_pdfs", {
            search_query: globalSearch,
            max_results: 50,
          });
          if (!e && data) {
            setGlobalResults(data.map((r) => ({
              fileName: r.file_name,
              page: r.page_number,
              snippet: r.headline?.replace(/<b>/g, "").replace(/<\/b>/g, "") || "",
              rank: r.rank,
            })));
          } else {
            // Fallback to offline
            await searchOffline();
          }
        } else {
          await searchOffline();
        }
      } catch (e) { console.warn("Search:", e); await searchOffline(); }
      finally { setGlobalSearching(false); }

      async function searchOffline() {
        const allData = await idbGetAll(STORE_TEXT);
        const allKeys = await idbGetAllKeys(STORE_TEXT);
        const term = globalSearch.toLowerCase();
        const results = [];
        for (let i = 0; i < allKeys.length && results.length < 50; i++) {
          const d = allData[i];
          if (!d || !d.pages) continue;
          for (const pg of d.pages) {
            if (results.length >= 50) break;
            const lower = pg.text.toLowerCase();
            const pos = lower.indexOf(term);
            if (pos === -1) continue;
            const s = Math.max(0, pos - 40);
            const e = Math.min(pg.text.length, pos + term.length + 40);
            results.push({
              fileName: allKeys[i],
              page: pg.page,
              snippet: (s > 0 ? "\u2026" : "") + pg.text.slice(s, e) + (e < pg.text.length ? "\u2026" : ""),
            });
          }
        }
        setGlobalResults(results);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [globalSearch]);

  // ═══════════════════════════════════════════════════════════
  // OPEN PDF VIEWER
  // ═══════════════════════════════════════════════════════════
  const viewPdf = useCallback(async (fileName) => {
    setPdfLoading(true); setPdfError(null); setMasterBuffer(null);
    setNumPages(null); setCurrentPage(1); setViewingFile(fileName);
    setDocSearchOpen(false); setDocSearchTerm(""); setDocMatches([]);
    setDocPageTexts([]); setDocMatchIdx(0);

    try {
      let arrayBuffer = await idbGet(STORE_BLOBS, fileName);
      if (arrayBuffer instanceof Blob) arrayBuffer = await arrayBuffer.arrayBuffer();

      if (!arrayBuffer && navigator.onLine) {
        const { data: blob, error: e } = await supabase.storage.from(BUCKET_NAME).download(fileName);
        if (e) throw e;
        arrayBuffer = await blob.arrayBuffer();
        await idbSet(STORE_BLOBS, fileName, arrayBuffer);
        await refreshCache();
      }
      if (!arrayBuffer) { setPdfError("PDF not available offline."); setPdfLoading(false); return; }

      setMasterBuffer(arrayBuffer);

      // Native mode — create blob URL
      if (getDefaultViewMode() === "native") {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(new Blob([arrayBuffer.slice(0)], { type: "application/pdf" }));
        blobUrlRef.current = url;
        setBlobUrl(url);
        setViewMode("native");
      } else {
        setViewMode("react-pdf");
      }

      // Load pre-extracted text for in-doc search (from IndexedDB first)
      const cachedText = await idbGet(STORE_TEXT, fileName);
      if (cachedText && cachedText.pages) {
        setDocPageTexts(cachedText.pages);
      }
    } catch (e) { setPdfError("Failed: " + e.message); }
    finally { setPdfLoading(false); }
  }, [refreshCache]);

  // ── Close viewer ──
  const closeViewer = useCallback(() => {
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    setBlobUrl(null); setMasterBuffer(null);
    setViewingFile(null); setNumPages(null); setCurrentPage(1);
    setPdfError(null); setViewMode(getDefaultViewMode);
    setDocSearchOpen(false); setDocSearchTerm(""); setDocMatches([]); setDocPageTexts([]);
  }, []);

  // ── Toggle view mode ──
  const toggleViewMode = useCallback(() => {
    if (viewMode === "native") {
      setViewMode("react-pdf");
    } else {
      if (masterBuffer) {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(new Blob([masterBuffer.slice(0)], { type: "application/pdf" }));
        blobUrlRef.current = url;
        setBlobUrl(url);
      }
      setViewMode("native");
    }
  }, [viewMode, masterBuffer]);

  // ── Remove from cache ──
  const removeFromCache = useCallback(async (fileName) => {
    await idbDelete(STORE_BLOBS, fileName);
    await refreshCache();
  }, [refreshCache]);

  // ── react-pdf file data (always a fresh copy) ──
  const fileData = useMemo(() => {
    if (!masterBuffer) return null;
    return { data: masterBuffer.slice(0) };
  }, [masterBuffer]);

  function onDocumentLoadSuccess({ numPages: n }) { setNumPages(n); }
  function onDocumentLoadError(err) {
    console.error("react-pdf:", err);
    setPdfError("Render failed: " + err.message);
  }

  // ═══════════════════════════════════════════════════════════
  // IN-DOCUMENT SEARCH (from pre-extracted text)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!docSearchTerm || docSearchTerm.length < 2 || docPageTexts.length === 0) {
      setDocMatches([]); setDocMatchIdx(0); return;
    }
    const term = docSearchTerm.toLowerCase();
    const found = [];
    for (const pt of docPageTexts) {
      const text = pt.text.toLowerCase();
      let startIdx = 0, pos;
      while ((pos = text.indexOf(term, startIdx)) !== -1) {
        const s = Math.max(0, pos - 40);
        const e = Math.min(pt.text.length, pos + term.length + 40);
        found.push({
          page: pt.page, position: pos,
          snippet: (s > 0 ? "\u2026" : "") + pt.text.slice(s, e) + (e < pt.text.length ? "\u2026" : ""),
        });
        startIdx = pos + 1;
      }
    }
    setDocMatches(found);
    setDocMatchIdx(found.length > 0 ? 0 : -1);
    // Jump to first match page
    if (found.length > 0 && viewMode === "react-pdf") {
      const el = document.getElementById(`pdf-page-${found[0].page}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [docSearchTerm, docPageTexts, viewMode]);

  const goToDocMatch = useCallback((dir) => {
    if (docMatches.length === 0) return;
    const next = dir === "next"
      ? (docMatchIdx + 1) % docMatches.length
      : (docMatchIdx - 1 + docMatches.length) % docMatches.length;
    setDocMatchIdx(next);
    const pg = docMatches[next].page;
    if (viewMode === "react-pdf") {
      const el = document.getElementById(`pdf-page-${pg}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setCurrentPage(pg);
  }, [docMatches, docMatchIdx, viewMode]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!viewingFile) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setDocSearchOpen(true);
        setTimeout(() => searchInputRef.current && searchInputRef.current.focus(), 50);
        return;
      }
      if (e.key === "Escape") {
        if (docSearchOpen) { setDocSearchOpen(false); setDocSearchTerm(""); setDocMatches([]); }
        else closeViewer();
        return;
      }
      if (e.key === "Enter" && docSearchOpen) {
        e.preventDefault();
        goToDocMatch(e.shiftKey ? "prev" : "next");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewingFile, docSearchOpen, goToDocMatch, closeViewer]);

  // ── Derived ──
  const filtered = files.filter((f) => f.name.toLowerCase().includes(listSearch.toLowerCase()));
  const cachedCount = files.filter((f) => cachedKeys.has(f.name)).length;
  const extractedCount = files.filter((f) => extractedKeys.has(f.name)).length;
  const pagesWithMatches = useMemo(() => { const s = new Set(); docMatches.forEach((m) => s.add(m.page)); return s; }, [docMatches]);

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerRow}>
          <div style={S.hLeft}>
            <div style={S.logo}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            </div>
            <div>
              <h1 style={S.title}>Regulation Library</h1>
              <p style={S.sub}>{files.length} reg{files.length !== 1 ? "s" : ""} &middot; {cachedCount} cached &middot; {extractedCount} indexed</p>
            </div>
          </div>
          <div style={Object.assign({}, S.badge, isOnline ? S.badgeOn : S.badgeOff)}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: isOnline ? "#34D399" : "#FBBF24" }} />
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>
      </header>

      {/* ── File List Mode ── */}
      {!viewingFile && (
        <>
          {/* Toolbar */}
          <div style={S.toolbar}>
            <div style={S.sWrap}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Search across all regulations..." value={globalSearch || listSearch}
                onChange={(e) => {
                  const v = e.target.value;
                  setListSearch(v);
                  setGlobalSearch(extractedCount > 0 ? v : "");
                }}
                style={S.sInput} />
              {globalSearching && <span style={Object.assign({}, S.miniSpin, { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" })} />}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={fetchFileList} disabled={!isOnline || loading} style={Object.assign({}, S.btn, S.btnG, (!isOnline || loading) ? S.off : {})}>&#8635; Refresh</button>
              <button onClick={cacheAll} disabled={!isOnline || cachedCount === files.length} style={Object.assign({}, S.btn, S.btnA, (!isOnline || cachedCount === files.length) ? S.off : {})}>&darr; Cache All</button>
              <button onClick={extractAll} disabled={extracting || (!isOnline && extractedCount === files.length)}
                style={Object.assign({}, S.btn, S.btnE, (extracting) ? S.off : {})}>
                {extracting ? `Extracting ${extractProgress.current}/${extractProgress.total}...` : `\u2699 Extract All${extractedCount > 0 ? ` (${extractedCount}/${files.length})` : ""}`}
              </button>
            </div>
          </div>

          {/* Extraction progress */}
          {extracting && (
            <div style={S.progressBar}>
              <div style={Object.assign({}, S.progressFill, { width: `${(extractProgress.current / extractProgress.total) * 100}%` })} />
              <span style={S.progressText}>Extracting: {extractProgress.fileName}</span>
            </div>
          )}

          {/* Global search results */}
          {globalResults.length > 0 && globalSearch.length >= 2 && (
            <div style={S.globalResults}>
              <div style={S.globalHeader}>
                <span style={{ fontWeight: 700, color: "#E2E8F0", fontSize: 13 }}>Search Results</span>
                <span style={{ color: "#64748B", fontSize: 12 }}>{globalResults.length} match{globalResults.length !== 1 ? "es" : ""} across regulations</span>
              </div>
              <div style={S.globalList}>
                {globalResults.slice(0, 30).map((r, i) => (
                  <button key={i} onClick={() => viewPdf(r.fileName)}
                    style={S.globalItem}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={S.gBadge}>p.{r.page}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#CBD5E1", marginBottom: 2 }}>{r.fileName}</div>
                        <div style={S.gSnippet}>{renderSnippet(r.snippet, globalSearch)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {error && <div style={S.err}><span>{error}</span><button onClick={() => setError(null)} style={S.errX}>&times;</button></div>}

      <div style={S.main}>
        {viewingFile ? (
          // ═══════════════════ PDF VIEWER ═══════════════════
          <div style={S.viewer}>
            {/* Viewer bar */}
            <div style={S.vBar}>
              <button onClick={closeViewer} style={S.back}>&larr; Back</button>
              <span style={S.vName}>{viewingFile}</span>
              <div style={S.vCtrls}>
                {/* Search button (react-pdf mode) */}
                {viewMode === "react-pdf" && (
                  <button onClick={() => { setDocSearchOpen((o) => !o); setTimeout(() => searchInputRef.current && searchInputRef.current.focus(), 50); }}
                    style={Object.assign({}, S.cb, docSearchOpen ? { background: "rgba(56,189,248,0.15)", borderColor: "rgba(56,189,248,0.3)", color: "#38BDF8" } : {})}
                    title="Search (Ctrl+F)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  </button>
                )}
                {/* Mode toggle (desktop only) */}
                {!isMobileDevice() && (
                  <>
                    <div style={S.div} />
                    <button onClick={toggleViewMode} style={S.cb}
                      title={viewMode === "native" ? "Switch to scroll view" : "Switch to full document"}>
                      {viewMode === "native" ? "\u229E" : "\u2630"}
                    </button>
                  </>
                )}
                {/* Zoom (react-pdf mode) */}
                {viewMode === "react-pdf" && (
                  <>
                    <div style={S.div} />
                    <button onClick={() => setScale((s) => Math.max(0.4, s - 0.2))} style={S.cb}>&minus;</button>
                    <span style={S.zoom}>{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale((s) => Math.min(3, s + 0.2))} style={S.cb}>+</button>
                  </>
                )}
              </div>
            </div>

            {/* In-document search panel (react-pdf mode) */}
            {docSearchOpen && viewMode === "react-pdf" && (
              <div style={S.sPanel}>
                <div style={S.sPanelRow}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input ref={searchInputRef} type="text"
                    placeholder={docPageTexts.length === 0 ? "No text index \u2014 run Extract first" : "Search in document..."}
                    value={docSearchTerm} onChange={(e) => setDocSearchTerm(e.target.value)}
                    disabled={docPageTexts.length === 0} style={S.sPanelIn} />
                  {docMatches.length > 0 && <span style={S.mc}>{docMatchIdx + 1} of {docMatches.length}</span>}
                  {docSearchTerm.length >= 2 && docMatches.length === 0 && docPageTexts.length > 0 && <span style={Object.assign({}, S.mc, { color: "#F87171" })}>No matches</span>}
                  <button onClick={() => goToDocMatch("prev")} disabled={docMatches.length === 0} style={Object.assign({}, S.nb, docMatches.length === 0 ? S.off : {})}>&uarr;</button>
                  <button onClick={() => goToDocMatch("next")} disabled={docMatches.length === 0} style={Object.assign({}, S.nb, docMatches.length === 0 ? S.off : {})}>&darr;</button>
                  <button onClick={() => { setDocSearchOpen(false); setDocSearchTerm(""); setDocMatches([]); }} style={S.nb}>&times;</button>
                </div>
                {docMatches.length > 0 && docSearchTerm.length >= 2 && (
                  <div style={S.mList}>
                    {docMatches.slice(0, 60).map((m, i) => (
                      <button key={m.page + "-" + m.position} onClick={() => {
                        setDocMatchIdx(i);
                        const el = document.getElementById("pdf-page-" + m.page);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                        style={Object.assign({}, S.mItem, i === docMatchIdx ? S.mItemA : {})}>
                        <span style={S.mBadge}>p.{m.page}</span>
                        <span style={S.mSnip}>{renderSnippet(m.snippet, docSearchTerm)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Viewer body */}
            <div ref={viewerBodyRef} style={S.vBody}>
              {pdfLoading && <div style={S.ctr}><span style={S.spin} /><span style={{ color: "#64748B", marginLeft: 8 }}>Loading&hellip;</span></div>}
              {pdfError && <div style={S.ctr}><div style={S.eBox}><strong style={{ color: "#EF4444" }}>PDF Unavailable</strong><p style={{ margin: "8px 0 0", fontSize: 13 }}>{pdfError}</p></div></div>}

              {!pdfLoading && !pdfError && viewMode === "native" && blobUrl && (
                <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
                  <iframe src={blobUrl} title={viewingFile}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", background: "#FFF" }} />
                </div>
              )}

              {!pdfLoading && !pdfError && viewMode === "react-pdf" && fileData && (
                <Document file={fileData} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError}
                  loading={<div style={S.ctr}><span style={S.spin} /></div>}>
                  {numPages && Array.from({ length: numPages }, function(_, i) {
                    return (
                      <LazyPage key={"p" + (i + 1)} pageNumber={i + 1} scale={scale} searchTerm={docSearchTerm} />
                    );
                  })}
                </Document>
              )}
            </div>
          </div>
        ) : loading ? (
          <div style={S.ctr}><span style={S.spin} /><span style={{ color: "#64748B", marginLeft: 8 }}>Loading&hellip;</span></div>
        ) : filtered.length === 0 && !globalResults.length ? (
          <div style={Object.assign({}, S.ctr, { flexDirection: "column", padding: 80 })}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            <p style={{ color: "#94A3B8", marginTop: 12, fontWeight: 600 }}>{listSearch ? "No matching files" : "No PDFs found"}</p>
          </div>
        ) : (
          // ═══════════════════ FILE LIST ═══════════════════
          !globalResults.length && (
            <div style={S.list}>
              {filtered.map(function(file) {
                var cached = cachedKeys.has(file.name);
                var extracted = extractedKeys.has(file.name);
                var isDl = downloading.has(file.name);
                return (
                  <div key={file.name} style={S.row}
                    onMouseEnter={function(e) { e.currentTarget.style.background = "#1E293B"; e.currentTarget.style.borderColor = "#334155"; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#1E293B"; }}>
                    <button onClick={() => viewPdf(file.name)} disabled={!cached && !isOnline} style={S.fBtn}>
                      <div style={Object.assign({}, S.fIco, { borderColor: cached ? "rgba(52,211,153,0.25)" : "rgba(100,116,139,0.25)", color: cached ? "#34D399" : "#64748B" })}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                      </div>
                      <div style={S.fInf}>
                        <span style={S.fNm}>{file.name}</span>
                        <span style={S.fMt}>
                          {formatBytes(file.metadata && file.metadata.size)}
                          {file.created_at ? " \u00B7 " + formatDate(file.created_at) : ""}
                          {cached ? " \u00B7 Cached" : ""}
                          {extracted ? " \u00B7 Indexed" : ""}
                        </span>
                      </div>
                    </button>
                    <div style={S.fAct}>
                      {cached && <span style={{ color: "#34D399", display: "flex" }} title="Cached"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg></span>}
                      {extracted && <span style={{ color: "#FACC15", display: "flex", fontSize: 14 }} title="Text indexed">{"\u2699"}</span>}
                      {!cached && isOnline && !isDl && <button onClick={() => downloadAndCache(file.name)} style={S.aBtn}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg></button>}
                      {isDl && <span style={S.spin} />}
                      {cached && <button onClick={() => removeFromCache(file.name)} style={Object.assign({}, S.aBtn, { color: "#475569" })} title="Remove"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      <footer style={S.foot}>
        <span>Supabase Storage &middot; <code style={S.code}>{BUCKET_NAME}</code></span>
        <span>{extractedCount}/{files.length} indexed &middot; Ctrl+F search</span>
      </footer>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────
var S = {
  root: { fontFamily: "'DM Sans', -apple-system, sans-serif", background: "#0F172A", color: "#E2E8F0", minHeight: "100vh", display: "flex", flexDirection: "column" },
  header: { background: "linear-gradient(180deg, #1E293B 0%, #0F172A 100%)", borderBottom: "1px solid #1E293B", padding: "18px 24px" },
  headerRow: { maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" },
  hLeft: { display: "flex", alignItems: "center", gap: 14 },
  logo: { width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #38BDF8, #818CF8)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  title: { margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "#F1F5F9" },
  sub: { margin: 0, fontSize: 13, color: "#64748B" },
  badge: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20, border: "1px solid" },
  badgeOn: { color: "#34D399", borderColor: "rgba(52,211,153,0.2)", background: "rgba(52,211,153,0.08)" },
  badgeOff: { color: "#FBBF24", borderColor: "rgba(251,191,36,0.2)", background: "rgba(251,191,36,0.08)" },

  toolbar: { maxWidth: 960, margin: "0 auto", width: "100%", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", boxSizing: "border-box" },
  sWrap: { position: "relative", flex: "1 1 220px", minWidth: 180 },
  sInput: { width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", background: "#1E293B", border: "1px solid #334155", borderRadius: 8, color: "#E2E8F0", fontSize: 14, fontFamily: "inherit", outline: "none" },
  btn: { display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "1px solid", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", lineHeight: 1, whiteSpace: "nowrap" },
  btnA: { background: "rgba(56,189,248,0.12)", borderColor: "rgba(56,189,248,0.25)", color: "#38BDF8" },
  btnG: { background: "rgba(241,245,249,0.04)", borderColor: "#334155", color: "#94A3B8" },
  btnE: { background: "rgba(250,204,21,0.12)", borderColor: "rgba(250,204,21,0.25)", color: "#FACC15" },
  off: { opacity: 0.3, cursor: "not-allowed" },

  progressBar: { maxWidth: 960, margin: "0 auto", width: "100%", padding: "0 24px", boxSizing: "border-box" },
  progressFill: { height: 3, background: "linear-gradient(90deg, #38BDF8, #818CF8)", borderRadius: 2, transition: "width 0.3s" },
  progressText: { fontSize: 11, color: "#64748B", marginTop: 4, display: "block", fontFamily: "'JetBrains Mono', monospace" },

  globalResults: { maxWidth: 960, margin: "0 auto", width: "100%", padding: "0 24px", boxSizing: "border-box" },
  globalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1E293B" },
  globalList: { maxHeight: 400, overflowY: "auto" },
  globalItem: { display: "flex", padding: "10px 0", background: "none", border: "none", borderBottom: "1px solid #1E293B", color: "inherit", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" },
  gBadge: { flexShrink: 0, fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#38BDF8", background: "rgba(56,189,248,0.12)", padding: "2px 6px", borderRadius: 4, marginTop: 2 },
  gSnippet: { fontSize: 12, lineHeight: 1.5, color: "#94A3B8" },

  err: { maxWidth: 960, margin: "0 auto", width: "100%", padding: "10px 24px", boxSizing: "border-box", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#F87171", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" },
  errX: { background: "none", border: "none", color: "#F87171", cursor: "pointer", fontSize: 16, padding: 4 },

  main: { flex: 1, maxWidth: 960, margin: "0 auto", width: "100%", padding: "0 24px 24px", boxSizing: "border-box" },

  list: { display: "flex", flexDirection: "column", gap: 2 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderRadius: 10, border: "1px solid #1E293B", transition: "all 0.15s", gap: 8 },
  fBtn: { display: "flex", alignItems: "center", gap: 12, flex: 1, padding: "8px 4px", background: "none", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", fontFamily: "inherit", minWidth: 0 },
  fIco: { width: 38, height: 38, borderRadius: 8, border: "1px solid", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(15,23,42,0.6)" },
  fInf: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  fNm: { fontSize: 14, fontWeight: 500, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  fMt: { fontSize: 12, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" },
  fAct: { display: "flex", alignItems: "center", gap: 4, flexShrink: 0 },
  aBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 6, background: "none", border: "none", color: "#94A3B8", cursor: "pointer" },

  viewer: { display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", minHeight: 500, background: "#1E293B", borderRadius: 12, border: "1px solid #334155", overflow: "hidden" },
  vBar: { display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #334155", background: "#0F172A", flexWrap: "wrap" },
  back: { padding: "6px 12px", borderRadius: 6, background: "rgba(241,245,249,0.05)", border: "1px solid #334155", color: "#94A3B8", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  vName: { flex: 1, fontSize: 14, fontWeight: 500, color: "#CBD5E1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 },
  vCtrls: { display: "flex", alignItems: "center", gap: 4, flexShrink: 0, flexWrap: "wrap" },
  cb: { width: 30, height: 30, borderRadius: 6, background: "rgba(241,245,249,0.05)", border: "1px solid #334155", color: "#94A3B8", fontSize: 16, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  zoom: { fontSize: 12, color: "#64748B", fontFamily: "'JetBrains Mono', monospace", minWidth: 40, textAlign: "center" },
  div: { width: 1, height: 20, background: "#334155", margin: "0 4px" },

  sPanel: { borderBottom: "1px solid #334155", background: "#0F172A" },
  sPanelRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 16px" },
  sPanelIn: { flex: 1, padding: "6px 8px", background: "#1E293B", border: "1px solid #334155", borderRadius: 6, color: "#E2E8F0", fontSize: 13, fontFamily: "inherit", outline: "none", minWidth: 120 },
  mc: { fontSize: 12, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" },
  nb: { width: 26, height: 26, borderRadius: 5, background: "rgba(241,245,249,0.05)", border: "1px solid #334155", color: "#94A3B8", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  mList: { maxHeight: 200, overflowY: "auto", borderTop: "1px solid #1E293B" },
  mItem: { display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 16px", background: "none", border: "none", borderBottom: "1px solid #1E293B", color: "#CBD5E1", fontSize: 12, fontFamily: "inherit", cursor: "pointer", textAlign: "left", width: "100%", boxSizing: "border-box" },
  mItemA: { background: "rgba(56,189,248,0.08)" },
  mBadge: { flexShrink: 0, fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#38BDF8", background: "rgba(56,189,248,0.12)", padding: "2px 6px", borderRadius: 4, marginTop: 1 },
  mSnip: { fontSize: 12, lineHeight: 1.5, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" },

  vBody: { flex: 1, overflow: "auto", display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center", padding: 16, background: "#0F172A", minHeight: 0 },

  ctr: { display: "flex", alignItems: "center", justifyContent: "center", padding: 40 },
  spin: { display: "inline-block", width: 16, height: 16, border: "2px solid #334155", borderTopColor: "#38BDF8", borderRadius: "50%", animation: "spin 0.6s linear infinite" },
  miniSpin: { display: "inline-block", width: 12, height: 12, border: "2px solid #334155", borderTopColor: "#FACC15", borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 },
  eBox: { maxWidth: 500, padding: 20, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, color: "#CBD5E1" },
  code: { background: "rgba(56,189,248,0.1)", padding: "2px 6px", borderRadius: 4, color: "#38BDF8", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
  foot: { maxWidth: 960, margin: "0 auto", width: "100%", padding: "14px 24px", boxSizing: "border-box", borderTop: "1px solid #1E293B", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace" },
};

if (typeof document !== "undefined") {
  var id = "aoms-pdf-kf";
  if (!document.getElementById(id)) {
    var s = document.createElement("style");
    s.id = id;
    s.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(s);
  }
}
