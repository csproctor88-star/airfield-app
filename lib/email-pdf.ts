import type jsPDF from 'jspdf'
import { createClient } from '@/lib/supabase/client'

export async function sendPdfViaEmail(
  doc: jsPDF,
  filename: string,
  to: string,
  subject: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const blob = doc.output('blob')

    // Upload PDF to Supabase Storage as a temp file to avoid body size limits
    const supabase = createClient()
    if (!supabase) return { success: false, error: 'Supabase not configured' }

    const tempPath = `email-temp/${crypto.randomUUID()}-${filename}`
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(tempPath, blob, { contentType: 'application/pdf', upsert: false })

    if (uploadError) {
      return { success: false, error: `Upload failed: ${uploadError.message}` }
    }

    try {
      const res = await fetch('/api/send-pdf-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: tempPath, filename, to, subject }),
      })

      let data: { error?: string }
      try {
        data = await res.json()
      } catch {
        const text = await res.text().catch(() => '')
        return { success: false, error: `Server error (${res.status}): ${text.slice(0, 100) || 'Non-JSON response'}` }
      }
      if (!res.ok) return { success: false, error: data.error || 'Failed to send email' }
      return { success: true }
    } finally {
      // Clean up temp file regardless of email outcome
      supabase.storage.from('photos').remove([tempPath])
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}
