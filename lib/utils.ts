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

/**
 * Format a date as "DD MMM YY" (e.g. "01 JUN 26") — zero-padded UTC day,
 * uppercase 3-letter month, 2-digit year. The date form C2IMERA expects.
 */
export function formatC2imeraDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' }).toUpperCase()
  const year = String(d.getUTCFullYear()).slice(-2)
  return `${day} ${month} ${year}`
}

/**
 * Format a timestamp as "DD MMM YY // HHMM" (e.g. "01 JUN 26 // 1430") — the
 * date+time shape C2IMERA expects on import. Time is Zulu (UTC, no trailing
 * "Z"). All components are UTC.
 */
export function formatC2imeraDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${formatC2imeraDate(d)} // ${formatZuluTime(d)}`
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

/**
 * Convert a Zulu wall-clock date + HHMM time into the equivalent
 * base-local date and time in the supplied IANA timezone. Unlike
 * formatLocalTime (which is time-of-day only), this anchors to the
 * real calendar date, so it correctly handles midnight rollover — a
 * 0030Z arrival can land on the previous local day. Stored PPR time
 * values are always Zulu wall-clock, so the digits passed here are
 * treated as UTC. Returns null when inputs are malformed.
 *
 *   dateISO  — 'YYYY-MM-DD' (the Zulu calendar date)
 *   zuluHHMM — 'HHMM' or 'HH:MM' (Zulu wall clock)
 *   tz       — IANA zone, e.g. 'America/New_York'
 */
export function zuluToLocalDateTime(
  dateISO: string,
  zuluHHMM: string,
  tz: string,
): { date: string; time: string } | null {
  const digits = (zuluHHMM || '').replace(/\D/g, '').slice(0, 4)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO || '') || digits.length !== 4) return null
  const d = new Date(`${dateISO}T${digits.slice(0, 2)}:${digits.slice(2, 4)}:00Z`)
  if (Number.isNaN(d.getTime())) return null
  try {
    const date = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, month: 'numeric', day: 'numeric', year: 'numeric',
    }).format(d)
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d).replace(':', '')
    return { date, time }
  } catch {
    return null
  }
}

/**
 * Base-local parts for a Zulu wall-clock time on a known Zulu date.
 * Returns the local HHMM plus the whole-day offset from the Zulu date —
 * a 0030Z arrival can fall on the previous local day (dayDelta -1), a
 * late-evening Zulu time on the next (dayDelta +1). Unlike
 * formatLocalTime this is DST-accurate because it anchors to the real
 * calendar date. Null on malformed input or an invalid timezone.
 */
export function zuluToLocalParts(
  dateISO: string,
  zuluHHMM: string,
  tz: string,
): { time: string; dayDelta: number } | null {
  const digits = (zuluHHMM || '').replace(/\D/g, '').slice(0, 4)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO || '') || digits.length !== 4) return null
  const d = new Date(`${dateISO}T${digits.slice(0, 2)}:${digits.slice(2, 4)}:00Z`)
  if (Number.isNaN(d.getTime())) return null
  try {
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d).replace(':', '')
    // en-CA renders YYYY-MM-DD, directly comparable to the Zulu date.
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d)
    const dayDelta = Math.round(
      (Date.parse(`${localDate}T00:00:00Z`) - Date.parse(`${dateISO}T00:00:00Z`)) / 86400000,
    )
    return { time, dayDelta }
  } catch {
    return null
  }
}

/**
 * Day-offset suffix for a base-local time that crosses midnight relative
 * to its Zulu date: '' same day, ' +1d' the next local day, ' -1d' the
 * previous. ASCII hyphen (not U+2212) so it renders in jsPDF core fonts.
 */
export function formatDayDelta(delta: number): string {
  if (!delta) return ''
  return delta > 0 ? ` +${delta}d` : ` -${Math.abs(delta)}d`
}

/**
 * Full-timestamp Zulu label with the base-local equivalent appended:
 * "Jun 12, 2026 1500Z (1000L)". The local date is included when it
 * differs from the Zulu date ("... 0030Z (Jun 11 2030L)"). Returns the
 * bare Zulu label when tz is missing/UTC or the instant is unparseable,
 * so UTC bases read exactly as before.
 */
