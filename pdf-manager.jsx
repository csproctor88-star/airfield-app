import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────
// CONFIG — Replace with your actual Supabase credentials
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
const BUCKET_NAME = "regulations.pdf";

// ─────────────────────────────────────────────────────────────
// Minimal Supabase Storage Client
// ─────────────────────────────────────────────────────────────
function createSupabaseClient(url, key) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  return {
    storage: {
      from(bucket) {
        return {
          async list(folder = "", options = {}) {
            const params = new URLSearchParams();
            if (options.limit) params.set("limit", options.limit);
            if (options.offset) params.set("offset", options.offset);
            const body = {
              prefix: folder,
              limit: options.limit || 1000,
              offset: options.offset || 0,
              sortBy: { column: "name", order: "asc" },
            };
            const res = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`List failed: ${res.statusText}`);
            return { data: await res.json(), error: null };
          },
          async download(path) {
            const res = await fetch(
              `${url}/storage/v1/object/${bucket}/${path}`,
              { headers }
            );
            if (!res.ok)
              throw new Error(`Download failed: ${res.statusText}`);
            const blob = await res.blob();
            return { data: blob, error: null };
          },
        };
      },
    },
  };
}

const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─────────────────────────────────────────────────────────────
// IndexedDB helpers (localforage-style, zero dependencies)
// ─────────────────────────────────────────────────────────────
const DB_NAME = "pdf_cache";
const STORE_NAME = "blobs";
const META_STORE = "meta";
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(META_STORE))
        db.createObjectStore(META_STORE);
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

