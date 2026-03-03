import type jsPDF from 'jspdf'

export async function sendPdfViaEmail(
  doc: jsPDF,
  filename: string,
  to: string,
  subject: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const arrayBuffer = doc.output('arraybuffer')
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const pdfBase64 = btoa(binary)

    const res = await fetch('/api/send-pdf-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64, filename, to, subject }),
    })

    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || 'Failed to send email' }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}
