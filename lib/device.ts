// Device-class detection. Kept separate from viewport/width checks: a narrow
// desktop window is "small" but can still render a PDF inline in an <iframe>,
// whereas iOS/iPadOS/Android cannot (iOS WebKit only renders a PDF iframe's
// first page) regardless of viewport size.
//
// iPadOS 13+ Safari defaults to desktop-class browsing — it reports
// platform "MacIntel" with no "iPad" UA token — so the touch-points check is
// the reliable iPad tell. Mirrors the detection in the react-pdf viewers
// (RegulationPDFViewer / PDFLibrary).
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return (
    /ipad|iphone|ipod|android/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}