async function idbDelete(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// Icons (inline SVG for zero dependencies)
// ─────────────────────────────────────────────────────────────
const Icon = {
  Pdf: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Download: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Cached: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  Offline: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
      <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0122.56 9" />
      <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
      <path d="M8.53 16.11a6 6 0 016.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  Online: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0114.08 0" />
      <path d="M1.42 9a16 16 0 0121.16 0" />
      <path d="M8.53 16.11a6 6 0 016.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  Close: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Refresh: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  ),
  Spinner: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function PDFManager() {
  const [files, setFiles] = useState([]);
  const [cachedKeys, setCachedKeys] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(new Set());
  const [viewingFile, setViewingFile] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const blobUrlRef = useRef(null);

  // Track online/offline
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Clean up blob URL on change
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // Load cached keys from IndexedDB
  const refreshCachedKeys = useCallback(async () => {
    try {
      const keys = await idbGetAllKeys(STORE_NAME);
      setCachedKeys(new Set(keys));
    } catch (e) {
      console.error("Failed to read cache keys:", e);
    }
  }, []);

  // Fetch file list from Supabase (or fall back to cache)
  const fetchFileList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (navigator.onLine) {
        const { data, error: listError } = await supabase.storage
          .from(BUCKET_NAME)
          .list("", { limit: 500 });
        if (listError) throw listError;
        const pdfs = (data || []).filter(
          (f) => f.name?.toLowerCase().endsWith(".pdf") && f.id
        );
        setFiles(pdfs);
        // Cache the file list metadata for offline use
        await idbSet(META_STORE, "file_list", JSON.stringify(pdfs));
      } else {
        // Offline: load cached file list
        const cached = await idbGet(META_STORE, "file_list");
        if (cached) {
          setFiles(JSON.parse(cached));
        } else {
          // Fallback: show only cached PDFs
          const keys = await idbGetAllKeys(STORE_NAME);
          setFiles(
            keys.map((k) => ({ name: k, id: k, metadata: {}, created_at: null }))
          );
        }
      }
    } catch (e) {
      setError(e.message || "Failed to load files");
      // Try offline fallback
      const cached = await idbGet(META_STORE, "file_list");
      if (cached) setFiles(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
    await refreshCachedKeys();
  }, [refreshCachedKeys]);

  useEffect(() => {
    fetchFileList();
  }, [fetchFileList]);

  // Download a PDF and cache it
  const downloadAndCache = useCallback(
    async (fileName) => {
      setDownloading((prev) => new Set([...prev, fileName]));
      try {
        const { data, error: dlError } = await supabase.storage
          .from(BUCKET_NAME)
          .download(fileName);
        if (dlError) throw dlError;
        await idbSet(STORE_NAME, fileName, data);
        await refreshCachedKeys();
      } catch (e) {
        setError(`Download failed: ${e.message}`);
      } finally {
        setDownloading((prev) => {
          const next = new Set(prev);
          next.delete(fileName);
          return next;
        });
      }
    },
    [refreshCachedKeys]
  );

  // Cache all uncached files
  const cacheAll = useCallback(async () => {
    const uncached = files.filter((f) => !cachedKeys.has(f.name));
    for (const f of uncached) {
      await downloadAndCache(f.name);
    }
  }, [files, cachedKeys, downloadAndCache]);

  // Open PDF viewer
  const viewPdf = useCallback(
    async (fileName) => {
      // Revoke previous blob
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setViewingFile(fileName);
      setBlobUrl(null);

      try {
        // Try IndexedDB first
        let blob = await idbGet(STORE_NAME, fileName);

        if (!blob && navigator.onLine) {
          // Download fresh
          const { data, error: dlError } = await supabase.storage
            .from(BUCKET_NAME)
            .download(fileName);
          if (dlError) throw dlError;
          blob = data;
          // Cache it
          await idbSet(STORE_NAME, fileName, blob);
          await refreshCachedKeys();
        }

        if (!blob) {
          setError("PDF not available offline. Connect to download it first.");
          setViewingFile(null);
          return;
        }

        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch (e) {
        setError(`Failed to open PDF: ${e.message}`);
        setViewingFile(null);
      }
    },
    [refreshCachedKeys]
  );

  // Close viewer
  const closeViewer = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setViewingFile(null);
    setBlobUrl(null);
  }, []);

  // Remove from cache
  const removeFromCache = useCallback(
    async (fileName) => {
      await idbDelete(STORE_NAME, fileName);
      await refreshCachedKeys();
    },
    [refreshCachedKeys]
  );

  // Filter files
  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const cachedCount = files.filter((f) => cachedKeys.has(f.name)).length;

  return (
    <div style={styles.root}>
      <style>{keyframes}</style>

      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerLeft}>
            <div style={styles.logoMark}>PDF</div>
            <div>
              <h1 style={styles.title}>Document Library</h1>
              <p style={styles.subtitle}>
                {files.length} document{files.length !== 1 ? "s" : ""} ·{" "}
                {cachedCount} cached offline
              </p>
            </div>
          </div>
          <div style={styles.headerRight}>
            <div
              style={{
                ...styles.statusBadge,
                ...(isOnline ? styles.statusOnline : styles.statusOffline),
              }}
            >
              {isOnline ? <Icon.Online /> : <Icon.Offline />}
              <span>{isOnline ? "Online" : "Offline"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B8FA3" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.toolbarActions}>
          <button
            onClick={fetchFileList}
            disabled={!isOnline || loading}
            style={{
              ...styles.btn,
              ...styles.btnSecondary,
              ...(!isOnline || loading ? styles.btnDisabled : {}),
            }}
            title="Refresh file list"
          >
            <Icon.Refresh />
            <span>Refresh</span>
          </button>
          <button
            onClick={cacheAll}
            disabled={!isOnline || cachedCount === files.length}
            style={{
              ...styles.btn,
              ...styles.btnPrimary,
              ...(!isOnline || cachedCount === files.length ? styles.btnDisabled : {}),
            }}
          >
            <Icon.Download />
            <span>Cache All</span>
          </button>
        </div>
      </div>

      {/* ── Error Toast ── */}
      {error && (
        <div style={styles.errorBanner}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={styles.errorClose}>
            ✕
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      <div style={styles.content}>
        {viewingFile ? (
          /* ── PDF Viewer ── */
          <div style={styles.viewerContainer}>
            <div style={styles.viewerHeader}>
              <div style={styles.viewerTitle}>
                <Icon.Pdf />
                <span style={styles.viewerFileName}>{viewingFile}</span>
              </div>
              <button onClick={closeViewer} style={styles.closeBtn}>
                <Icon.Close />
              </button>
            </div>
            <div style={styles.viewerBody}>
              {blobUrl ? (
                <iframe
                  src={blobUrl}
                  title={viewingFile}
                  style={styles.iframe}
                />
              ) : (
                <div style={styles.loaderWrap}>
                  <Icon.Spinner />
                  <span style={{ marginLeft: 8, color: "#8B8FA3" }}>Loading PDF…</span>
                </div>
              )}
            </div>
          </div>
        ) : loading ? (
          <div style={styles.loaderWrap}>
            <Icon.Spinner />
            <span style={{ marginLeft: 8, color: "#8B8FA3" }}>
              Loading file list…
            </span>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div style={styles.emptyState}>
            <Icon.Pdf />
            <p style={{ margin: "12px 0 4px", fontWeight: 600, color: "#CDD0DC" }}>
              {searchQuery ? "No matching documents" : "No PDFs found"}
            </p>
            <p style={{ color: "#6C7086", fontSize: 13 }}>
              {searchQuery
                ? "Try a different search term"
                : isOnline
                ? `Check that bucket "${BUCKET_NAME}" contains PDF files`
                : "Go online to sync your document library"}
            </p>
          </div>
        ) : (
          /* ── File List ── */
          <div style={styles.fileList}>
            {filteredFiles.map((file) => {
              const isCached = cachedKeys.has(file.name);
              const isDownloading = downloading.has(file.name);

              return (
                <div
                  key={file.name}
                  style={styles.fileRow}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#1E2030";
                    e.currentTarget.style.borderColor = "#3B3F58";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "#282A3A";
                  }}
                >
                  <button
                    onClick={() => viewPdf(file.name)}
                    style={styles.fileMain}
                    disabled={!isCached && !isOnline}
                  >
                    <div
                      style={{
                        ...styles.fileIcon,
                        color: isCached ? "#A6E3A1" : "#F38BA8",
                      }}
                    >
                      <Icon.Pdf />
                    </div>
                    <div style={styles.fileInfo}>
                      <span style={styles.fileName}>{file.name}</span>
                      <span style={styles.fileMeta}>
                        {formatBytes(file.metadata?.size)}
                        {file.created_at ? ` · ${formatDate(file.created_at)}` : ""}
                      </span>
                    </div>
                  </button>

                  <div style={styles.fileActions}>
                    {isCached && (
                      <span style={styles.cachedBadge} title="Available offline">
                        <Icon.Cached />
                      </span>
                    )}
                    {!isCached && isOnline && !isDownloading && (
                      <button
                        onClick={() => downloadAndCache(file.name)}
                        style={styles.actionBtn}
                        title="Download for offline"
                      >
                        <Icon.Download />
                      </button>
                    )}
                    {isDownloading && (
                      <span style={styles.actionBtn}>
                        <Icon.Spinner />
                      </span>
                    )}
                    {isCached && (
                      <button
                        onClick={() => removeFromCache(file.name)}
                        style={{ ...styles.actionBtn, color: "#6C7086" }}
                        title="Remove from cache"
                      >
                        <Icon.Trash />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <footer style={styles.footer}>
        <span>
          Supabase Storage · Bucket: <code style={styles.code}>{BUCKET_NAME}</code>
        </span>
        <span style={{ color: "#45475A" }}>IndexedDB offline cache</span>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Keyframes
// ─────────────────────────────────────────────────────────────
const keyframes = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;500;600;700&display=swap');
`;

// ─────────────────────────────────────────────────────────────
// Styles — Dark utilitarian / command-center aesthetic
// ─────────────────────────────────────────────────────────────
const styles = {
  root: {
    fontFamily: "'Outfit', system-ui, sans-serif",
    background: "#11111B",
    color: "#CDD6F4",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    background: "linear-gradient(180deg, #181825 0%, #11111B 100%)",
    borderBottom: "1px solid #282A3A",
    padding: "20px 24px",
  },
  headerInner: {
    maxWidth: 960,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 14 },
  logoMark: {
    background: "linear-gradient(135deg, #F38BA8 0%, #CBA6F7 100%)",
    color: "#11111B",
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 1,
    padding: "8px 10px",
    borderRadius: 8,
    lineHeight: 1,
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "#CDD6F4",
  },
  subtitle: {
    margin: 0,
    fontSize: 13,
    color: "#6C7086",
    fontWeight: 400,
  },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    padding: "5px 12px",
    borderRadius: 20,
    border: "1px solid",
  },
  statusOnline: {
    color: "#A6E3A1",
    borderColor: "#2B3A2B",
    background: "rgba(166,227,161,0.08)",
  },
  statusOffline: {
    color: "#F9E2AF",
    borderColor: "#3A3520",
    background: "rgba(249,226,175,0.08)",
  },
  toolbar: {
    maxWidth: 960,
    margin: "0 auto",
    width: "100%",
    padding: "16px 24px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    boxSizing: "border-box",
  },
  searchWrap: {
    position: "relative",
    flex: "1 1 220px",
    minWidth: 180,
  },
  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 12px 9px 36px",
    background: "#181825",
    border: "1px solid #282A3A",
    borderRadius: 8,
    color: "#CDD6F4",
    fontSize: 14,
    fontFamily: "'Outfit', system-ui, sans-serif",
    outline: "none",
    transition: "border-color 0.15s",
  },
  toolbarActions: {
    display: "flex",
    gap: 8,
    flexShrink: 0,
  },
  btn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'Outfit', system-ui, sans-serif",
    cursor: "pointer",
    transition: "all 0.15s",
    lineHeight: 1,
  },
  btnPrimary: {
    background: "rgba(203,166,247,0.12)",
    borderColor: "#3B2D5E",
    color: "#CBA6F7",
  },
  btnSecondary: {
    background: "rgba(205,214,244,0.05)",
    borderColor: "#282A3A",
    color: "#A6ADC8",
  },
  btnDisabled: {
    opacity: 0.35,
    cursor: "not-allowed",
  },
  errorBanner: {
    maxWidth: 960,
    margin: "0 auto",
    width: "100%",
    padding: "10px 24px",
    boxSizing: "border-box",
    background: "rgba(243,139,168,0.1)",
    border: "1px solid #3A2030",
    borderRadius: 8,
    color: "#F38BA8",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 0,
  },
  errorClose: {
    background: "none",
    border: "none",
    color: "#F38BA8",
    cursor: "pointer",
    fontSize: 16,
    padding: 4,
    lineHeight: 1,
  },
  content: {
    flex: 1,
    maxWidth: 960,
    margin: "0 auto",
    width: "100%",
    padding: "0 24px 24px",
    boxSizing: "border-box",
  },
  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  fileRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 8px",
    borderRadius: 10,
    border: "1px solid #282A3A",
    background: "transparent",
    transition: "all 0.15s",
    gap: 8,
  },
  fileMain: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flex: 1,
    padding: "8px 4px",
    background: "none",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "'Outfit', system-ui, sans-serif",
    minWidth: 0,
  },
  fileIcon: {
    flexShrink: 0,
    width: 36,
    height: 36,
    borderRadius: 8,
    background: "rgba(205,214,244,0.05)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  fileName: {
    fontSize: 14,
    fontWeight: 500,
    color: "#CDD6F4",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileMeta: {
    fontSize: 12,
    color: "#6C7086",
    fontFamily: "'JetBrains Mono', monospace",
  },
  fileActions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  cachedBadge: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    color: "#A6E3A1",
  },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: 6,
    background: "none",
    border: "none",
    color: "#A6ADC8",
    cursor: "pointer",
    transition: "color 0.15s",
  },
  viewerContainer: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 200px)",
    minHeight: 400,
    background: "#181825",
    borderRadius: 12,
    border: "1px solid #282A3A",
    overflow: "hidden",
  },
  viewerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid #282A3A",
    background: "#1E2030",
  },
  viewerTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#CDD6F4",
    minWidth: 0,
  },
  viewerFileName: {
    fontSize: 14,
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  closeBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 8,
    background: "rgba(205,214,244,0.05)",
    border: "1px solid #282A3A",
    color: "#A6ADC8",
    cursor: "pointer",
    flexShrink: 0,
  },
  viewerBody: {
    flex: 1,
    position: "relative",
  },
  iframe: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    border: "none",
    background: "#FFF",
  },
  loaderWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 24px",
    color: "#45475A",
    textAlign: "center",
  },
  footer: {
    maxWidth: 960,
    margin: "0 auto",
    width: "100%",
    padding: "16px 24px",
    boxSizing: "border-box",
    borderTop: "1px solid #1E2030",
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    fontSize: 12,
    color: "#585B70",
    fontFamily: "'JetBrains Mono', monospace",
  },
  code: {
    background: "rgba(203,166,247,0.1)",
    padding: "2px 6px",
    borderRadius: 4,
    color: "#CBA6F7",
    fontSize: 11,
  },
};
