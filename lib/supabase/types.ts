// Database types — generated from Supabase schema (Section 5)
// This file will be replaced by `supabase gen types` once the DB is provisioned.

export type Database = {
  public: {
    Tables: {
      bases: {
        Row: {
          id: string
          name: string
          icao: string
          unit: string | null
          majcom: string | null
          location: string | null
          elevation_msl: number | null
          timezone: string
          installation_code: string | null
          ce_shops: string[]
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['bases']['Row'], 'id' | 'created_at' | 'updated_at' | 'is_active'>
        Update: Partial<Database['public']['Tables']['bases']['Insert']>
        Relationships: []
      }
      base_runways: {
        Row: {
          id: string
          base_id: string
          runway_id: string
          length_ft: number
          width_ft: number
          surface: string
          true_heading: number | null
          end1_designator: string
          end1_latitude: number | null
          end1_longitude: number | null
          end1_heading: number | null
          end1_approach_lighting: string | null
          end2_designator: string
          end2_latitude: number | null
          end2_longitude: number | null
          end2_heading: number | null
          end2_approach_lighting: string | null
          runway_class: string
          end1_elevation_msl: number | null
          end2_elevation_msl: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['base_runways']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['base_runways']['Insert']>
        Relationships: []
      }
      base_navaids: {
        Row: {
          id: string
          base_id: string
          navaid_name: string
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['base_navaids']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['base_navaids']['Insert']>
        Relationships: []
      }
      base_areas: {
        Row: {
          id: string
          base_id: string
          area_name: string
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['base_areas']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['base_areas']['Insert']>
        Relationships: []
      }
      base_members: {
        Row: {
          id: string
          base_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['base_members']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['base_members']['Insert']>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string
          name: string
          first_name: string | null
          last_name: string | null
          rank: string | null
          role: UserRole
          organization: string | null
          shop: string | null
          phone: string | null
          is_active: boolean
          status: ProfileStatus
          last_seen_at: string | null
          primary_base_id: string | null
          default_pdf_email: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at' | 'last_seen_at'>
        Update: Partial<Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>>
        Relationships: []
      }
      discrepancies: {
        Row: {
          id: string
          display_id: string
          base_id: string | null
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
          inspection_id: string | null
          inspection_item_id: string | null
          acsi_inspection_id: string | null
          acsi_item_id: string | null
          base_id: string | null
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
          base_id: string | null
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
          base_id: string | null
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
          base_id: string | null
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
          base_id: string | null
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
          base_id: string | null
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
          base_id: string | null
          runway_class: 'B' | 'Army_B'
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
      waivers: {
        Row: {
          id: string
          base_id: string | null
          waiver_number: string
          classification: WaiverClassification
          status: WaiverStatus
          hazard_rating: WaiverHazardRating | null
          action_requested: WaiverActionRequested | null
          description: string
          justification: string | null
          risk_assessment_summary: string | null
          corrective_action: string | null
          criteria_impact: string | null
          proponent: string | null
          project_number: string | null
          program_fy: number | null
          estimated_cost: number | null
          project_status: string | null
          faa_case_number: string | null
          period_valid: string | null
          date_submitted: string | null
          date_approved: string | null
          expiration_date: string | null
          last_reviewed_date: string | null
          next_review_due: string | null
          location_description: string | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          photo_count: number
          attachment_count: number
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['waivers']['Row'], 'id' | 'created_at' | 'updated_at' | 'photo_count' | 'attachment_count'>
        Update: Partial<Database['public']['Tables']['waivers']['Insert']>
        Relationships: []
      }
      waiver_criteria: {
        Row: {
          id: string
          waiver_id: string
          criteria_source: WaiverCriteriaSource
          reference: string | null
          description: string | null
          sort_order: number
        }
        Insert: Omit<Database['public']['Tables']['waiver_criteria']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['waiver_criteria']['Insert']>
        Relationships: []
      }
      waiver_attachments: {
        Row: {
          id: string
          waiver_id: string
          file_path: string
          file_name: string
          file_type: WaiverAttachmentType
          file_size: number | null
          mime_type: string | null
          caption: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['waiver_attachments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['waiver_attachments']['Insert']>
        Relationships: []
      }
      waiver_reviews: {
        Row: {
          id: string
          waiver_id: string
          review_year: number
          review_date: string | null
          reviewed_by: string | null
          recommendation: WaiverReviewRecommendation | null
          mitigation_verified: boolean
          project_status_update: string | null
          notes: string | null
          presented_to_facilities_board: boolean
          facilities_board_date: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['waiver_reviews']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['waiver_reviews']['Insert']>
        Relationships: []
      }
      waiver_coordination: {
        Row: {
          id: string
          waiver_id: string
          office: WaiverCoordinationOffice
          office_label: string | null
          coordinator_name: string | null
          coordinated_date: string | null
          status: WaiverCoordinationStatus
          comments: string | null
        }
        Insert: Omit<Database['public']['Tables']['waiver_coordination']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['waiver_coordination']['Insert']>
        Relationships: []
      }
      activity_log: {
        Row: {
          id: string
          user_id: string
          base_id: string | null
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
          base_id: string | null
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
  | 'namo'
  | 'amops'
  | 'ces'
  | 'safety'
  | 'atc'
  | 'read_only'
  | 'base_admin'
  | 'sys_admin'

export type ProfileStatus = 'active' | 'deactivated' | 'pending'

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type DiscrepancyStatus = 'open' | 'completed' | 'cancelled'
export type CurrentStatus = 'submitted_to_afm' | 'submitted_to_ces' | 'awaiting_action_by_ces' | 'work_completed_awaiting_verification'
export type CheckType = 'fod' | 'rsc' | 'ife' | 'ground_emergency' | 'heavy_aircraft' | 'bash' | 'rcr'
export type InspectionType = 'airfield' | 'lighting' | 'construction_meeting' | 'joint_monthly'
export type NotamStatus = 'draft' | 'active' | 'cancelled' | 'expired'
export type WaiverClassification = 'permanent' | 'temporary' | 'construction' | 'event' | 'extension' | 'amendment'
export type WaiverStatus = 'draft' | 'pending' | 'approved' | 'active' | 'completed' | 'cancelled' | 'expired'
export type WaiverHazardRating = 'low' | 'medium' | 'high' | 'extremely_high'
export type WaiverActionRequested = 'new' | 'extension' | 'amendment'
export type WaiverCriteriaSource = 'ufc_3_260_01' | 'ufc_3_260_04' | 'ufc_3_535_01' | 'other'
export type WaiverAttachmentType = 'photo' | 'site_map' | 'risk_assessment' | 'ufc_excerpt' | 'faa_report' | 'coordination_sheet' | 'af_form_505' | 'other'
export type WaiverReviewRecommendation = 'retain' | 'modify' | 'cancel' | 'convert_to_temporary' | 'convert_to_permanent'
export type WaiverCoordinationOffice = 'civil_engineer' | 'airfield_manager' | 'airfield_ops_terps' | 'base_safety' | 'installation_cc' | 'other'
export type WaiverCoordinationStatus = 'pending' | 'concur' | 'non_concur'
export type RegulationPubType = 'DAF' | 'FAA' | 'UFC' | 'DoD' | 'ICAO' | 'CFR'

export type InspectionItem = {
  id: string
  section: string
  item: string
  response: 'pass' | 'fail' | 'na' | null
  notes: string
  photo_id: string | null
  photo_urls?: string[]
  location?: { lat: number; lon: number } | null
  generated_discrepancy_id: string | null
}

// Table row shorthand types
export type Installation = Database['public']['Tables']['bases']['Row']
export type InstallationRunway = Database['public']['Tables']['base_runways']['Row']
export type InstallationNavaid = Database['public']['Tables']['base_navaids']['Row']
export type InstallationArea = Database['public']['Tables']['base_areas']['Row']
export type InstallationMember = Database['public']['Tables']['base_members']['Row']
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
export type Waiver = Database['public']['Tables']['waivers']['Row']
export type WaiverCriteria = Database['public']['Tables']['waiver_criteria']['Row']
export type WaiverAttachment = Database['public']['Tables']['waiver_attachments']['Row']
export type WaiverReview = Database['public']['Tables']['waiver_reviews']['Row']
export type WaiverCoordination = Database['public']['Tables']['waiver_coordination']['Row']
export type Regulation = Database['public']['Tables']['regulations']['Row']
export type UserRegulationPdf = Database['public']['Tables']['user_regulation_pdfs']['Row']

// === ACSI (Airfield Compliance and Safety Inspection) Types ===

export type AcsiStatus = 'draft' | 'in_progress' | 'completed' | 'staffed'

export type AcsiItemResponse = 'pass' | 'fail' | 'na' | null

export type AcsiDiscrepancyDetail = {
  comment: string
  work_order: string
  project_number: string
  estimated_cost: string
  estimated_completion: string
  photo_ids: string[]
  areas: string[]
  /** @deprecated Use `pins` instead */
  latitude: number | null
  /** @deprecated Use `pins` instead */
  longitude: number | null
  pins: { lat: number; lng: number }[]
}

export type AcsiItem = {
  id: string
  section_id: string
  item_number: string
  question: string
  response: AcsiItemResponse
  discrepancy: AcsiDiscrepancyDetail | null
  discrepancies?: AcsiDiscrepancyDetail[]
}

export type AcsiTeamMember = {
  id: string
  role: string
  name: string
  rank: string
  title: string
}

export type AcsiSignatureBlock = {
  label: string
  organization: string
  name: string
  rank: string
  title: string
}

export type AcsiDraftData = {
  responses: Record<string, AcsiItemResponse>
  comments: Record<string, string>
  discrepancies: Record<string, AcsiDiscrepancyDetail[]>
  team: AcsiTeamMember[]
  signatures: AcsiSignatureBlock[]
  notes: string
  collapsedSections: Record<string, boolean>
  localItems: { id: string; question: string }[]
}

export type AcsiInspection = {
  id: string
  display_id: string
  base_id: string | null
  airfield_name: string
  inspection_date: string
  fiscal_year: number
  status: AcsiStatus
  items: AcsiItem[]
  total_items: number
  passed_count: number
  failed_count: number
  na_count: number
  inspection_team: AcsiTeamMember[]
  risk_cert_signatures: AcsiSignatureBlock[]
  notes: string | null
  inspector_id: string | null
  inspector_name: string | null
  draft_data: AcsiDraftData | null
  completed_at: string | null
  completed_by_name: string | null
  completed_by_id: string | null
  filed_at: string | null
  filed_by_name: string | null
  filed_by_id: string | null
  saved_at: string | null
  saved_by_name: string | null
  saved_by_id: string | null
  created_at: string
  updated_at: string
}
