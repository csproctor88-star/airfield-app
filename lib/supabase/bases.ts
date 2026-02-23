import { createClient } from './client'
import type { Base, BaseRunway, BaseNavaid, BaseArea, BaseMember } from './types'

// ── Fetch all active bases ──
export async function fetchBases(): Promise<Base[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('bases')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Failed to fetch bases:', error.message)
    return []
  }

  return data as Base[]
}

// ── Fetch a single base by ID ──
export async function fetchBase(id: string): Promise<Base | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('bases')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch base:', error.message)
    return null
  }

  return data as Base
}

// ── Fetch runways for a base ──
export async function fetchBaseRunways(baseId: string): Promise<BaseRunway[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('base_runways')
    .select('*')
    .eq('base_id', baseId)
    .order('runway_id')

  if (error) {
    console.error('Failed to fetch base runways:', error.message)
    return []
  }

  return data as BaseRunway[]
}

// ── Fetch NAVAIDs for a base ──
export async function fetchBaseNavaids(baseId: string): Promise<BaseNavaid[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('base_navaids')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order')

  if (error) {
    console.error('Failed to fetch base NAVAIDs:', error.message)
    return []
  }

  return data as BaseNavaid[]
}

// ── Fetch airfield areas for a base ──
export async function fetchBaseAreas(baseId: string): Promise<BaseArea[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('base_areas')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order')

  if (error) {
    console.error('Failed to fetch base areas:', error.message)
    return []
  }

  return data as BaseArea[]
}

// ── Fetch bases the current user belongs to ──
export async function fetchUserBases(): Promise<(Base & { member_role: string })[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('base_members')
    .select('role, bases(*)')
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to fetch user bases:', error.message)
    return []
  }

  return (data ?? [])
    .filter((row: Record<string, unknown>) => row.bases)
    .map((row: Record<string, unknown>) => ({
      ...(row.bases as Base),
      member_role: row.role as string,
    }))
}

// ── Fetch base members ──
export async function fetchBaseMembers(baseId: string): Promise<(BaseMember & { name: string; rank: string | null; email: string })[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('base_members')
    .select('*, profiles:user_id(name, rank, email)')
    .eq('base_id', baseId)

  if (error) {
    console.error('Failed to fetch base members:', error.message)
    return []
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
    rank: (row.profiles as { rank?: string } | null)?.rank || null,
    email: (row.profiles as { email?: string } | null)?.email || '',
  })) as (BaseMember & { name: string; rank: string | null; email: string })[]
}

// ── Add user to a base ──
export async function addBaseMember(
  baseId: string,
  userId: string,
  role: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('base_members')
    .upsert({ base_id: baseId, user_id: userId, role }, { onConflict: 'base_id,user_id' })

  if (error) {
    console.error('Failed to add base member:', error.message)
    return { error: error.message }
  }

  return { error: null }
}

// ── Get user's primary base ID (from profile or first membership) ──
export async function getUserPrimaryBaseId(): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Check profile.primary_base_id first
    const { data: profile } = await supabase
      .from('profiles')
      .select('primary_base_id')
      .eq('id', user.id)
      .single()

    if (profile?.primary_base_id) return profile.primary_base_id as string

    // Fall back to first base membership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from('base_members')
      .select('base_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    return membership?.base_id || null
  } catch {
    return null
  }
}
