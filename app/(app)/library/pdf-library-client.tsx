'use client'

import nextDynamic from 'next/dynamic'

// PDFLibrary is client-only (react-pdf / pdfjs touch browser APIs, so it must
// not SSR). Next 15 disallows `next/dynamic({ ssr: false })` inside a Server
// Component, so this thin `'use client'` wrapper carries the dynamic import;
// the server page (which does the auth + library:view gating) renders it.
const PDFLibrary = nextDynamic(() => import('@/components/PDFLibrary'), { ssr: false })

export default function PDFLibraryClient() {
  return <PDFLibrary />
}
