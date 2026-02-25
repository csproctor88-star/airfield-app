import { NextRequest, NextResponse } from 'next/server'

const FAA_API_URL = 'https://api.data.gov/faa/notamapi/v1/notams'

interface FaaNotamProperties {
  coreNOTAMData?: {
    notam?: {
      id?: string
      number?: string
      type?: string
      classification?: string
      effectiveStart?: string
      effectiveEnd?: string
      text?: string
      location?: string
    }
  }
}

interface FaaFeature {
  properties?: FaaNotamProperties
}

interface FaaGeoJsonResponse {
  items?: FaaFeature[]
}

function normalizeNotam(feature: FaaFeature, index: number) {
  const core = feature.properties?.coreNOTAMData?.notam
  if (!core) return null

  const effectiveEnd = core.effectiveEnd || ''
  const now = new Date()
  const isExpired = effectiveEnd ? new Date(effectiveEnd) < now : false

  // Extract a short title from the full text (first line or first 80 chars)
  const fullText = core.text || ''
  const title = fullText.split('\n')[0]?.slice(0, 100) || core.number || `NOTAM ${index + 1}`

  return {
    id: core.id || `faa-${index}`,
    notam_number: core.number || '',
    source: 'faa' as const,
    status: isExpired ? ('expired' as const) : ('active' as const),
    notam_type: core.classification || core.type || 'NOTAM',
    title,
    full_text: fullText,
    effective_start: core.effectiveStart || '',
    effective_end: effectiveEnd,
  }
}

export async function GET(request: NextRequest) {
  const icao = request.nextUrl.searchParams.get('icao')?.trim().toUpperCase()

  if (!icao || !/^[A-Z]{3,4}$/.test(icao)) {
    return NextResponse.json(
      { error: 'Invalid or missing ICAO code. Provide ?icao=KSEM (3-4 letter code).' },
      { status: 400 }
    )
  }

  const apiKey = process.env.FAA_NOTAM_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'FAA NOTAM API key is not configured. Set FAA_NOTAM_API_KEY in your environment.' },
      { status: 503 }
    )
  }

  try {
    const url = new URL(FAA_API_URL)
    url.searchParams.set('domesticLocation', icao)
    url.searchParams.set('sortBy', 'effectiveStartDate')
    url.searchParams.set('sortOrder', 'DESC')
    url.searchParams.set('pageSize', '50')
    url.searchParams.set('api_key', apiKey)

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/geo+json',
      },
      next: { revalidate: 300 }, // cache for 5 minutes
    })

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { error: 'FAA API authentication failed. Check your FAA_NOTAM_API_KEY.' },
        { status: 401 }
      )
    }

    if (res.status === 429) {
      return NextResponse.json(
        { error: 'FAA API rate limit reached. Try again in a few minutes.' },
        { status: 429 }
      )
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `FAA API returned status ${res.status}.` },
        { status: 502 }
      )
    }

    const data: FaaGeoJsonResponse = await res.json()
    const items = data.items || []

    const notams = items
      .map((feature, i) => normalizeNotam(feature, i))
      .filter(Boolean)

    return NextResponse.json({ notams, icao, fetchedAt: new Date().toISOString() })
  } catch (err) {
    console.error('FAA NOTAM fetch error:', err)
    return NextResponse.json(
      { error: 'Failed to reach FAA NOTAM API. Check your network connection.' },
      { status: 502 }
    )
  }
}
