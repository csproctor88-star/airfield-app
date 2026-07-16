import { createClient } from './client'
import { logActivity } from './activity'
import { friendlyError } from '@/lib/utils'

function db() {
  return createClient()
}

// ── Types ──

export type ParkingPlan = {
  id: string
  base_id: string
  plan_name: string
  description: string | null
  is_active: boolean
  is_template: boolean
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

export type ParkingTaxilane = {
  id: string
  base_id: string
  plan_id: string
  name: string | null
  taxilane_type: 'interior' | 'peripheral'
  design_aircraft: string | null
  design_wingspan_ft: number | null
  line_coords: [number, number][]
  is_transient: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ParkingApronBoundary = {
  id: string
  base_id: string
  plan_id: string
  name: string | null
  polygon_coords: [number, number][]
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

export async function createParkingPlan(input: {
  base_id: string
  plan_name: string
  description?: string
  is_active?: boolean
  is_template?: boolean
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
  updates: Partial<Pick<ParkingPlan, 'plan_name' | 'description' | 'is_active' | 'is_template'>>,
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

/** Deep-copy a parking plan (spots, taxilanes, apron boundaries) into a new plan */
export async function duplicateParkingPlan(
  sourcePlanId: string,
  baseId: string,
  newName: string,
  newDescription?: string,
  asTemplate?: boolean,
): Promise<ParkingPlan | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Create the new plan
  const { data: planData, error: planErr } = await supabase
    .from('parking_plans')
    .insert({
      base_id: baseId,
      plan_name: newName,
      description: newDescription || null,
      is_active: false,
      is_template: asTemplate || false,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()

  if (planErr || !planData) return null
  const newPlan = planData as ParkingPlan

  // A child-copy failure must not leave a silently empty/partial duplicate of
  // a persistent record. If any copy fails, roll the new plan back (deletes
  // it and any partial children) and return null so the caller reports failure.
  const rollback = async () => {
    await deleteParkingPlan(newPlan.id, newPlan.plan_name, baseId)
    return null
  }

  // Copy spots
  const { data: srcSpots } = await supabase
    .from('parking_spots')
    .select('*')
    .eq('plan_id', sourcePlanId)

  if (srcSpots && srcSpots.length > 0) {
    const spotInserts = srcSpots.map((s: any) => ({
      plan_id: newPlan.id,
      base_id: baseId,
      spot_name: s.spot_name,
      spot_type: s.spot_type,
      aircraft_name: s.aircraft_name,
      tail_number: s.tail_number,
      unit_callsign: s.unit_callsign,
      longitude: s.longitude,
      latitude: s.latitude,
      heading_deg: s.heading_deg,
      clearance_ft: s.clearance_ft,
      status: 'available',
      notes: s.notes,
      sort_order: s.sort_order,
    }))
    const { error } = await supabase.from('parking_spots').insert(spotInserts)
    if (error) {
      console.error('duplicateParkingPlan: failed to copy spots:', error.message)
      return rollback()
    }
  }

  // Copy taxilanes
  const { data: srcTaxilanes } = await supabase
    .from('parking_taxilanes')
    .select('*')
    .eq('plan_id', sourcePlanId)

  if (srcTaxilanes && srcTaxilanes.length > 0) {
    const taxiInserts = srcTaxilanes.map((t: any) => ({
      plan_id: newPlan.id,
      base_id: baseId,
      name: t.name,
      taxilane_type: t.taxilane_type,
      design_aircraft: t.design_aircraft,
      design_wingspan_ft: t.design_wingspan_ft,
      line_coords: t.line_coords,
      is_transient: t.is_transient,
      notes: t.notes,
      created_by: user.id,
    }))
    const { error } = await supabase.from('parking_taxilanes').insert(taxiInserts)
    if (error) {
      console.error('duplicateParkingPlan: failed to copy taxilanes:', error.message)
      return rollback()
    }
  }

  // Copy apron boundaries
  const { data: srcBoundaries } = await supabase
    .from('parking_apron_boundaries')
    .select('*')
    .eq('plan_id', sourcePlanId)

  if (srcBoundaries && srcBoundaries.length > 0) {
    const boundInserts = srcBoundaries.map((b: any) => ({
      plan_id: newPlan.id,
      base_id: baseId,
      name: b.name,
      polygon_coords: b.polygon_coords,
      notes: b.notes,
      created_by: user.id,
    }))
    const { error } = await supabase.from('parking_apron_boundaries').insert(boundInserts)
    if (error) {
      console.error('duplicateParkingPlan: failed to copy apron boundaries:', error.message)
      return rollback()
    }
  }

  logActivity('created', 'parking_plan', newPlan.id, newPlan.plan_name, { duplicated_from: sourcePlanId }, baseId)
  return newPlan
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
): Promise<{ data: ParkingSpot | null; error: string | null }> {
  const supabase = db()
  // Unconfigured / demo mode: no persistence layer — treat as a silent no-op,
  // NOT an error, so the UI doesn't falsely report a save failure.
  if (!supabase) return { data: null, error: null }

  const { data, error } = await supabase
    .from('parking_spots')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update parking spot:', error.message)
    return { data: null, error: friendlyError(error.message) }
  }
  return { data: data as ParkingSpot, error: null }
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
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = db()
  // Unconfigured / demo mode: treat as a no-op success (no persistence layer).
  if (!supabase) return { ok: true, error: null }

  const now = new Date().toISOString()

  const promises = updates.map(u =>
    supabase
      .from('parking_spots')
      .update({ longitude: u.longitude, latitude: u.latitude, heading_deg: u.heading_deg, updated_at: now })
      .eq('id', u.id)
  )

  const results = await Promise.all(promises)
  const failed = results.find((r: { error: { message: string } | null }) => r.error)
  if (failed?.error) {
    console.error('Failed to bulk-update parking spot positions:', failed.error.message)
    return { ok: false, error: friendlyError(failed.error.message) }
  }
  return { ok: true, error: null }
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
): Promise<{ data: ParkingObstacle | null; error: string | null }> {
  const supabase = db()
  // Unconfigured / demo mode: silent no-op, not an error.
  if (!supabase) return { data: null, error: null }

  const { data, error } = await supabase
    .from('parking_obstacles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update parking obstacle:', error.message)
    return { data: null, error: friendlyError(error.message) }
  }
  return { data: data as ParkingObstacle, error: null }
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

// ── Taxilanes CRUD ──

export async function fetchParkingTaxilanes(planId: string): Promise<ParkingTaxilane[]> {
  const supabase = db()
  if (!supabase) return []

  const { data } = await supabase
    .from('parking_taxilanes')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true })

  return (data || []) as ParkingTaxilane[]
}

export async function createParkingTaxilane(input: {
  base_id: string
  plan_id: string
  name?: string
  taxilane_type?: string
  design_aircraft?: string
  design_wingspan_ft?: number
  line_coords: [number, number][]
  is_transient?: boolean
  notes?: string
}): Promise<ParkingTaxilane | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('parking_taxilanes')
    .insert({ ...input, created_by: user?.id })
    .select()
    .single()

  if (error || !data) return null
  return data as ParkingTaxilane
}

export async function updateParkingTaxilane(
  id: string,
  updates: Partial<Omit<ParkingTaxilane, 'id' | 'base_id' | 'plan_id' | 'created_by' | 'created_at'>>
): Promise<ParkingTaxilane | null> {
  const supabase = db()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('parking_taxilanes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return data as ParkingTaxilane
}

export async function deleteParkingTaxilane(id: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  const { error } = await supabase
    .from('parking_taxilanes')
    .delete()
    .eq('id', id)

  return !error
}

// ── Apron Boundaries CRUD ──

export async function fetchApronBoundaries(planId: string): Promise<ParkingApronBoundary[]> {
  const supabase = db()
  if (!supabase) return []

  const { data } = await supabase
    .from('parking_apron_boundaries')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true })

  return (data || []) as ParkingApronBoundary[]
}

export async function createApronBoundary(input: {
  base_id: string
  plan_id: string
  name?: string
  polygon_coords: [number, number][]
  notes?: string
}): Promise<ParkingApronBoundary | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('parking_apron_boundaries')
    .insert({ ...input, created_by: user?.id })
    .select()
    .single()

  if (error || !data) return null
  return data as ParkingApronBoundary
}

export async function updateApronBoundary(
  id: string,
  updates: Partial<Omit<ParkingApronBoundary, 'id' | 'base_id' | 'plan_id' | 'created_by' | 'created_at'>>
): Promise<ParkingApronBoundary | null> {
  const supabase = db()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('parking_apron_boundaries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return data as ParkingApronBoundary
}

export async function deleteApronBoundary(id: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  const { error } = await supabase
    .from('parking_apron_boundaries')
    .delete()
    .eq('id', id)

  return !error
}
