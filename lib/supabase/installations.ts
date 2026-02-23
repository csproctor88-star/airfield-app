import { createClient } from './client'
import type { Installation, InstallationRunway, InstallationNavaid, InstallationArea, InstallationMember } from './types'

// ── Fetch all active installations ──
export async function fetchInstallations(): Promise<Installation[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('bases')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Failed to fetch installations:', error.message)
    return []
  }

  return data as Installation[]
}

// ── Fetch a single installation by ID ──
export async function fetchInstallation(id: string): Promise<Installation | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('bases')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch installation:', error.message)
    return null
  }

  return data as Installation
}

// ── Fetch runways for an installation ──
export async function fetchInstallationRunways(installationId: string): Promise<InstallationRunway[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('base_runways')
    .select('*')
    .eq('base_id', installationId)
    .order('runway_id')

  if (error) {
    console.error('Failed to fetch installation runways:', error.message)
    return []
  }

  return data as InstallationRunway[]
}

// ── Fetch NAVAIDs for an installation ──
export async function fetchInstallationNavaids(installationId: string): Promise<InstallationNavaid[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('base_navaids')
    .select('*')
    .eq('base_id', installationId)
    .order('sort_order')

  if (error) {
    console.error('Failed to fetch installation NAVAIDs:', error.message)
    return []
  }

  return data as InstallationNavaid[]
}

// ── Fetch airfield areas for an installation ──
export async function fetchInstallationAreas(installationId: string): Promise<InstallationArea[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('base_areas')
    .select('*')
    .eq('base_id', installationId)
    .order('sort_order')

  if (error) {
    console.error('Failed to fetch installation areas:', error.message)
    return []
  }

  return data as InstallationArea[]
}

// ── Fetch installations the current user belongs to ──
export async function fetchUserInstallations(): Promise<(Installation & { member_role: string })[]> {
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
    console.error('Failed to fetch user installations:', error.message)
    return []
  }

  return (data ?? [])
    .filter((row: Record<string, unknown>) => row.bases)
    .map((row: Record<string, unknown>) => ({
      ...(row.bases as Installation),
      member_role: row.role as string,
    }))
}

// ── Fetch installation members ──
export async function fetchInstallationMembers(installationId: string): Promise<(InstallationMember & { name: string; rank: string | null; email: string })[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('base_members')
    .select('*, profiles:user_id(name, rank, email)')
    .eq('base_id', installationId)

  if (error) {
    console.error('Failed to fetch installation members:', error.message)
    return []
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
    rank: (row.profiles as { rank?: string } | null)?.rank || null,
    email: (row.profiles as { email?: string } | null)?.email || '',
  })) as (InstallationMember & { name: string; rank: string | null; email: string })[]
}

// ── Add user to an installation ──
export async function addInstallationMember(
  installationId: string,
  userId: string,
  role: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('base_members')
    .upsert({ base_id: installationId, user_id: userId, role }, { onConflict: 'base_id,user_id' })

  if (error) {
    console.error('Failed to add installation member:', error.message)
    return { error: error.message }
  }

  return { error: null }
}

// ── Get user's primary installation ID (from profile or first membership) ──
export async function getUserPrimaryInstallationId(): Promise<string | null> {
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

    // Fall back to first installation membership
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
