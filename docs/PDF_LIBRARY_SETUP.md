# AOMS PDF Library — Setup & Troubleshooting

## Quick Setup

```bash
# Install react-pdf (only dependency needed)
npm install react-pdf
```

### next.config.js — Required for Next.js

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // react-pdf tries to import 'canvas' (a Node library) — tell webpack to skip it
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
```

### CSS Imports

If using **App Router**, add to your root `layout.tsx`:

```tsx
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
```

If using **Pages Router**, add to `_app.tsx`:

```tsx
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
```

### Usage

```tsx
import PDFLibrary from "@/components/PDFLibrary";

export default function RegulationsPage() {
  return <PDFLibrary />;
}
```

---

## The 4 Things That Break react-pdf (and their fixes)

### 1. PDF.js Worker Not Configured → Blank Screen

**Symptom:** Component renders, file list loads, but clicking a PDF shows nothing or a white screen. Console may show: `Setting up fake worker` or `No "GlobalWorkerOptions.workerSrc" specified`.

**Fix (already in the component):**

```js
pdfjs.GlobalWorkerOptions.workerSrc = 
  `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
```

The critical detail is that the **pdfjs-dist version in the CDN URL must exactly match** the version bundled with your react-pdf. Check with:

```bash
node -e "console.log(require('pdfjs-dist/package.json').version)"
```

**For offline/airgapped use** (DoD networks), copy the worker locally:

```bash
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
```

Then change the workerSrc to:

```js
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
```

### 2. Passing Blob URL Instead of Raw Data → Silent Failure

**Symptom:** You create `URL.createObjectURL(blob)` and pass it to `<Document file={blobUrl}>`. Nothing renders.

**Why:** react-pdf expects either a URL string to fetch (triggers CORS), a `{ data: Uint8Array }` object, or a `{ url: string }` object. A `blob:` URL doesn't work reliably because PDF.js tries to fetch it through its worker, which runs in a different context.

**Fix (already in the component):**

```js
async function blobToUint8Array(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// Then pass to Document:
<Document file={{ data: pdfData }}>
```

### 3. Missing CSS → PDF Renders but Looks Wrong

**Symptom:** PDF pages show up but text is overlapping, links don't work, or there's a weird transparent overlay.

**Fix:** Import the two CSS files (see CSS Imports above). These style the text selection layer and link/annotation layer that react-pdf renders on top of the canvas.

### 4. Next.js Canvas Import Error → Build Fails

**Symptom:** Build error mentioning `canvas` module not found.

**Fix:** Add the webpack alias in next.config.js (see above). The `canvas` package is a Node.js native module used for server-side rendering of PDFs — it's not needed in the browser.

---

## Supabase Bucket Configuration

The component expects a **public or authenticated** bucket named `regulations-pdf`. 

If your bucket requires authentication (RLS enabled), make sure your Supabase anon key has read access. You can verify in Supabase Dashboard → Storage → Policies:

```sql
-- Example: Allow authenticated read access
CREATE POLICY "Allow authenticated PDF downloads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'regulations-pdf');
```

If you want unauthenticated access for simplicity during development:

```sql
CREATE POLICY "Public read for regulations"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'regulations-pdf');
```

---

## Keyboard Shortcuts (in viewer)

| Key | Action |
|-----|--------|
| ← / ↑ | Previous page |
| → / ↓ | Next page |
| Esc | Close viewer |
