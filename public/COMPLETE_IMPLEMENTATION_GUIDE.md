# AOMS Regulation Library — Complete Implementation Guide

Everything needed to set up the integrated PDF Library with lazy scroll viewing,
pre-extracted text search, offline caching, and platform-aware mode switching.

---

## What You're Getting

- **Desktop**: Native iframe PDF viewer (Ctrl+F, scroll, print built-in)
- **Mobile/Tablet**: react-pdf with lazy-loaded scrollable pages + text search
- **Toggle button** on desktop to switch between native and react-pdf views
- **Extract All**: One-time text extraction → Supabase + IndexedDB
- **Cross-PDF search**: Search across all 70 regulations from the file list
- **In-document search**: Search within an open PDF with match highlighting
- **Cache All**: Downloads all 70 PDFs (~266MB) to IndexedDB for offline use
- **Auto text sync**: Users' devices auto-sync text index on startup (no button needed)
- **Fully offline**: Cached PDFs + synced text index = everything works without network

---

## Step 1: Database Migration

Run this in **Supabase SQL Editor** (Dashboard → SQL Editor → New Query):

Copy the entire contents of `001_pdf_text_search.sql` and execute it.

This creates:
- `pdf_text_pages` — stores extracted text per page with auto-generated tsvector
- `pdf_extraction_status` — tracks which files have been processed
- `search_all_pdfs()` — Postgres function for ranked cross-PDF search
- `search_pdf()` — Postgres function for single-PDF search
- GIN index for fast full-text search
- RLS policies for authenticated access

**Verify it worked:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('pdf_text_pages', 'pdf_extraction_status');
```
Should return both table names.

---

## Step 2: Install react-pdf

In your project terminal:

```bash
npm install react-pdf
```

---

## Step 3: Copy the PDF.js Worker to public/

```bash
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
```

**Verify:** Open `http://localhost:3000/pdf.worker.min.mjs` — you should see minified JavaScript.

This file gets served as a static asset by Next.js/Vercel. It must match
the exact version of pdfjs-dist that react-pdf installed.

**IMPORTANT:** Re-run this copy command any time you update react-pdf.

---

## Step 4: next.config.js

Add the canvas alias to prevent a Node.js build error:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  // ... your other config
};

module.exports = nextConfig;
```

If you already have a webpack function, just add the `canvas = false` line inside it.

---

## Step 5: CSS Imports

Add these to your root layout file:

**App Router** (`app/layout.tsx`):
```tsx
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
```

**Pages Router** (`pages/_app.tsx`):
```tsx
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
```

These enable text selection and clickable links in the react-pdf viewer.

---

## Step 6: Add the Component

1. Copy `PDFLibrary-integrated.jsx` (or rename to `.tsx`) into your components directory

2. Update the three config constants at the top:

```tsx
const SUPABASE_URL = "https://your-actual-project.supabase.co";
const SUPABASE_ANON_KEY = "your-actual-anon-key";
const BUCKET_NAME = "regulation-pdfs";
```

3. Create a route to render it, e.g. `app/regulations/page.tsx`:

```tsx
import PDFLibrary from "@/components/PDFLibrary-integrated";

export default function RegulationsPage() {
  return <PDFLibrary />;
}
```

---

## Step 7: Test Locally

```bash
npm run dev
```

Open `http://localhost:3000/regulations` and verify:
- [ ] File list loads from Supabase storage
- [ ] Clicking a file opens the PDF
- [ ] Desktop shows native iframe viewer with full scroll
- [ ] Mobile/tablet shows react-pdf scroll viewer

---

## Step 8: Run Extract All (One Time)

1. Open the Regulation Library in your browser
2. Click the **⚙ Extract All** button
3. Wait for it to process all 70 files (progress bar shows which file)
4. When complete, every file shows "Indexed" in the list

This does three things per file:
- Downloads the PDF (if not already cached)
- Extracts text from every page using PDF.js
- Uploads the text to Supabase `pdf_text_pages` table
- Caches the text in your local IndexedDB

