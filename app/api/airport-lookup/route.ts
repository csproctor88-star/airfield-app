import { NextRequest, NextResponse } from 'next/server'

/**
 * Airport data lookup via OurAirports open data + FAA NFDC supplement.
 * GET /api/airport-lookup?icao=KVOK
 *
 * Returns structured airport + runway data for base onboarding.
 * OurAirports provides worldwide coverage (runways, frequencies).
 * FAA NFDC supplements US airports with approach lighting & PAPI details.
 */

// ── Types ──

interface RunwayData {
  runway_id: string
  length_ft: number
  width_ft: number
  surface: string
  lighted: boolean
  end1_designator: string
  end1_latitude: number | null
  end1_longitude: number | null
  end1_elevation_msl: number | null
  end1_heading: number | null
  end1_approach_lighting: string | null
  end2_designator: string
  end2_latitude: number | null
  end2_longitude: number | null
  end2_elevation_msl: number | null
  end2_heading: number | null
  end2_approach_lighting: string | null
}

interface FrequencyData {
  type: string
  description: string
  frequency_mhz: number
}

interface AirportLookupResult {
  icao: string
  name: string
  latitude: number
  longitude: number
  elevation_ft: number | null
  municipality: string
  country: string
  region: string
  runways: RunwayData[]
  frequencies: FrequencyData[]
}

// ── CSV parsing ──

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

function csvToObjects(csv: string): Record<string, string>[] {
  const lines = csv.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/^"|"$/g, '') })
    return obj
  })
}

// ── Surface code mapping ──

const SURFACE_MAP: Record<string, string> = {
  ASP: 'Asphalt',
  CON: 'Concrete',
  'ASP-G': 'Asphalt/Grooved',
  'CON-G': 'Concrete/Grooved',
  GRS: 'Grass',
  GVL: 'Gravel',
  GRVL: 'Gravel',
  TURF: 'Turf',
  DIRT: 'Dirt',
  PEM: 'PEM',
}

function decodeSurface(code: string): string {
  return SURFACE_MAP[code.toUpperCase()] || code
}

// ── In-memory cache (5 min TTL) ──

let cachedAirports: { data: string; ts: number } | null = null
let cachedRunways: { data: string; ts: number } | null = null
let cachedFreqs: { data: string; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

async function fetchCached(url: string, cache: { data: string; ts: number } | null): Promise<{ text: string; cache: { data: string; ts: number } }> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return { text: cache.data, cache }
  }
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const text = await res.text()
  const newCache = { data: text, ts: Date.now() }
  return { text, cache: newCache }
}

// ── FAA NFDC supplement for US airports ──

