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
          checklist_reset_time: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['bases']['Row'], 'id' | 'created_at' | 'updated_at' | 'is_active' | 'checklist_reset_time'>
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
          edipi: string | null
          operating_initials: string | null
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
          infrastructure_feature_id: string | null
          lighting_system_id: string | null
          photo_count: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['discrepancies']['Row'], 'id' | 'created_at' | 'updated_at' | 'photo_count'>
        Update: Partial<Omit<Database['public']['Tables']['discrepancies']['Row'], 'id' | 'created_at'>>
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
          issue_index: number | null
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
          status: string
          draft_data: Record<string, unknown> | null
          saved_by_name: string | null
          saved_by_id: string | null
          saved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['airfield_checks']['Row'], 'id' | 'created_at' | 'updated_at' | 'photo_count'>
        Update: Partial<Omit<Database['public']['Tables']['airfield_checks']['Row'], 'id' | 'created_at'>>
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
          rsc_condition: string | null
          rcr_value: string | null
          rcr_condition: string | null
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
          draft_data: Record<string, unknown> | null
          saved_by_name: string | null
          saved_by_id: string | null
          saved_at: string | null
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
        Update: Partial<Omit<Database['public']['Tables']['waivers']['Row'], 'id' | 'created_at'>>
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
      acsi_inspections: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['acsi_inspections']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['acsi_inspections']['Insert']>
        Relationships: []
      }
      base_inspection_templates: {
        Row: {
          id: string
          base_id: string
          template_type: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['base_inspection_templates']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['base_inspection_templates']['Insert']>
        Relationships: []
      }
      base_inspection_sections: {
        Row: {
          id: string
          template_id: string
          section_id: string
          title: string
          guidance: string | null
          conditional: string | null
          sort_order: number
        }
        Insert: Omit<Database['public']['Tables']['base_inspection_sections']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['base_inspection_sections']['Insert']>
        Relationships: []
      }
      base_inspection_items: {
        Row: {
          id: string
          section_id: string
          item_key: string
          item_number: number
          item_text: string
          item_type: string
          sort_order: number
        }
        Insert: Omit<Database['public']['Tables']['base_inspection_items']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['base_inspection_items']['Insert']>
        Relationships: []
      }
      airfield_status: {
        Row: {
          id: string
          base_id: string | null
          advisory_type: string | null
          advisory_text: string | null
          active_runway: string
          runway_status: string
          runway_statuses: Record<string, unknown>
          arff_cat: number | null
          arff_statuses: Record<string, string>
          rsc_condition: string | null
          rsc_updated_at: string | null
          rcr_touchdown: string | null
          rcr_midpoint: string | null
          rcr_rollout: string | null
          rcr_condition: string | null
          rcr_updated_at: string | null
          bwc_value: string | null
          bwc_updated_at: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['airfield_status']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['airfield_status']['Insert']>
        Relationships: []
      }
      base_arff_aircraft: {
        Row: {
          id: string
          base_id: string
          aircraft_name: string
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['base_arff_aircraft']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['base_arff_aircraft']['Insert']>
        Relationships: []
      }
      airfield_contractors: {
        Row: {
          id: string
          base_id: string | null
          company_name: string
          contact_name: string | null
          location: string
          work_description: string
          status: 'active' | 'completed'
          start_date: string
          end_date: string | null
          notes: string | null
          radio_number: string | null
          flag_number: string | null
          callsign: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['airfield_contractors']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['airfield_contractors']['Row'], 'id' | 'created_at'>>
        Relationships: []
      }
      runway_status_log: {
        Row: {
          id: string
          base_id: string | null
          old_runway_status: string | null
          new_runway_status: string | null
          old_active_runway: string | null
          new_active_runway: string | null
          old_advisory_type: string | null
          new_advisory_type: string | null
          old_advisory_text: string | null
          new_advisory_text: string | null
          changed_by: string | null
          reason: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['runway_status_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['runway_status_log']['Insert']>
        Relationships: []
      }
      shift_checklist_items: {
        Row: {
          id: string
          base_id: string
          label: string
          shift: string
          frequency: string
          sort_order: number
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['shift_checklist_items']['Row'], 'id' | 'created_at' | 'updated_at' | 'is_active' | 'sort_order'>
        Update: Partial<Database['public']['Tables']['shift_checklist_items']['Insert']>
        Relationships: []
      }
      shift_checklists: {
        Row: {
          id: string
          base_id: string
          checklist_date: string
          status: string
          completed_by: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['shift_checklists']['Row'], 'id' | 'created_at' | 'updated_at' | 'status'>
        Update: Partial<Database['public']['Tables']['shift_checklists']['Insert']>
        Relationships: []
      }
      shift_checklist_responses: {
        Row: {
          id: string
          checklist_id: string
          item_id: string
          completed: boolean
          completed_by: string | null
          completed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['shift_checklist_responses']['Row'], 'id' | 'created_at' | 'updated_at' | 'completed'>
        Update: Partial<Database['public']['Tables']['shift_checklist_responses']['Insert']>
        Relationships: []
      }
      qrc_templates: {
        Row: {
          id: string
          base_id: string
          qrc_number: number
          title: string
          notes: string | null
          steps: QrcStep[]
          references: string | null
          has_scn_form: boolean
          scn_fields: Record<string, unknown> | null
          is_active: boolean
          sort_order: number
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          review_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['qrc_templates']['Row'], 'id' | 'created_at' | 'updated_at' | 'is_active' | 'sort_order' | 'last_reviewed_at' | 'last_reviewed_by' | 'review_notes'>
        Update: Partial<Database['public']['Tables']['qrc_templates']['Insert']>
        Relationships: []
      }
      qrc_executions: {
        Row: {
          id: string
          base_id: string
          template_id: string
          qrc_number: number
          title: string
          status: 'open' | 'closed'
          opened_by: string | null
          opened_at: string
          open_initials: string | null
          closed_by: string | null
          closed_at: string | null
          close_initials: string | null
          step_responses: Record<string, QrcStepResponse>
          scn_data: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['qrc_executions']['Row'], 'id' | 'created_at' | 'updated_at' | 'status' | 'step_responses'>
        Update: Partial<Database['public']['Tables']['qrc_executions']['Insert']>
        Relationships: []
      }
      infrastructure_features: {
        Row: {
          id: string
          base_id: string
          feature_type: string
          longitude: number
          latitude: number
          layer: string | null
          block: string | null
          label: string | null
          notes: string | null
          rotation: number
          source: 'import' | 'user'
          status: 'operational' | 'inoperative'
          status_changed_at: string | null
          status_changed_by: string | null
          system_component_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['infrastructure_features']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['infrastructure_features']['Insert']>
        Relationships: []
      }
      lighting_systems: {
        Row: {
          id: string
          base_id: string
          system_type: string
          name: string
          runway_or_taxiway: string | null
          is_precision: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['lighting_systems']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['lighting_systems']['Insert']>
        Relationships: []
      }
      lighting_system_components: {
        Row: {
          id: string
          system_id: string
          component_type: string
          label: string
          total_count: number
          allowable_outage_pct: number | null
          allowable_outage_count: number | null
          allowable_outage_consecutive: number | null
          allowable_no_adjacent: boolean
          allowable_outage_text: string | null
          is_zero_tolerance: boolean
          requires_notam: boolean
          requires_ce_notification: boolean
          requires_system_shutoff: boolean
          requires_terps_notification: boolean
          requires_obstruction_notam_attrs: boolean
          q_code: string | null
          notam_text_template: string | null
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['lighting_system_components']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['lighting_system_components']['Insert']>
        Relationships: []
      }
      outage_events: {
        Row: {
          id: string
          base_id: string
          feature_id: string
          system_component_id: string | null
          event_type: 'reported' | 'resolved'
          reported_by: string | null
          discrepancy_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['outage_events']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['outage_events']['Insert']>
        Relationships: []
      }
      inspection_item_system_links: {
        Row: {
          id: string
          item_id: string
          system_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['inspection_item_system_links']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['inspection_item_system_links']['Insert']>
        Relationships: []
      }
      outage_rule_templates: {
        Row: {
          id: string
          system_type: string
          component_type: string
          label: string
          allowable_outage_pct: number | null
          allowable_outage_count: number | null
          allowable_outage_consecutive: number | null
          allowable_no_adjacent: boolean
          allowable_outage_text: string | null
          is_zero_tolerance: boolean
          dafman_notes: string | null
          requires_notam: boolean
          requires_ce_notification: boolean
          requires_system_shutoff: boolean
          requires_terps_notification: boolean
          requires_obstruction_notam_attrs: boolean
          q_code: string | null
          notam_text_template: string | null
          sort_order: number
        }
        Insert: Omit<Database['public']['Tables']['outage_rule_templates']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['outage_rule_templates']['Insert']>
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

export type SimpleDiscrepancy = {
  comment: string
  location: { lat: number; lon: number } | null
  photo_ids: string[]
  /** Area / location text for this issue (e.g. "TWY A", "RWY 13/31") */
  location_text?: string
  /** When true, this issue will also be logged as an airfield discrepancy */
  log_as_discrepancy?: boolean
  /** Discrepancy title (auto-populated from comment, editable) */
  discrepancy_title?: string
  /** Area / location text for the discrepancy (defaults from location_text) */
  discrepancy_location_text?: string
  /** Discrepancy type value (from DISCREPANCY_TYPES) */
  discrepancy_type?: string
  /** ID of the created discrepancy (set after submission) */
  generated_discrepancy_id?: string | null
  /** Infrastructure feature IDs selected via feature picker (linked lighting systems) */
  linked_feature_ids?: string[]
}

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
  discrepancies?: SimpleDiscrepancy[]
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
export type BaseInspectionTemplate = Database['public']['Tables']['base_inspection_templates']['Row']
export type BaseInspectionSection = Database['public']['Tables']['base_inspection_sections']['Row']
export type BaseInspectionItem = Database['public']['Tables']['base_inspection_items']['Row']
export type AirfieldStatusRow = Database['public']['Tables']['airfield_status']['Row']
export type InstallationArffAircraft = Database['public']['Tables']['base_arff_aircraft']['Row']
export type RunwayStatusLog = Database['public']['Tables']['runway_status_log']['Row']
export type AirfieldContractor = Database['public']['Tables']['airfield_contractors']['Row']
export type QrcTemplate = Database['public']['Tables']['qrc_templates']['Row']
export type QrcExecution = Database['public']['Tables']['qrc_executions']['Row']
export type InfrastructureFeature = Database['public']['Tables']['infrastructure_features']['Row']
export type LightingSystem = Database['public']['Tables']['lighting_systems']['Row']
export type LightingSystemComponent = Database['public']['Tables']['lighting_system_components']['Row']
export type OutageEvent = Database['public']['Tables']['outage_events']['Row']
export type OutageRuleTemplate = Database['public']['Tables']['outage_rule_templates']['Row']
export type InspectionItemSystemLink = Database['public']['Tables']['inspection_item_system_links']['Row']

// === QRC (Quick Reaction Checklist) Types ===

export type QrcStepType = 'checkbox' | 'checkbox_with_note' | 'notify_agencies' | 'fill_field' | 'time_field' | 'conditional'

export type QrcStep = {
  id: string
  type: QrcStepType
  label: string
  note?: string
  agencies?: string[]
  field_label?: string
  cross_ref_qrc?: number
  sub_steps?: QrcStep[]
}

export type QrcStepResponse = {
  completed: boolean
  completed_by?: string
  completed_at?: string
  value?: string
  agencies_checked?: string[]
  notes?: string
}

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