export function formatZuluDateTimeWithLocal(
  date: Date | string,
  tz: string | null | undefined,
): string {
  const zulu = formatZuluDateTime(date)
  const d = typeof date === 'string' ? new Date(date) : date
  if (!tz || tz === 'UTC' || Number.isNaN(d.getTime())) return zulu
  try {
    const localTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d).replace(':', '')
    const localDayCA = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d)
    const zuluDayCA = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d)
    // Zero-offset instant (UTC-equivalent zone right now) → nothing to add.
    if (localTime === formatZuluTime(d) && localDayCA === zuluDayCA) return zulu
    const localDateLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, month: 'short', day: 'numeric',
    }).format(d)
    const inner = localDayCA === zuluDayCA ? `${localTime}L` : `${localDateLabel} ${localTime}L`
    return `${zulu} (${inner})`
  } catch {
    return zulu
  }
}

/**
 * How many minutes `tz` is ahead of UTC at a given instant (negative for
 * zones behind UTC). Used to invert a base-local wall time back to Zulu.
 */
function tzOffsetMinutes(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)
  const m: Record<string, string> = {}
  for (const p of parts) m[p.type] = p.value
  // Intl can render midnight as "24" in some engines — normalize to 0.
  const hour = m.hour === '24' ? 0 : Number(m.hour)
  const asUTC = Date.UTC(Number(m.year), Number(m.month) - 1, Number(m.day), hour, Number(m.minute), Number(m.second))
  return Math.round((asUTC - instant.getTime()) / 60000)
}

/**
 * Inverse of formatLocalTime: convert a base-local HHMM wall time back to
 * its Zulu HHMM equivalent. Anchors to `dateISO` when supplied (else
 * today) and measures the zone's offset there, so it's DST-correct except
 * within the ~1-hour DST transition window — adequate for a live entry
 * hint. Falls back to the raw digits on malformed input.
 */
export function localTimeToZulu(localHHMM: string, tz: string, dateISO?: string): string {
  const digits = (localHHMM || '').replace(/\D/g, '').slice(0, 4)
  if (digits.length !== 4) return digits
  const hh = Number(digits.slice(0, 2))
  const mm = Number(digits.slice(2, 4))
  if (hh > 23 || mm > 59) return digits
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dateISO || '') ? (dateISO as string) : new Date().toISOString().slice(0, 10)
  try {
    // Treat the digits as UTC to get a reference instant, measure the
    // zone's offset there, then shift so the digits read as local.
    const guess = new Date(`${day}T${digits.slice(0, 2)}:${digits.slice(2, 4)}:00Z`)
    if (Number.isNaN(guess.getTime())) return digits
    const offMin = tzOffsetMinutes(guess, tz)
    const utc = new Date(guess.getTime() - offMin * 60000)
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(utc).replace(':', '')
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

// Sanitize a regulation ID into a safe file name (e.g., "DAFMAN 13-204, Vol 1" → "dafman-13-204-vol-1")
export function sanitizeRegId(regId: string): string {
  return regId
    .toLowerCase()
    .replace(/,\s*/g, '-')
    .replace(/\.\s+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

/**
 * Escape a string for safe interpolation into an HTML string assigned via
 * innerHTML / Google Maps InfoWindow setContent(). Prevents stored XSS when
 * user-controlled text (discrepancy titles, NAVAID notes, waiver
 * descriptions, obstruction notes, sign text, fixture IDs) is rendered in a
 * popup. Escapes the five HTML-significant characters so the value can never
 * break out of text content OR a double-quoted attribute.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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

/**
 * Normalize a user-typed name to "safe per-word" title case for account
 * creation (self-signup + admin invite). Trims, collapses internal
 * whitespace, then capitalizes the first letter of each part split on
 * space / hyphen / apostrophe and lowercases the rest:
 *   "mcDONALD-o'brien" → "Mcdonald-O'Brien"
 * Deliberately no Mc/Mac heuristics — they mis-case legitimate names
 * (Macey, Machado). Empty / whitespace-only input returns "".
 */
export function toTitleCaseName(raw: string): string {
  const collapsed = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (!collapsed) return ''
  // Capitalize the letter that begins the string or follows a separator
  // (space, hyphen, apostrophe), lowercase everything else.
  return collapsed
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
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

