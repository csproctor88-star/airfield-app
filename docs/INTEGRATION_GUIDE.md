# Pre-Extracted PDF Text Search — Integration Guide

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     PDF Upload                                │
│  (Supabase Storage: regulations-pdf bucket)                   │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│          Text Extraction (one-time per file)                  │
│                                                               │
│  Option A: Edge Function (server-side, automatic)             │
│  Option B: Client-side PDF.js (first user to open triggers)   │
│                                                               │
│  Extracted text → pdf_text_pages table (Postgres)             │
│                   with tsvector for full-text search           │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│              Text Cache Sync                                  │
│                                                               │
│  On app startup / manual sync:                                │
│  Supabase pdf_text_pages → IndexedDB (text_pages store)       │
│                                                               │
│  Now ALL search text is available offline                      │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│                Search (two modes)                             │
│                                                               │
│  ONLINE:  Postgres full-text search (ranked, fast, all PDFs)  │
│  OFFLINE: IndexedDB substring search (local, instant)         │
│                                                               │
│  Both return: file_name, page_number, snippet, rank           │
└──────────────────────────────────────────────────────────────┘
```

## Setup Steps

### 1. Run the database migration

Open Supabase SQL Editor and run `001_pdf_text_search.sql`. This creates:
- `pdf_text_pages` — stores text per page with auto-generated tsvector
- `pdf_extraction_status` — tracks which files have been processed
- `search_all_pdfs()` — Postgres function for ranked cross-PDF search
- `search_pdf()` — Postgres function for single-PDF search

### 2. Choose your extraction method

**Option A: Edge Function (recommended for production)**
```bash
supabase functions new extract-pdf-text
# Copy index.ts to supabase/functions/extract-pdf-text/
supabase functions deploy extract-pdf-text
```

Then trigger it:
```js
// After uploading a PDF to storage:
await fetch(`${SUPABASE_URL}/functions/v1/extract-pdf-text`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ fileName: 'DAFI13-213.pdf' }),
});

// Or batch-extract all unprocessed PDFs:
await fetch(`${SUPABASE_URL}/functions/v1/extract-pdf-text`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  body: JSON.stringify({ extractAll: true }),
});
```

**Option B: Client-side extraction (simpler, no Edge Function needed)**

The `pdfTextCache.js` module handles this automatically. When a user opens
a PDF that hasn't been extracted yet, it:
1. Extracts text using PDF.js (same engine as the viewer)
2. Caches to IndexedDB
3. Uploads to Supabase in the background (so it's available next time)

### 3. Wire into PDFLibrary component

Replace the text extraction section in `PDFLibrary.jsx`:

```jsx
// Add import at top
import { textCache } from '@/lib/pdfTextCache';

// In viewPdf function, replace the extraction block:

// OLD (extracts every time):
// setTextExtracting(true);
// extractAllText(uint8)
//   .then((t) => { setPageTexts(t); setTextExtracting(false); })
//   .catch(...);

// NEW (uses pre-extracted cache):
setTextExtracting(true);
textCache.getTextForFile(supabase, fileName, uint8)
  .then((pages) => {
    setPageTexts(pages);
    setTextExtracting(false);
  })
  .catch((err) => {
    console.warn("Text load failed:", err);
    setTextExtracting(false);
  });
```

### 4. Add text sync on app startup

In your layout or page component:

```jsx
import { textCache } from '@/lib/pdfTextCache';

useEffect(() => {
  // Sync pre-extracted text to IndexedDB for offline search
  textCache.syncAllFromServer(supabase).then((result) => {
    console.log(`Text sync: ${result.synced} new, ${result.skipped} cached`);
  });
}, []);
```

### 5. Add cross-PDF search (optional but powerful)

This lets users search across ALL regulations at once from the file list:

```jsx
const [globalSearch, setGlobalSearch] = useState('');
const [globalResults, setGlobalResults] = useState([]);

async function handleGlobalSearch(query) {
  setGlobalSearch(query);
  if (query.length < 2) { setGlobalResults([]); return; }

  // Uses Postgres search if online, IndexedDB if offline
  const results = navigator.onLine
    ? await textCache.searchServer(supabase, query)
    : await textCache.searchOffline(query);

  setGlobalResults(results);
}
```

## What This Gets You

| Feature | Before | After |
|---------|--------|-------|
| Text extraction | Every time PDF opens (~2-10s) | One-time, then instant |
| Offline search | Only current PDF | ALL cached PDFs |
| Cross-PDF search | Not possible | Full-text ranked results |
| Search speed | Client substring scan | Postgres tsvector (milliseconds) |
| Search quality | Exact substring only | Stemming, ranking, proximity |

## Postgres Full-Text Search Extras

The `tsvector` column gives you powerful search syntax for free:

```sql
-- Phrase search
SELECT * FROM search_all_pdfs('obstruction evaluation');

-- Boolean operators
SELECT * FROM search_all_pdfs('runway AND NOT taxiway');

-- Prefix matching
SELECT * FROM search_all_pdfs('obstr:*');
```

## File Inventory

```
supabase/
  migrations/
    001_pdf_text_search.sql      ← Database schema + search functions
  functions/
    extract-pdf-text/
      index.ts                   ← Edge Function for server-side extraction

src/
  lib/
    pdfTextCache.js              ← Client-side cache manager (IndexedDB + sync)
  components/
    PDFLibrary.jsx               ← Updated viewer (wire in per step 3 above)
```
