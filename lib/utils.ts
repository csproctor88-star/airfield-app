import { type ClassValue, clsx } from 'clsx'

// Lightweight class name merger (no tailwind-merge needed for now)
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// Format relative time, e.g. "2h ago", "3d ago"
export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 30) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

// Generate display ID: prefix-YYYY-NNNN
export function generateDisplayId(prefix: string, seq: number): string {
  const year = new Date().getFullYear()
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}

// Sanitize a regulation ID into a safe file name (e.g., "DAFMAN 13-204, Vol 1" → "dafman-13-204-vol-1")
export function sanitizeRegId(regId: string): string {
  return regId
    .toLowerCase()
    .replace(/,\s*/g, '-')
    .replace(/\.\s+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// Check if Supabase environment variables are configured (not placeholder values)
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
  return !!(url && key && !url.includes('your-project') && key !== 'your-anon-key')
}

// Get cleaned Supabase URL and key (returns null if not configured)
export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key || url.includes('your-project') || key === 'your-anon-key') return null
  return { url, key }
}

// Check if a Mapbox token is configured
export function isMapboxConfigured(): boolean {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  return !!(token && token !== 'your-mapbox-token-here')
}
