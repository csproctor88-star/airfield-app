import { createClient } from '@/lib/supabase/client'

// ── Types ──

export interface OpenDiscrepancy {
  id: string
  display_id: string
  title: string
  description: string
  type: string
  severity: string
  status: string
  current_status: string
  location_text: string
  assigned_shop: string | null
  work_order_number: string | null
  notam_reference: string | null
  reported_by: string
  photo_count: number
  created_at: string
  updated_at: string
  // Computed
  days_open: number
  // Joined
  reporter_name: string
  reporter_rank: string | null
  // Latest update info
  last_update_at: string | null
  last_update_notes: string | null
}

export interface StatusNote {
  id: string
  old_status: string | null
  new_status: string | null
  notes: string | null
  created_at: string
  user_name: string
  user_rank: string | null
}

export interface PhotoForReport {
  id: string
  storage_path: string
  file_name: string
  // Resolved data URL for embedding in PDF
  dataUrl: string | null
}

export interface OpenDiscrepanciesData {
  discrepancies: OpenDiscrepancy[]
  summary: {
    total: number
    byArea: Record<string, number>
    byType: Record<string, number>
    agingOver30: number
  }
  // Keyed by discrepancy ID, last 3 notes
  notesHistory: Record<string, StatusNote[]>
  // Keyed by discrepancy ID, photos with data URLs
  photos: Record<string, PhotoForReport[]>
}

// ── Helpers ──

/** Convert snake_case or underscore-separated type to Title Case (e.g. fod_hazard → FOD Hazard) */
export function formatDiscrepancyType(raw: string): string {
  // Handle known acronyms
  const acronyms = new Set(['fod', 'rsc', 'rcr', 'bash', 'ife', 'notam', 'bwc'])
  return raw
    .split('_')
    .map((word) => acronyms.has(word.toLowerCase()) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// ── Data Fetching ──

export async function fetchOpenDiscrepanciesData(
  includeNotes = false
): Promise<OpenDiscrepanciesData> {
  const supabase = createClient()
  if (!supabase) {
    return { discrepancies: [], summary: { total: 0, byArea: {}, byType: {}, agingOver30: 0 }, notesHistory: {}, photos: {} }
  }

  const now = new Date()

  // Fetch open discrepancies with profile join
  let discrepancies: OpenDiscrepancy[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('discrepancies')
    .select('*, profiles:reported_by(name, rank)')
    .eq('status', 'open')
    .order('created_at', { ascending: true })

  if (!error && data) {
    discrepancies = (data ?? []).map((row: Record<string, unknown>) => {
      const createdAt = new Date(row.created_at as string)
      const daysOpen = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      return {
        ...row,
        days_open: daysOpen,
        reporter_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
        reporter_rank: (row.profiles as { rank?: string } | null)?.rank || null,
        last_update_at: null,
        last_update_notes: null,
      }
    }) as OpenDiscrepancy[]
  } else {
    // Fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fb } = await (supabase as any)
      .from('discrepancies')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: true })

    discrepancies = ((fb ?? []) as Record<string, unknown>[]).map((row) => {
      const createdAt = new Date(row.created_at as string)
      const daysOpen = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      return {
        ...row,
        days_open: daysOpen,
        reporter_name: 'Unknown',
        reporter_rank: null,
        last_update_at: null,
        last_update_notes: null,
      }
    }) as OpenDiscrepancy[]
  }

  // Fetch latest status update per discrepancy
  const discIds = discrepancies.map((d) => d.id)
  if (discIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updates } = await (supabase as any)
      .from('status_updates')
      .select('discrepancy_id, notes, created_at')
      .in('discrepancy_id', discIds)
      .order('created_at', { ascending: false })

    if (updates) {
      const latestByDisc: Record<string, { notes: string | null; created_at: string }> = {}
      for (const u of updates as { discrepancy_id: string; notes: string | null; created_at: string }[]) {
        if (!latestByDisc[u.discrepancy_id]) {
          latestByDisc[u.discrepancy_id] = u
        }
      }
      for (const d of discrepancies) {
        const latest = latestByDisc[d.id]
        if (latest) {
          d.last_update_at = latest.created_at
          d.last_update_notes = latest.notes
        }
      }
    }
  }

  // Fetch notes history if requested
  let notesHistory: Record<string, StatusNote[]> = {}
  if (includeNotes && discIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allNotes } = await (supabase as any)
      .from('status_updates')
      .select('*, profiles:updated_by(name, rank)')
      .in('discrepancy_id', discIds)
      .order('created_at', { ascending: false })

    if (allNotes) {
      const grouped: Record<string, StatusNote[]> = {}
      for (const note of allNotes as Record<string, unknown>[]) {
        const discId = note.discrepancy_id as string
        if (!grouped[discId]) grouped[discId] = []
        if (grouped[discId].length < 3) {
          grouped[discId].push({
            id: note.id as string,
            old_status: note.old_status as string | null,
            new_status: note.new_status as string | null,
            notes: note.notes as string | null,
            created_at: note.created_at as string,
            user_name: (note.profiles as { name?: string } | null)?.name || 'Unknown',
            user_rank: (note.profiles as { rank?: string } | null)?.rank || null,
          })
        }
      }
      notesHistory = grouped
    }
  }

  // Fetch photos for all discrepancies
  const photos: Record<string, PhotoForReport[]> = {}
  if (discIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: photoRows } = await (supabase as any)
      .from('photos')
      .select('id, discrepancy_id, storage_path, file_name')
      .in('discrepancy_id', discIds)
      .order('created_at', { ascending: true })

    if (photoRows) {
      for (const row of photoRows as { id: string; discrepancy_id: string; storage_path: string; file_name: string }[]) {
        if (!photos[row.discrepancy_id]) photos[row.discrepancy_id] = []

        let dataUrl: string | null = null
        if (row.storage_path.startsWith('data:')) {
          // Already a data URL
          dataUrl = row.storage_path
        } else {
          // Try to get public URL from storage
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: urlData } = (supabase as any).storage
              .from('photos')
              .getPublicUrl(row.storage_path)
            if (urlData?.publicUrl) {
              // Fetch the image and convert to data URL for PDF embedding
              try {
                const response = await fetch(urlData.publicUrl)
                if (response.ok) {
                  const blob = await response.blob()
                  dataUrl = await blobToDataUrl(blob)
                }
              } catch {
                // Network error fetching image
              }
            }
          } catch {
            // Storage not available
          }
        }

        photos[row.discrepancy_id].push({
          id: row.id,
          storage_path: row.storage_path,
          file_name: row.file_name,
          dataUrl,
        })
      }
    }
  }

  // Compute summary stats
  const byArea: Record<string, number> = {}
  const byType: Record<string, number> = {}
  let agingOver30 = 0

  for (const d of discrepancies) {
    const area = d.location_text || 'Unknown'
    byArea[area] = (byArea[area] || 0) + 1
    byType[d.type] = (byType[d.type] || 0) + 1
    if (d.days_open > 30) agingOver30++
  }

  return {
    discrepancies,
    summary: {
      total: discrepancies.length,
      byArea,
      byType,
      agingOver30,
    },
    notesHistory,
    photos,
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
