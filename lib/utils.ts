import { type ClassValue, clsx } from 'clsx'

// Lightweight class name merger (no tailwind-merge needed for now)
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// ── Zulu (UTC) time formatting ──────────────────────────────────────
export function formatZuluTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(11, 16).replace(':', '')
}

export function formatZuluDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatZuluDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${formatZuluDate(d)} ${formatZuluTime(d)}Z`
}

export function formatZuluDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
}

// ── Base-local time formatting ──────────────────────────────────────
/**
 * Convert an HH:MM (or HHMM) Zulu wall-clock time to its base-local
 * HHMM equivalent in the supplied IANA timezone. The date is anchored
 * to today UTC; HH:MM has no calendar component on its own, so the
 * conversion is a pure offset application. Falls back to the raw
 * digits stripped of separators when inputs are malformed.
 */
export function formatLocalTime(zuluHHMM: string, tz: string): string {
  const digits = (zuluHHMM || '').replace(/\D/g, '').slice(0, 4)
  if (digits.length !== 4) return digits
  const hh = digits.slice(0, 2)
  const mm = digits.slice(2, 4)
  const today = new Date().toISOString().slice(0, 10)
  const d = new Date(`${today}T${hh}:${mm}:00Z`)
  if (Number.isNaN(d.getTime())) return digits
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d).replace(':', '')
  } catch {
    return digits
  }
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

// Humanize Supabase/Postgres error messages for end users
export function friendlyError(msg: string): string {
  if (/row-level security/i.test(msg) || /violates.*policy/i.test(msg) || /permission denied/i.test(msg)) {
    return 'You do not have permission to perform this action.'
  }
  if (/duplicate key/i.test(msg) || /unique.*constraint/i.test(msg)) {
    return 'This record already exists.'
  }
  if (/foreign key/i.test(msg)) {
    return 'This action references data that no longer exists.'
  }
  return msg
}

// Get cleaned Supabase URL and key (returns null if not configured)
export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key || url.includes('your-project') || key === 'your-anon-key') return null
  return { url, key }
}

// Check if a Mapbox token is configured
/**
 * Resize an image File to a max dimension (default 1600px) and convert to JPEG.
 * Returns a new File ready for upload. Skips non-image files.
 * Typical reduction: 4-5MB photo → 150-300KB.
 */
export async function resizeImageForUpload(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { naturalWidth: w, naturalHeight: h } = img

      // Skip resize if already small enough
      if (w <= maxDimension && h <= maxDimension && (file.type === 'image/jpeg' || file.type === 'image/jpg')) {
        resolve(file)
        return
      }

      if (w > maxDimension || h > maxDimension) {
        const scale = Math.min(maxDimension / w, maxDimension / h)
        w = Math.round(w * scale)
        h = Math.round(h * scale)
      }

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          const ext = file.name.replace(/\.[^.]+$/, '')
          const resized = new File([blob], `${ext}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
          resolve(resized)
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // Return original on error
    }
    img.src = url
  })
}

/**
 * Compress a data URL image for PDF embedding.
 * Resizes to max 800px and re-encodes as JPEG at 0.7 quality.
 * Typical reduction: 300-500KB photo → 40-80KB in PDF.
 */
export function compressImageForPdf(dataUrl: string, maxDimension = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img
      if (w > maxDimension || h > maxDimension) {
        const scale = Math.min(maxDimension / w, maxDimension / h)
        w = Math.round(w * scale)
        h = Math.round(h * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(dataUrl); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/**
 * Generate a small thumbnail File from an image File.
 * Default: 200px max dimension, JPEG quality 0.6 → typically 5-15KB.
 */
export async function generateThumbnail(file: File, maxDimension = 200, quality = 0.6): Promise<File | null> {
  if (!file.type.startsWith('image/')) return null
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { naturalWidth: w, naturalHeight: h } = img
      const scale = Math.min(maxDimension / w, maxDimension / h, 1)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(null); return }
          resolve(new File([blob], 'thumb.jpg', { type: 'image/jpeg', lastModified: Date.now() }))
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

/** Format decimal degrees as DMS string, e.g. N43°56.34' W090°16.21' */
export function formatCoordsDMS(lat: number, lon: number): string {
  const fmt = (dec: number, pos: string, neg: string) => {
    const dir = dec >= 0 ? pos : neg
    const abs = Math.abs(dec)
    const d = Math.floor(abs)
    const m = ((abs - d) * 60).toFixed(2)
    return `${dir}${String(d).padStart(pos === 'N' ? 2 : 3, '0')}°${m}'`
  }
  return `${fmt(lat, 'N', 'S')} ${fmt(lon, 'E', 'W')}`
}

export function isMapboxConfigured(): boolean {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  return !!(token && token !== 'your-mapbox-token-here')
}

/** Fetch a Mapbox static satellite map as a data URL for PDF embedding.
 *  Returns null if Mapbox is not configured or fetch fails. */
export async function fetchMapImageDataUrl(lat: number, lng: number): Promise<string | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token || token === 'your-mapbox-token-here') return null
  try {
    const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/pin-l+ef4444(${lng},${lat})/${lng},${lat},16,0/600x300@2x?access_token=${token}&logo=false&attribution=false`
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Fetch a Mapbox static satellite map with NAVAID system features as a GeoJSON overlay.
 *  Green circles = operational, red = inoperative, larger ringed circle = the linked feature.
 *  Returns null if Mapbox is not configured or fetch fails. */
export async function fetchSystemMapImageDataUrl(
  features: { latitude: number; longitude: number; status: string; id: string }[],
  linkedFeatureId: string,
): Promise<string | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token || token === 'your-mapbox-token-here') return null
  if (features.length === 0) return null

  try {
    const linked = features.find(f => f.id === linkedFeatureId)
    if (!linked) return null

    // Show nearby features within ~150m — green for operational, red for inop/linked
    const maxDistDeg = 0.0015 // ~150m
    const nearby = features.filter(f => {
      if (f.id === linkedFeatureId) return true
      return Math.abs(f.latitude - linked.latitude) < maxDistDeg && Math.abs(f.longitude - linked.longitude) < maxDistDeg
    })

    // Build pin overlay markers: pin-s+color(lng,lat) for small, pin-l+color for large
    const pins: string[] = nearby.map(f => {
      const isLinked = f.id === linkedFeatureId
      const isInop = f.status === 'inoperative' || isLinked
      const color = isInop ? 'e53e3e' : '38a169'
      const size = isLinked ? 'l' : 's'
      return `pin-${size}+${color}(${f.longitude},${f.latitude})`
    })

    const overlay = pins.join(',')

    // Always center on the linked feature at a tight zoom
    const viewPort = `${linked.longitude},${linked.latitude},18,0`
    const padding = ''
    const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${overlay}/${viewPort}/600x400@2x?access_token=${token}&logo=false&attribution=false${padding}`
    const res = await fetch(url)
    if (!res.ok) {
      console.warn('[SystemMap] Mapbox static API error:', res.status, await res.text().catch(() => ''))
      return null
    }
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