async function fetchFAAData(faaId: string): Promise<{ end1_approach?: string; end2_approach?: string; navaids?: string[] } | null> {
  try {
    const url = `https://nfdc.faa.gov/nfdcApps/services/ajv5/airportDisplay.jsp?airportId=${faaId}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const html = await res.text()

    // Extract approach lighting from HTML (best-effort parsing)
    const approaches: string[] = []
    const approachMatches = html.match(/Approach lights:.*?<\/td>/gi)
    if (approachMatches) {
      for (const m of approachMatches) {
        const text = m.replace(/<[^>]+>/g, '').replace('Approach lights:', '').trim()
        approaches.push(text)
      }
    }

    // Extract NAVAID names
    const navaids: string[] = []
    const navaidSection = html.match(/NAVAIDS[\s\S]*?(?=<h[23]|$)/i)
    if (navaidSection) {
      const rows = navaidSection[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
      for (const row of rows) {
        const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi)
        if (cells && cells.length >= 2) {
          const type = cells[0].replace(/<[^>]+>/g, '').trim()
          const name = cells[1].replace(/<[^>]+>/g, '').trim()
          if (type && name && !type.includes('Type')) {
            navaids.push(`${type} ${name}`.trim())
          }
        }
      }
    }

    return {
      end1_approach: approaches[0] || undefined,
      end2_approach: approaches[1] || undefined,
      navaids: navaids.length > 0 ? navaids : undefined,
    }
  } catch {
    return null
  }
}

// ── Main handler ──

export async function GET(req: NextRequest) {
  const icao = req.nextUrl.searchParams.get('icao')?.toUpperCase()
  if (!icao || icao.length < 3 || icao.length > 4) {
    return NextResponse.json({ error: 'Valid ICAO code required (3-4 characters)' }, { status: 400 })
  }

  try {
    // Fetch OurAirports data in parallel
    const [airportsResult, runwaysResult, freqsResult] = await Promise.all([
      fetchCached('https://davidmegginson.github.io/ourairports-data/airports.csv', cachedAirports),
      fetchCached('https://davidmegginson.github.io/ourairports-data/runways.csv', cachedRunways),
      fetchCached('https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv', cachedFreqs),
    ])

    // Update caches
    cachedAirports = airportsResult.cache
    cachedRunways = runwaysResult.cache
    cachedFreqs = freqsResult.cache

    // Find airport
    const airports = csvToObjects(airportsResult.text)
    const airport = airports.find(a => a.ident === icao || a.icao_code === icao)
    if (!airport) {
      return NextResponse.json({ error: `Airport ${icao} not found` }, { status: 404 })
    }

    // Find runways
    const allRunways = csvToObjects(runwaysResult.text)
    const rwyRows = allRunways.filter(r => r.airport_ident === icao)

    // Find frequencies
    const allFreqs = csvToObjects(freqsResult.text)
    const freqRows = allFreqs.filter(f => f.airport_ident === icao)

    // Try FAA supplement for US airports
    const isUS = airport.iso_country === 'US'
    const faaId = airport.local_code || icao.replace(/^K/, '')
    const faaData = isUS ? await fetchFAAData(faaId) : null

    // Build runway data
    const runways: RunwayData[] = rwyRows
      .filter(r => r.closed !== '1')
      .map((r, i) => {
        const le = r.le_ident || ''
        const he = r.he_ident || ''
        return {
          runway_id: `${le}/${he}`,
          length_ft: parseInt(r.length_ft) || 0,
          width_ft: parseInt(r.width_ft) || 0,
          surface: decodeSurface(r.surface || ''),
          lighted: r.lighted === '1',
          end1_designator: le,
          end1_latitude: parseFloat(r.le_latitude_deg) || null,
          end1_longitude: parseFloat(r.le_longitude_deg) || null,
          end1_elevation_msl: parseFloat(r.le_elevation_ft) || null,
          end1_heading: parseFloat(r.le_heading_degT) || null,
          end1_approach_lighting: (i === 0 && faaData?.end1_approach) ? faaData.end1_approach : null,
          end2_designator: he,
          end2_latitude: parseFloat(r.he_latitude_deg) || null,
          end2_longitude: parseFloat(r.he_longitude_deg) || null,
          end2_elevation_msl: parseFloat(r.he_elevation_ft) || null,
          end2_heading: parseFloat(r.he_heading_degT) || null,
          end2_approach_lighting: (i === 0 && faaData?.end2_approach) ? faaData.end2_approach : null,
        }
      })

    // Build frequencies
    const frequencies: FrequencyData[] = freqRows.map(f => ({
      type: f.type || '',
      description: f.description || '',
      frequency_mhz: parseFloat(f.frequency_mhz) || 0,
    }))

    const result: AirportLookupResult = {
      icao,
      name: airport.name || '',
      latitude: parseFloat(airport.latitude_deg) || 0,
      longitude: parseFloat(airport.longitude_deg) || 0,
      elevation_ft: parseFloat(airport.elevation_ft) || null,
      municipality: airport.municipality || '',
      country: airport.iso_country || '',
      region: airport.iso_region || '',
      runways,
      frequencies,
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Lookup failed: ${message}` }, { status: 500 })
  }
}
