import { createClient } from './client'
import { logActivity } from './activity'

// Helper: cast supabase to bypass strict table typing for new tables not yet in generated types
function db() {
  const supabase = createClient()
  return supabase ? (supabase as any) : null
}

// ── Types ──

export type ParkingPlan = {
  id: string
  base_id: string
  plan_name: string
  description: string | null
  is_active: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type ParkingSpot = {
  id: string
  plan_id: string
  base_id: string
  spot_name: string | null
  spot_type: 'apron' | 'ramp' | 'transient' | null
  aircraft_name: string | null
  tail_number: string | null
  unit_callsign: string | null
  longitude: number
  latitude: number
  heading_deg: number
  clearance_ft: number | null
  status: 'occupied' | 'available' | 'reserved'
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type ParkingObstacle = {
  id: string
  base_id: string
  obstacle_type: 'point' | 'building' | 'line' | 'circle'
  name: string | null
  longitude: number
  latitude: number
  width_ft: number | null
  length_ft: number | null
  rotation_deg: number | null
  radius_ft: number | null
  height_ft: number | null
  line_coords: [number, number][] | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── Plans CRUD ──

export async function fetchParkingPlans(baseId: string): Promise<ParkingPlan[]> {
  const supabase = db()
  if (!supabase) return []

  const { data } = await supabase
    .from('parking_plans')
    .select('*')
    .eq('base_id', baseId)
    .order('created_at', { ascending: false })

  return (data || []) as ParkingPlan[]
}

export async function fetchActivePlan(baseId: string): Promise<ParkingPlan | null> {
  const supabase = db()
  if (!supabase) return null

  const { data } = await supabase
    .from('parking_plans')
    .select('*')
    .eq('base_id', baseId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  return (data as ParkingPlan) || null
}

export async function createParkingPlan(input: {
  base_id: string
  plan_name: string
  description?: string
  is_active?: boolean
}): Promise<ParkingPlan | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('parking_plans')
    .insert({
      ...input,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()

  if (error || !data) return null

  const plan = data as ParkingPlan
  logActivity('created', 'parking_plan', plan.id, plan.plan_name, undefined, input.base_id)
  return plan
}

export async function updateParkingPlan(
  id: string,
  updates: Partial<Pick<ParkingPlan, 'plan_name' | 'description' | 'is_active'>>,
  baseId?: string
): Promise<ParkingPlan | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('parking_plans')
    .update({ ...updates, updated_by: user?.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null

  const plan = data as ParkingPlan
  logActivity('updated', 'parking_plan', plan.id, plan.plan_name, undefined, baseId)
  return plan
}

export async function deleteParkingPlan(id: string, planName?: string, baseId?: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  const { error } = await supabase
    .from('parking_plans')
    .delete()
    .eq('id', id)

  if (!error && planName) {
    logActivity('deleted', 'parking_plan', id, planName, undefined, baseId)
  }
  return !error
}

export async function setActivePlan(planId: string, baseId: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  // Clear all active flags for this base
  await supabase
    .from('parking_plans')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('base_id', baseId)
    .eq('is_active', true)

  // Set the target plan as active
  const { error } = await supabase
    .from('parking_plans')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', planId)

  return !error
}

// ── Spots CRUD ──

export async function fetchParkingSpots(planId: string): Promise<ParkingSpot[]> {
  const supabase = db()
  if (!supabase) return []

  const { data } = await supabase
    .from('parking_spots')
    .select('*')
    .eq('plan_id', planId)
    .order('sort_order', { ascending: true })

  return (data || []) as ParkingSpot[]
}

export async function createParkingSpot(input: {
  plan_id: string
  base_id: string
  spot_name?: string
  spot_type?: string
  aircraft_name?: string
  tail_number?: string
  unit_callsign?: string
  longitude: number
  latitude: number
  heading_deg?: number
  clearance_ft?: number
  status?: string
  notes?: string
}): Promise<ParkingSpot | null> {
  const supabase = db()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('parking_spots')
    .insert(input)
    .select()
    .single()

  if (error || !data) return null
  return data as ParkingSpot
}

export async function updateParkingSpot(
  id: string,
  updates: Partial<Omit<ParkingSpot, 'id' | 'plan_id' | 'base_id' | 'created_at'>>
): Promise<ParkingSpot | null> {
  const supabase = db()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('parking_spots')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return data as ParkingSpot
}

export async function deleteParkingSpot(id: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  const { error } = await supabase
    .from('parking_spots')
    .delete()
    .eq('id', id)

  return !error
}

export async function bulkUpdateSpotPositions(
  updates: { id: string; longitude: number; latitude: number; heading_deg: number }[]
): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  const now = new Date().toISOString()

  const promises = updates.map(u =>
    supabase
      .from('parking_spots')
      .update({ longitude: u.longitude, latitude: u.latitude, heading_deg: u.heading_deg, updated_at: now })
      .eq('id', u.id)
  )

  const results = await Promise.all(promises)
  return results.every((r: any) => !r.error)
}

// ── Obstacles CRUD ──

export async function fetchParkingObstacles(baseId: string): Promise<ParkingObstacle[]> {
  const supabase = db()
  if (!supabase) return []

  const { data } = await supabase
    .from('parking_obstacles')
    .select('*')
    .eq('base_id', baseId)
    .order('created_at', { ascending: true })

  return (data || []) as ParkingObstacle[]
}

export async function createParkingObstacle(input: {
  base_id: string
  obstacle_type: string
  name?: string
  longitude: number
  latitude: number
  width_ft?: number
  length_ft?: number
  rotation_deg?: number
  radius_ft?: number
  height_ft?: number
  line_coords?: [number, number][]
  notes?: string
}): Promise<ParkingObstacle | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('parking_obstacles')
    .insert({ ...input, created_by: user?.id })
    .select()
    .single()

  if (error || !data) return null
  return data as ParkingObstacle
}

export async function updateParkingObstacle(
  id: string,
  updates: Partial<Omit<ParkingObstacle, 'id' | 'base_id' | 'created_by' | 'created_at'>>
): Promise<ParkingObstacle | null> {
  const supabase = db()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('parking_obstacles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return data as ParkingObstacle
}

export async function deleteParkingObstacle(id: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  const { error } = await supabase
    .from('parking_obstacles')
    .delete()
    .eq('id', id)

  return !error
}
