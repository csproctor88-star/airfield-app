import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat')
  const lon = req.nextUrl.searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_ELEVATION_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Elevation API not configured' }, { status: 503 })
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lon}&key=${apiKey}`,
      { signal: AbortSignal.timeout(8000) },
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream error' }, { status: 502 })
    }

    const data = await res.json()
    if (data?.status !== 'OK') {
      return NextResponse.json({ error: data?.error_message || 'Elevation lookup failed' }, { status: 502 })
    }

    // Return in same format as Open-Elevation for client compatibility
    return NextResponse.json({
      results: data.results.map((r: { elevation: number; location: { lat: number; lng: number } }) => ({
        latitude: r.location.lat,
        longitude: r.location.lng,
        elevation: r.elevation,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Elevation service unavailable' }, { status: 502 })
  }
}
