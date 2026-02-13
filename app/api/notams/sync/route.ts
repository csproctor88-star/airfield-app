import { NextResponse } from 'next/server'

// Stub for future NASA DIP API NOTAM sync (SRS Section 11.1)
// Endpoint: https://external-api.faa.gov/notamapi/v1/notams?domesticLocation=KMTC

export async function GET() {
  return NextResponse.json({
    message: 'NOTAM sync not yet implemented. Manual entry only for v1.',
    status: 'stub',
  })
}
