// Records Export — the unit the packager bundles into the ZIP.
import type { jsPDF } from 'jspdf'

export interface ExportFile {
  /** Path inside the ZIP, e.g. 'documents/Discrepancies.pdf' */
  path: string
  bytes: Uint8Array
}

/** Convert a finished jsPDF document into an ExportFile at the given ZIP path. */
export function pdfToExportFile(doc: jsPDF, path: string): ExportFile {
  const arrayBuffer = doc.output('arraybuffer')
  return { path, bytes: new Uint8Array(arrayBuffer) }
}
