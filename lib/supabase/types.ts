// Database types — generated from Supabase schema (Section 5)
// This file will be replaced by `supabase gen types` once the DB is provisioned.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string
          rank: string | null
          role: UserRole
          organization: string | null
          shop: string | null
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      discrepancies: {
        Row: {
          id: string
          display_id: string
          type: string
          severity: Severity
          status: DiscrepancyStatus
          current_status: CurrentStatus
          title: string
          description: string
          location_text: string
          latitude: number | null
          longitude: number | null
          assigned_shop: string | null
          assigned_to: string | null
          reported_by: string
          work_order_number: string | null
          notam_reference: string | null
          linked_notam_id: string | null
          inspection_id: string | null
          resolution_notes: string | null
          resolution_date: string | null
          photo_count: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['discrepancies']['Row'], 'id' | 'created_at' | 'updated_at' | 'photo_count'>
        Update: Partial<Database['public']['Tables']['discrepancies']['Insert']>
      }
      photos: {
        Row: {
          id: string
          discrepancy_id: string | null
          check_id: string | null
          storage_path: string
          thumbnail_path: string | null
          file_name: string
          file_size: number | null
          mime_type: string
          latitude: number | null
          longitude: number | null
          captured_at: string
          uploaded_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['photos']['Row'], 'id' | 'created_at' | 'captured_at'>
        Update: Partial<Database['public']['Tables']['photos']['Insert']>
      }
      status_updates: {
        Row: {
          id: string
          discrepancy_id: string
          old_status: string | null
          new_status: string | null
          notes: string | null
          updated_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['status_updates']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['status_updates']['Insert']>
      }
      airfield_checks: {
        Row: {
          id: string
          display_id: string
          check_type: CheckType
          performed_by: string
          check_date: string
          latitude: number | null
          longitude: number | null
          data: Record<string, unknown>
          notes: string | null
          photo_count: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['airfield_checks']['Row'], 'id' | 'created_at' | 'updated_at' | 'photo_count'>
        Update: Partial<Database['public']['Tables']['airfield_checks']['Insert']>
      }
      inspections: {
        Row: {
          id: string
          display_id: string
          inspection_type: InspectionType
          inspector_id: string
          inspection_date: string
          status: 'in_progress' | 'completed'
          items: InspectionItem[]
          total_items: number
          passed_count: number
          failed_count: number
          na_count: number
          completion_percent: number
          notes: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['inspections']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['inspections']['Insert']>
      }
      notams: {
        Row: {
          id: string
          notam_number: string
          source: 'faa' | 'local'
          status: NotamStatus
          notam_type: string | null
          title: string
          full_text: string
          effective_start: string
          effective_end: string | null
          linked_discrepancy_id: string | null
          created_by: string | null
          cancelled_by: string | null
          cancelled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['notams']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['notams']['Insert']>
      }
      obstruction_evaluations: {
        Row: {
          id: string
          runway_class: 'A' | 'B'
          object_height_agl: number
          object_distance_ft: number | null
          object_elevation_msl: number | null
          latitude: number | null
          longitude: number | null
          results: Record<string, unknown>[]
          has_violation: boolean
          evaluated_by: string
          linked_discrepancy_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['obstruction_evaluations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['obstruction_evaluations']['Insert']>
      }
      activity_log: {
        Row: {
          id: string
          user_id: string
          action: string
          entity_type: string
          entity_id: string
          entity_display_id: string | null
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['activity_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['activity_log']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience type aliases
export type UserRole =
  | 'airfield_manager'
  | 'am_ncoic'
  | 'am_tech'
  | 'ce_shop'
  | 'wing_safety'
  | 'atc'
  | 'observer'
  | 'sys_admin'

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type DiscrepancyStatus = 'open' | 'completed' | 'cancelled'
export type CurrentStatus = 'submitted_to_afm' | 'submitted_to_ces' | 'awaiting_action_by_ces' | 'work_completed_awaiting_verification'
export type CheckType = 'fod' | 'bash' | 'rcr' | 'rsc' | 'emergency'
export type InspectionType = 'daily' | 'semi_annual' | 'annual'
export type NotamStatus = 'draft' | 'active' | 'cancelled' | 'expired'

export type InspectionItem = {
  id: string
  section: string
  item: string
  response: 'pass' | 'fail' | 'na' | null
  notes: string
  photo_id: string | null
  generated_discrepancy_id: string | null
}

// Table row shorthand types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Discrepancy = Database['public']['Tables']['discrepancies']['Row']
export type Photo = Database['public']['Tables']['photos']['Row']
export type StatusUpdate = Database['public']['Tables']['status_updates']['Row']
export type AirfieldCheck = Database['public']['Tables']['airfield_checks']['Row']
export type Inspection = Database['public']['Tables']['inspections']['Row']
export type Notam = Database['public']['Tables']['notams']['Row']
export type ObstructionEvaluation = Database['public']['Tables']['obstruction_evaluations']['Row']
export type ActivityLog = Database['public']['Tables']['activity_log']['Row']
