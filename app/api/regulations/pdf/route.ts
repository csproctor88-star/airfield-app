import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const BUCKET = 'regulation-pdfs'

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')

  if (!path || path.includes('..') || path.startsWith('/')) {
    return new NextResponse('Invalid path', { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return new NextResponse('Storage not configured', { status: 500 })
  }

  const supabase = createClient(url, key)

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(path)

  if (error || !data) {
    return NextResponse.json(
      { error: 'not_found', path },
      { status: 404 }
    )
  }

  const arrayBuffer = await data.arrayBuffer()
  const fileName = path.split('/').pop() || 'document.pdf'

  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
