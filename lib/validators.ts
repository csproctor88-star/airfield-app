import { z } from 'zod'

// === Discrepancy Validation (SRS DIS-001 through DIS-015) ===

export const discrepancySchema = z.object({
  type: z.string().min(1, 'Type is required'),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  title: z.string().min(1, 'Title is required').max(120, 'Title must be 120 characters or less'),
  description: z.string().min(1, 'Description is required'),
  location_text: z.string().min(1, 'Location is required'),
  assigned_shop: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  linked_notam_id: z.string().uuid().nullable().optional(),
})

export type DiscrepancyFormData = z.infer<typeof discrepancySchema>

// === Status Update Validation ===

export const statusUpdateSchema = z.object({
  new_status: z.enum(['open', 'assigned', 'in_progress', 'resolved', 'closed']),
  notes: z.string().optional(),
  assigned_shop: z.string().optional(),
  resolution_notes: z.string().optional(),
})

export type StatusUpdateFormData = z.infer<typeof statusUpdateSchema>

// === FOD Check (SRS Section 5.5.1) ===

export const fodCheckSchema = z.object({
  route: z.string().min(1, 'Route is required'),
  items_found: z.array(z.object({
    description: z.string().min(1),
    location: z.string().min(1),
    disposed: z.boolean(),
  })),
  clear: z.boolean(),
})

// === BASH Assessment ===

export const bashCheckSchema = z.object({
  condition_code: z.enum(['LOW', 'MODERATE', 'SEVERE']),
  species_observed: z.string(),
  mitigation_actions: z.string(),
  habitat_attractants: z.string(),
})

// === RCR Reading ===

export const rcrCheckSchema = z.object({
  equipment: z.string().min(1, 'Equipment is required'),
  runway: z.string().min(1, 'Runway is required'),
  readings: z.object({
    rollout: z.number().min(0).max(100),
    midpoint: z.number().min(0).max(100),
    departure: z.number().min(0).max(100),
  }),
  surface_condition: z.string(),
  temperature_f: z.number().nullable().optional(),
  rt3_imported: z.boolean().default(false),
})

// === RSC Report ===

export const rscCheckSchema = z.object({
  runway: z.string().min(1, 'Runway is required'),
  contaminant: z.string().min(1, 'Contaminant type is required'),
  depth_inches: z.number().min(0),
  coverage_percent: z.number().min(0).max(100),
  treatment_applied: z.string(),
  braking_action: z.enum(['Good', 'Medium', 'Poor', 'Nil']),
})

// === Emergency Response ===

export const emergencyCheckSchema = z.object({
  emergency_type: z.enum(['IFE', 'Ground', 'Drill']),
  aircraft_type: z.string(),
  callsign: z.string(),
  runway: z.string(),
  nature: z.string(),
  actions: z.array(z.object({
    step: z.string(),
    completed: z.boolean(),
    completed_at: z.string().nullable(),
  })),
  agencies_notified: z.array(z.object({
    agency: z.string(),
    notified: z.boolean(),
    notified_at: z.string().nullable(),
  })),
  start_time: z.string(),
  end_time: z.string().nullable(),
  duration_minutes: z.number().nullable(),
})

// === NOTAM Validation ===

export const notamSchema = z.object({
  notam_type: z.string().min(1, 'Type is required'),
  title: z.string().min(1, 'Title is required'),
  full_text: z.string().min(1, 'NOTAM text is required'),
  effective_start: z.string().min(1, 'Effective date is required'),
  effective_end: z.string().nullable().optional(),
})

export type NotamFormData = z.infer<typeof notamSchema>

// === Inspection Item Response ===

export const inspectionResponseSchema = z.enum(['pass', 'fail', 'na'])

// === Inspection Form Validation ===

export const inspectionItemSchema = z.object({
  id: z.string(),
  section: z.string(),
  item: z.string(),
  response: z.enum(['pass', 'fail', 'na']),
  notes: z.string(),
  photo_id: z.string().nullable(),
  generated_discrepancy_id: z.string().nullable(),
})

export const inspectionFormSchema = z.object({
  inspection_type: z.enum(['airfield', 'lighting', 'construction_meeting', 'joint_monthly']),
  inspector_name: z.string().min(1, 'Inspector name is required'),
  items: z.array(inspectionItemSchema),
  total_items: z.number().min(0),
  passed_count: z.number().min(0),
  failed_count: z.number().min(0),
  na_count: z.number().min(0),
  construction_meeting: z.boolean(),
  joint_monthly: z.boolean(),
  personnel: z.array(z.string()).default([]),
  bwc_value: z.enum(['LOW', 'MOD', 'SEV', 'PROHIB']).nullable(),
  weather_conditions: z.string().nullable(),
  temperature_f: z.number().nullable(),
  notes: z.string().nullable(),
})

export type InspectionFormData = z.infer<typeof inspectionFormSchema>