**You only need to do this once.** After this, the text lives in Supabase
and auto-syncs to every user's device on startup.

---

## Step 9: Run Cache All (For Offline Users)

Click **↓ Cache All** to download all 70 PDFs (~266MB) to IndexedDB.

This is separate from Extract All:
- **Extract All** = stores searchable text (small, ~25MB for all 70)
- **Cache All** = stores the actual PDF files (266MB for all 70)

Users need both for full offline functionality. If a user only syncs
the text index, they can search but can't view PDFs without connectivity.

For flightline users: do both while on base WiFi.

---

## Step 10: Deploy

```bash
git add .
git commit -m "Add integrated regulation library with offline search"
git push
```

After Vercel deploys, verify:
- [ ] `/pdf.worker.min.mjs` loads (not a 404)
- [ ] File list loads
- [ ] PDFs render
- [ ] Extract All works
- [ ] Search across regulations works
- [ ] Kill network (airplane mode) → cached PDFs still open and search works

---

## How It Works for End Users

### First visit (online):
1. Open Regulation Library
2. Text index auto-syncs from Supabase → IndexedDB (background, instant)
3. Tap "Cache All" if they want offline PDF viewing
4. Done — everything works offline from this point

### Subsequent visits (online or offline):
- Open any cached PDF instantly
- Search across all regulations instantly
- No extraction, no waiting, no buttons to press

### When you add new regulations:
1. Upload PDF to `regulation-pdfs` bucket in Supabase
2. Open the library and click Extract All (only processes new/unindexed files)
3. Users' devices auto-sync the new text on next app open

---

## Platform Behavior

| Platform | Default Viewer | Search | Scroll |
|----------|---------------|--------|--------|
| Desktop Chrome/Edge/Firefox | Native iframe | Ctrl+F (browser built-in) | Full scroll |
| Desktop (toggled) | react-pdf | In-app search panel | Lazy scroll all pages |
| iPad / iOS | react-pdf | In-app search panel | Lazy scroll all pages |
| Android | react-pdf | In-app search panel | Lazy scroll all pages |

Desktop users can toggle between native and react-pdf with the ⊞/☰ button.
Mobile/tablet users always get react-pdf (iframe PDF doesn't work on mobile).

---

## Keyboard Shortcuts (react-pdf mode)

| Key | Action |
|-----|--------|
| Ctrl+F / Cmd+F | Open search |
| Enter | Next match |
| Shift+Enter | Previous match |
| Esc | Close search (second Esc closes viewer) |

---

## Files Checklist

| File | Purpose | Location |
|------|---------|----------|
| `001_pdf_text_search.sql` | Database migration | Run in Supabase SQL Editor |
| `PDFLibrary-integrated.jsx` | Main component | `src/components/` |
| `pdf.worker.min.mjs` | PDF.js worker | `public/` (copy from node_modules) |

---

## Troubleshooting

**"No GlobalWorkerOptions.workerSrc specified"**
→ Worker file missing from public/. Re-run: `cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/`

**"ArrayBuffer is already detached"**
→ The component uses `masterBuffer.slice(0)` to prevent this. If you see it, make sure you're using `PDFLibrary-integrated.jsx` and not the older version.

**"The object can not be cloned"**
→ Same as above — ArrayBuffer issue. The integrated component handles this.

**PDF shows only one page on iPad**
→ You're seeing the iframe viewer. The integrated component auto-detects iPad and uses react-pdf scroll mode instead.

**Extract All fails on a file**
→ It logs the error and continues to the next file. Check browser console for details. Common cause: corrupted PDF in the bucket.

**Search returns no results**
→ Run Extract All first. Search requires the text index. Check that `pdf_text_pages` has data:
```sql
SELECT file_name, COUNT(*) as pages FROM pdf_text_pages GROUP BY file_name;
```

**"relation pdf_text_pages does not exist"**
→ Migration hasn't been run. Execute `001_pdf_text_search.sql` in Supabase SQL Editor.
