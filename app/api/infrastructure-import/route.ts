import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import geojsonData from '@/lib/data/selfridge-lighting-signage.json'

// POST /api/infrastructure-import?baseId=<uuid>
// One-time bulk import of static GeoJSON features into the database
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const baseId = searchParams.get('baseId')

  if (!baseId) {
    return NextResponse.json({ error: 'baseId is required' }, { status: 400 })
  }

  const supabase = createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if features already exist for this base
  const { count } = await supabase
    .from('infrastructure_features')
    .select('*', { count: 'exact', head: true })
    .eq('base_id', baseId)
    .eq('source', 'import')

  if (count && count > 0) {
    return NextResponse.json({ error: `${count} imported features already exist for this base. Delete them first to re-import.` }, { status: 409 })
  }

  const features = (geojsonData as any).features as any[]
  const rows = features.map((f: any) => ({
    base_id: baseId,
    feature_type: f.properties.type,
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
    layer: f.properties.layer || null,
    block: f.properties.block || null,
    label: f.properties.text || null,
    notes: null,
    source: 'import',
    created_by: user.id,
  }))

  // Insert in batches of 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('infrastructure_features')
      .insert(batch as any)
    if (error) {
      return NextResponse.json({ error: error.message, inserted }, { status: 500 })
    }
    inserted += batch.length
  }

  return NextResponse.json({ inserted, total: features.length })
}
