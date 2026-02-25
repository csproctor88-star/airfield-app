import { NextRequest, NextResponse } from 'next/server'

// FAA public NOTAM Search backend — no API key required
const FAA_NOTAM_SEARCH_URL = 'https://notams.aim.faa.gov/notamSearch/search'

interface FaaNotamItem {
  notamNumber?: string
  featureName?: string
  keyword?: string
  issueDate?: string
  startDate?: string
  endDate?: string
  source?: string
  sourceType?: string
  icaoMessage?: string
  traditionalMessage?: string
  traditionalMessageFrom4thWord?: string
  icaoId?: string
  airportName?: string
  cancelledOrExpired?: boolean
  status?: string
  facilityDesignator?: string
  transactionID?: number
}

interface FaaSearchResponse {
  notamList?: FaaNotamItem[]
  totalNotamCount?: number
}

function normalizeNotam(item: FaaNotamItem, index: number) {
  const endStr = item.endDate || ''
  const now = new Date()

  // Parse FAA date format "MM/DD/YYYY HHMM" or "PERM"
  const isPerm = endStr.toUpperCase() === 'PERM'
  let isExpired = false
  if (!isPerm && endStr) {
    const parsed = parseFaaDate(endStr)
    if (parsed) isExpired = parsed < now
  }
  // Also respect the FAA's own status/cancelledOrExpired flag
  if (item.cancelledOrExpired) isExpired = true

  // Build title from the keyword + first portion of the traditional message
  const messageText = item.traditionalMessageFrom4thWord || item.icaoMessage || ''
  const title = messageText.split('\n')[0]?.slice(0, 120) || item.notamNumber || `NOTAM ${index + 1}`

  const fullText = item.icaoMessage || item.traditionalMessage || messageText

  return {
    id: `faa-${item.transactionID || index}`,
    notam_number: item.notamNumber || '',
    source: 'faa' as const,
    status: isExpired ? ('expired' as const) : ('active' as const),
    notam_type: item.keyword || item.featureName || 'NOTAM',
    title,
    full_text: fullText,
    effective_start: item.startDate || item.issueDate || '',
    effective_end: endStr,
  }
}

function parseFaaDate(str: string): Date | null {
  // Format: "MM/DD/YYYY HHMM"
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})(\d{2})$/)
  if (!match) return null
  const [, month, day, year, hour, minute] = match
  return new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute))
}

export async function GET(request: NextRequest) {
  const icao = request.nextUrl.searchParams.get('icao')?.trim().toUpperCase()

  if (!icao || !/^[A-Z]{3,4}$/.test(icao)) {
    return NextResponse.json(
      { error: 'Invalid or missing ICAO code. Provide ?icao=KSEM (3-4 letter code).' },
      { status: 400 }
    )
  }

  try {
    const res = await fetch(FAA_NOTAM_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `searchType=0&designatorsForLocation=${encodeURIComponent(icao)}`,
      next: { revalidate: 300 }, // cache for 5 minutes
    })

    if (res.status === 429) {
      return NextResponse.json(
        { error: 'FAA rate limit reached. Try again in a few minutes.' },
        { status: 429 }
      )
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `FAA NOTAM Search returned status ${res.status}.` },
        { status: 502 }
      )
    }

    const data: FaaSearchResponse = await res.json()
    const items = data.notamList || []

    const notams = items.map((item, i) => normalizeNotam(item, i))

    return NextResponse.json({
      notams,
      icao,
      totalCount: data.totalNotamCount || notams.length,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('FAA NOTAM fetch error:', err)
    return NextResponse.json(
      { error: 'Failed to reach FAA NOTAM Search. Check your network connection.' },
      { status: 502 }
    )
  }
}
