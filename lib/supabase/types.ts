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
          last_seen_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at' | 'last_seen_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      airfield_checks: {
        Row: {
          id: string
          display_id: string
          check_type: CheckType
          areas: string[]
          data: Record<string, unknown>
          completed_by: string | null
          completed_at: string | null
          latitude: number | null
          longitude: number | null
          photo_count: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['airfield_checks']['Row'], 'id' | 'created_at' | 'updated_at' | 'photo_count'>
        Update: Partial<Database['public']['Tables']['airfield_checks']['Insert']>
        Relationships: []
      }
      check_comments: {
        Row: {
          id: string
          check_id: string
          comment: string
          user_name: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['check_comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['check_comments']['Insert']>
        Relationships: []
      }
      inspections: {
        Row: {
          id: string
          display_id: string
          inspection_type: InspectionType
          inspector_id: string
          inspector_name: string | null
          inspection_date: string
          status: 'in_progress' | 'completed'
          items: InspectionItem[]
          total_items: number
          passed_count: number
          failed_count: number
          na_count: number
          completion_percent: number
          construction_meeting: boolean
          joint_monthly: boolean
          personnel: string[]
          bwc_value: string | null
          weather_conditions: string | null
          temperature_f: number | null
          notes: string | null
          daily_group_id: string | null
          completed_by_name: string | null
          completed_by_id: string | null
          completed_at: string | null
          filed_by_name: string | null
          filed_by_id: string | null
          filed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['inspections']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['inspections']['Insert']>
        Relationships: []
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
        Relationships: []
      }
      obstruction_evaluations: {
        Row: {
          id: string
          display_id: string
          runway_class: 'A' | 'B'
          object_height_agl: number
          object_distance_ft: number | null
          distance_from_centerline_ft: number | null
          object_elevation_msl: number | null
          obstruction_top_msl: number | null
          latitude: number | null
          longitude: number | null
          description: string | null
          photo_storage_path: string | null
          results: Record<string, unknown>[]
          controlling_surface: string | null
          violated_surfaces: string[]
          has_violation: boolean
          evaluated_by: string
          linked_discrepancy_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['obstruction_evaluations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['obstruction_evaluations']['Insert']>
        Relationships: []
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
        Relationships: []
      }
      navaid_statuses: {
        Row: {
          id: string
          navaid_name: string
          status: 'green' | 'yellow' | 'red'
          notes: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['navaid_statuses']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['navaid_statuses']['Insert']>
        Relationships: []
      }
      regulations: {
        Row: {
          id: string
          reg_id: string
          title: string
          description: string
          publication_date: string | null
          url: string | null
          source_section: string
          source_volume: string | null
          category: string
          pub_type: RegulationPubType
          is_core: boolean
          is_cross_ref: boolean
          is_scrubbed: boolean
          tags: string[]
          storage_path: string | null
          file_size_bytes: number | null
          last_verified_at: string | null
          verified_date: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['regulations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['regulations']['Insert']>
        Relationships: []
      }
      user_regulation_pdfs: {
        Row: {
          id: string
          user_id: string
          reg_id: string
          storage_path: string
          file_name: string
          file_size_bytes: number | null
          uploaded_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_regulation_pdfs']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['user_regulation_pdfs']['Insert']>
        Relationships: []
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
export type CheckType = 'fod' | 'rsc' | 'ife' | 'ground_emergency' | 'heavy_aircraft' | 'bash' | 'rcr'
export type InspectionType = 'airfield' | 'lighting' | 'construction_meeting' | 'joint_monthly'
export type NotamStatus = 'draft' | 'active' | 'cancelled' | 'expired'
export type RegulationPubType = 'DAF' | 'FAA' | 'UFC' | 'DoD' | 'ICAO' | 'CFR'

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
export type CheckComment = Database['public']['Tables']['check_comments']['Row']
export type Inspection = Database['public']['Tables']['inspections']['Row']
export type Notam = Database['public']['Tables']['notams']['Row']
export type ObstructionEvaluation = Database['public']['Tables']['obstruction_evaluations']['Row']
export type ActivityLog = Database['public']['Tables']['activity_log']['Row']
export type NavaidStatus = Database['public']['Tables']['navaid_statuses']['Row']
export type Regulation = Database['public']['Tables']['regulations']['Row']
export type UserRegulationPdf = Database['public']['Tables']['user_regulation_pdfs']['Row']
