import { NextResponse } from 'next/server'

// Stub for future METAR weather fetch (SRS Section 11.2)
// Endpoint: https://aviationweather.gov/api/data/metar?ids=KMTC&format=json

export async function GET() {
  return NextResponse.json({
    message: 'Weather API not yet implemented. Placeholder data used for v1.',
    status: 'stub',
    placeholder: {
      station: 'KMTC',
      temperature_f: 28,
      wind: '310/08',
      visibility_sm: 10,
      altimeter: 30.12,
      conditions: 'Clear',
      flight_category: 'VFR',
    },
  })
}
