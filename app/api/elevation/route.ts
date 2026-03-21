import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat')
  const lon = req.nextUrl.searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`,
      {
        signal: AbortSignal.timeout(10000),
        // Node fetch doesn't enforce browser SSL restrictions
      },
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream error' }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Elevation service unavailable' }, { status: 502 })
  }
}
