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
