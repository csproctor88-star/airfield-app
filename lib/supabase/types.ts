// GENERATED + MANUAL — regen procedure:
//   npx supabase gen types typescript --linked
// replaces everything ABOVE the "// Convenience type aliases" marker. After
// regenerating, re-apply the lines tagged "MANUAL after regen" (bases.airport_type
// and bases.obstruction_surface_set are text columns in the DB, hand-narrowed to
// the unions in lib/airport-mode.ts). Everything below the marker is hand-written.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      acsi_inspections: {
        Row: {
          airfield_name: string
          airport_class: string | null
          arff_index: string | null
          base_id: string | null
          completed_at: string | null
          completed_by_id: string | null
          completed_by_name: string | null
          created_at: string
          display_id: string
          draft_data: Json | null
          failed_count: number
          filed_at: string | null
          filed_by_id: string | null
          filed_by_name: string | null
          fiscal_year: number
          id: string
          inspection_date: string
          inspection_team: Json
          inspector: string | null
          inspector_id: string | null
          inspector_name: string | null
          items: Json
          na_count: number
          notes: string | null
          passed_count: number
          risk_cert_signatures: Json
          saved_at: string | null
          saved_by_id: string | null
          saved_by_name: string | null
          status: string
          total_items: number
          updated_at: string
        }
        Insert: {
          airfield_name?: string
          airport_class?: string | null
          arff_index?: string | null
          base_id?: string | null
          completed_at?: string | null
          completed_by_id?: string | null
          completed_by_name?: string | null
          created_at?: string
          display_id: string
          draft_data?: Json | null
          failed_count?: number
          filed_at?: string | null
          filed_by_id?: string | null
          filed_by_name?: string | null
          fiscal_year?: number
          id?: string
          inspection_date?: string
          inspection_team?: Json
          inspector?: string | null
          inspector_id?: string | null
          inspector_name?: string | null
          items?: Json
          na_count?: number
          notes?: string | null
          passed_count?: number
          risk_cert_signatures?: Json
          saved_at?: string | null
          saved_by_id?: string | null
          saved_by_name?: string | null
          status?: string
          total_items?: number
          updated_at?: string
        }
        Update: {
          airfield_name?: string
          airport_class?: string | null
          arff_index?: string | null
          base_id?: string | null
          completed_at?: string | null
          completed_by_id?: string | null
          completed_by_name?: string | null
          created_at?: string
          display_id?: string
          draft_data?: Json | null
          failed_count?: number
          filed_at?: string | null
          filed_by_id?: string | null
          filed_by_name?: string | null
          fiscal_year?: number
          id?: string
          inspection_date?: string
          inspection_team?: Json
          inspector?: string | null
          inspector_id?: string | null
          inspector_name?: string | null
          items?: Json
          na_count?: number
          notes?: string | null
          passed_count?: number
          risk_cert_signatures?: Json
          saved_at?: string | null
          saved_by_id?: string | null
          saved_by_name?: string | null
          status?: string
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acsi_inspections_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          base_id: string | null
          created_at: string
          entity_display_id: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          base_id?: string | null
          created_at?: string
          entity_display_id?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          base_id?: string | null
          created_at?: string
          entity_display_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aep_comms_check_results: {
        Row: {
          agency_id: string | null
          agency_name: string
          agency_role: string | null
          check_id: string
          created_at: string
          id: string
          notes: string | null
          sort_order: number
          status: string
        }
        Insert: {
          agency_id?: string | null
          agency_name: string
          agency_role?: string | null
          check_id: string
          created_at?: string
          id?: string
          notes?: string | null
          sort_order?: number
          status: string
        }
        Update: {
          agency_id?: string | null
          agency_name?: string
          agency_role?: string | null
          check_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aep_comms_check_results_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "aep_response_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aep_comms_check_results_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "aep_comms_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      aep_comms_checks: {
        Row: {
          base_id: string
          check_date: string
          check_period: string
          completed_at: string | null
          completed_by: string | null
          completed_by_oi: string | null
          created_at: string
          id: string
          notes: string | null
          started_at: string
        }
        Insert: {
          base_id: string
          check_date: string
          check_period?: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_oi?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          started_at?: string
        }
        Update: {
          base_id?: string
          check_date?: string
          check_period?: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_oi?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aep_comms_checks_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aep_comms_checks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aep_drills: {
        Row: {
          after_action_notes: string | null
          base_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          drill_date: string
          drill_type: string
          evidence_url: string | null
          findings: string | null
          id: string
          next_due_at_override: string | null
          participants: Json
          scenario: string
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          after_action_notes?: string | null
          base_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          drill_date: string
          drill_type: string
          evidence_url?: string | null
          findings?: string | null
          id?: string
          next_due_at_override?: string | null
          participants?: Json
          scenario: string
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          after_action_notes?: string | null
          base_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          drill_date?: string
          drill_type?: string
          evidence_url?: string | null
          findings?: string | null
          id?: string
          next_due_at_override?: string | null
          participants?: Json
          scenario?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aep_drills_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aep_drills_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aep_drills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aep_plans: {
        Row: {
          ae_signed_at: string | null
          ae_user_id: string | null
          approved_by_faa_at: string | null
          base_id: string
          created_at: string
          created_by: string | null
          document_url: string | null
          effective_date: string
          faa_acceptance_ref: string | null
          id: string
          last_reviewed_at: string | null
          notes: string | null
          replaced_by_id: string | null
          review_notes: string | null
          reviewed_by_user_id: string | null
          storage_path: string | null
          updated_at: string
          version: string
        }
        Insert: {
          ae_signed_at?: string | null
          ae_user_id?: string | null
          approved_by_faa_at?: string | null
          base_id: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          effective_date: string
          faa_acceptance_ref?: string | null
          id?: string
          last_reviewed_at?: string | null
          notes?: string | null
          replaced_by_id?: string | null
          review_notes?: string | null
          reviewed_by_user_id?: string | null
          storage_path?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          ae_signed_at?: string | null
          ae_user_id?: string | null
          approved_by_faa_at?: string | null
          base_id?: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          effective_date?: string
          faa_acceptance_ref?: string | null
          id?: string
          last_reviewed_at?: string | null
          notes?: string | null
          replaced_by_id?: string | null
          review_notes?: string | null
          reviewed_by_user_id?: string | null
          storage_path?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "aep_plans_ae_user_id_fkey"
            columns: ["ae_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aep_plans_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aep_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aep_plans_replaced_by_id_fkey"
            columns: ["replaced_by_id"]
            isOneToOne: false
            referencedRelation: "aep_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aep_plans_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aep_response_agencies: {
        Row: {
          agency_name: string
          agency_role: string
          backup_contact_name: string | null
          backup_contact_phone: string | null
          base_id: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_contact_radio: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          agency_name: string
          agency_role: string
          backup_contact_name?: string | null
          backup_contact_phone?: string | null
          base_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_radio?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          agency_name?: string
          agency_role?: string
          backup_contact_name?: string | null
          backup_contact_phone?: string | null
          base_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_radio?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aep_response_agencies_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      airfield_checks: {
        Row: {
          areas: string[]
          base_id: string | null
          check_type: string
          completed_at: string | null
          completed_by: string | null
          completed_by_id: string | null
          created_at: string
          data: Json
          display_id: string
          draft_data: Json | null
          id: string
          latitude: number | null
          longitude: number | null
          photo_count: number
          saved_at: string | null
          saved_by_id: string | null
          saved_by_name: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          areas?: string[]
          base_id?: string | null
          check_type: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_id?: string | null
          created_at?: string
          data?: Json
          display_id: string
          draft_data?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          photo_count?: number
          saved_at?: string | null
          saved_by_id?: string | null
          saved_by_name?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          areas?: string[]
          base_id?: string | null
          check_type?: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_id?: string | null
          created_at?: string
          data?: Json
          display_id?: string
          draft_data?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          photo_count?: number
          saved_at?: string | null
          saved_by_id?: string | null
          saved_by_name?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "airfield_checks_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "airfield_checks_completed_by_id_fkey"
            columns: ["completed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      airfield_contractors: {
        Row: {
          af_form_483: string | null
          af_form_483_expiration: string | null
          base_id: string | null
          callsign: string | null
          company_name: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          flag_number: string | null
          id: string
          location: string
          notes: string | null
          radio_number: string | null
          start_date: string
          status: string
          updated_at: string
          work_description: string
        }
        Insert: {
          af_form_483?: string | null
          af_form_483_expiration?: string | null
          base_id?: string | null
          callsign?: string | null
          company_name: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          flag_number?: string | null
          id?: string
          location: string
          notes?: string | null
          radio_number?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          work_description: string
        }
        Update: {
          af_form_483?: string | null
          af_form_483_expiration?: string | null
          base_id?: string | null
          callsign?: string | null
          company_name?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          flag_number?: string | null
          id?: string
          location?: string
          notes?: string | null
          radio_number?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          work_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "airfield_contractors_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      airfield_driver_licenses: {
        Row: {
          af_483_number: string | null
          base_id: string
          created_at: string
          first_name: string | null
          grade_rank: string | null
          id: string
          last_name: string
          middle_name: string | null
          office: string | null
          refresher_due: string | null
          restrictions: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          af_483_number?: string | null
          base_id: string
          created_at?: string
          first_name?: string | null
          grade_rank?: string | null
          id?: string
          last_name: string
          middle_name?: string | null
          office?: string | null
          refresher_due?: string | null
          restrictions?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          af_483_number?: string | null
          base_id?: string
          created_at?: string
          first_name?: string | null
          grade_rank?: string | null
          id?: string
          last_name?: string
          middle_name?: string | null
          office?: string | null
          refresher_due?: string | null
          restrictions?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "airfield_driver_licenses_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      airfield_status: {
        Row: {
          active_runway: string
          advisories: Json
          advisory_text: string | null
          advisory_type: string | null
          afm_closed: boolean
          afm_closed_message: string | null
          afm_ooo_message: string | null
          afm_out_of_office: boolean
          arff_cat: number | null
          arff_statuses: Json | null
          base_id: string | null
          bwc_updated_at: string | null
          bwc_value: string | null
          construction_remarks: string | null
          id: string
          misc_remarks: string | null
          rcr_condition: string | null
          rcr_midpoint: string | null
          rcr_rollout: string | null
          rcr_touchdown: string | null
          rcr_updated_at: string | null
          rsc_condition: string | null
          rsc_updated_at: string | null
          runway_status: string
          runway_statuses: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_runway?: string
          advisories?: Json
          advisory_text?: string | null
          advisory_type?: string | null
          afm_closed?: boolean
          afm_closed_message?: string | null
          afm_ooo_message?: string | null
          afm_out_of_office?: boolean
          arff_cat?: number | null
          arff_statuses?: Json | null
          base_id?: string | null
          bwc_updated_at?: string | null
          bwc_value?: string | null
          construction_remarks?: string | null
          id?: string
          misc_remarks?: string | null
          rcr_condition?: string | null
          rcr_midpoint?: string | null
          rcr_rollout?: string | null
          rcr_touchdown?: string | null
          rcr_updated_at?: string | null
          rsc_condition?: string | null
          rsc_updated_at?: string | null
          runway_status?: string
          runway_statuses?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_runway?: string
          advisories?: Json
          advisory_text?: string | null
          advisory_type?: string | null
          afm_closed?: boolean
          afm_closed_message?: string | null
          afm_ooo_message?: string | null
          afm_out_of_office?: boolean
          arff_cat?: number | null
          arff_statuses?: Json | null
          base_id?: string | null
          bwc_updated_at?: string | null
          bwc_value?: string | null
          construction_remarks?: string | null
          id?: string
          misc_remarks?: string | null
          rcr_condition?: string | null
          rcr_midpoint?: string | null
          rcr_rollout?: string | null
          rcr_touchdown?: string | null
          rcr_updated_at?: string | null
          rsc_condition?: string | null
          rsc_updated_at?: string | null
          runway_status?: string
          runway_statuses?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "airfield_status_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "airfield_status_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_1098_catalog: {
        Row: {
          base_id: string
          created_at: string
          frequency: string
          id: string
          managed: boolean
          retired: boolean
          score_or_hours: string | null
          sort_order: number
          task: string
          type: string | null
          updated_at: string
          year_label: string
        }
        Insert: {
          base_id: string
          created_at?: string
          frequency?: string
          id?: string
          managed?: boolean
          retired?: boolean
          score_or_hours?: string | null
          sort_order?: number
          task: string
          type?: string | null
          updated_at?: string
          year_label: string
        }
        Update: {
          base_id?: string
          created_at?: string
          frequency?: string
          id?: string
          managed?: boolean
          retired?: boolean
          score_or_hours?: string | null
          sort_order?: number
          task?: string
          type?: string | null
          updated_at?: string
          year_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_1098_catalog_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_1098_progress: {
        Row: {
          base_id: string
          catalog_id: string
          certifier_initials: string | null
          certifier_signed_at: string | null
          certifier_signed_by: string | null
          id: string
          last_completed: string | null
          locked_at: string | null
          locked_by: string | null
          member_id: string
          next_due: string | null
          next_due_manual: boolean
          score_or_hours: string | null
          start_date: string | null
          trainee_initials: string | null
          trainee_signed_at: string | null
          trainee_signed_by: string | null
          year_label: string
        }
        Insert: {
          base_id: string
          catalog_id: string
          certifier_initials?: string | null
          certifier_signed_at?: string | null
          certifier_signed_by?: string | null
          id?: string
          last_completed?: string | null
          locked_at?: string | null
          locked_by?: string | null
          member_id: string
          next_due?: string | null
          next_due_manual?: boolean
          score_or_hours?: string | null
          start_date?: string | null
          trainee_initials?: string | null
          trainee_signed_at?: string | null
          trainee_signed_by?: string | null
          year_label: string
        }
        Update: {
          base_id?: string
          catalog_id?: string
          certifier_initials?: string | null
          certifier_signed_at?: string | null
          certifier_signed_by?: string | null
          id?: string
          last_completed?: string | null
          locked_at?: string | null
          locked_by?: string | null
          member_id?: string
          next_due?: string | null
          next_due_manual?: boolean
          score_or_hours?: string | null
          start_date?: string | null
          trainee_initials?: string | null
          trainee_signed_at?: string | null
          trainee_signed_by?: string | null
          year_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_1098_progress_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_1098_progress_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "amtr_1098_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_1098_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_1098_resources: {
        Row: {
          base_id: string
          catalog_id: string
          created_at: string
          id: string
          label: string
          sort_order: number
          updated_at: string
          url: string | null
        }
        Insert: {
          base_id: string
          catalog_id: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Update: {
          base_id?: string
          catalog_id?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amtr_1098_resources_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_1098_resources_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "amtr_1098_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_1098_years: {
        Row: {
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          base_id: string
          created_at: string
          id: string
          is_current: boolean
          year_label: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          base_id: string
          created_at?: string
          id?: string
          is_current?: boolean
          year_label: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          base_id?: string
          created_at?: string
          id?: string
          is_current?: boolean
          year_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_1098_years_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_623a: {
        Row: {
          afm_comment: string | null
          afm_initials: string | null
          afm_signed_at: string | null
          afm_signed_by: string | null
          base_id: string
          created_at: string
          created_by: string | null
          entry_type: string | null
          form_date: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          member_id: string
          namt_comment: string | null
          namt_initials: string | null
          namt_signed_at: string | null
          namt_signed_by: string | null
          requires_certifier: boolean
          source_row_id: string | null
          source_table: string | null
          trainee_comment: string | null
          trainee_initials: string | null
          trainee_signed_at: string | null
          trainee_signed_by: string | null
          trainer_comment: string | null
          trainer_initials: string | null
          trainer_signed_at: string | null
          trainer_signed_by: string | null
          transcribed: boolean
          updated_at: string
        }
        Insert: {
          afm_comment?: string | null
          afm_initials?: string | null
          afm_signed_at?: string | null
          afm_signed_by?: string | null
          base_id: string
          created_at?: string
          created_by?: string | null
          entry_type?: string | null
          form_date?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          member_id: string
          namt_comment?: string | null
          namt_initials?: string | null
          namt_signed_at?: string | null
          namt_signed_by?: string | null
          requires_certifier?: boolean
          source_row_id?: string | null
          source_table?: string | null
          trainee_comment?: string | null
          trainee_initials?: string | null
          trainee_signed_at?: string | null
          trainee_signed_by?: string | null
          trainer_comment?: string | null
          trainer_initials?: string | null
          trainer_signed_at?: string | null
          trainer_signed_by?: string | null
          transcribed?: boolean
          updated_at?: string
        }
        Update: {
          afm_comment?: string | null
          afm_initials?: string | null
          afm_signed_at?: string | null
          afm_signed_by?: string | null
          base_id?: string
          created_at?: string
          created_by?: string | null
          entry_type?: string | null
          form_date?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          member_id?: string
          namt_comment?: string | null
          namt_initials?: string | null
          namt_signed_at?: string | null
          namt_signed_by?: string | null
          requires_certifier?: boolean
          source_row_id?: string | null
          source_table?: string | null
          trainee_comment?: string | null
          trainee_initials?: string | null
          trainee_signed_at?: string | null
          trainee_signed_by?: string | null
          trainer_comment?: string | null
          trainer_initials?: string | null
          trainer_signed_at?: string | null
          trainer_signed_by?: string | null
          transcribed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_623a_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_623a_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_623a_comment_templates: {
        Row: {
          base_id: string
          body: string
          cite: string
          created_at: string
          id: string
          key: string
          label: string
          managed: boolean
          retired: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_id: string
          body?: string
          cite?: string
          created_at?: string
          id?: string
          key: string
          label: string
          managed?: boolean
          retired?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_id?: string
          body?: string
          cite?: string
          created_at?: string
          id?: string
          key?: string
          label?: string
          managed?: boolean
          retired?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_623a_comment_templates_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_623a_entry_types: {
        Row: {
          base_id: string
          created_at: string
          id: string
          label: string
          managed: boolean
          retired: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          label: string
          managed?: boolean
          retired?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          label?: string
          managed?: boolean
          retired?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_623a_entry_types_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_797: {
        Row: {
          added_by: string | null
          base_id: string
          certifier_initials: string | null
          certifier_signed_at: string | null
          certifier_signed_by: string | null
          complete_date: string | null
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          member_id: string
          milestone_window: string | null
          requires_certifier: boolean
          sort_order: number
          start_date: string | null
          task: string
          trainee_initials: string | null
          trainee_signed_at: string | null
          trainee_signed_by: string | null
          trainer_initials: string | null
          trainer_signed_at: string | null
          trainer_signed_by: string | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          base_id: string
          certifier_initials?: string | null
          certifier_signed_at?: string | null
          certifier_signed_by?: string | null
          complete_date?: string | null
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          member_id: string
          milestone_window?: string | null
          requires_certifier?: boolean
          sort_order?: number
          start_date?: string | null
          task: string
          trainee_initials?: string | null
          trainee_signed_at?: string | null
          trainee_signed_by?: string | null
          trainer_initials?: string | null
          trainer_signed_at?: string | null
          trainer_signed_by?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          base_id?: string
          certifier_initials?: string | null
          certifier_signed_at?: string | null
          certifier_signed_by?: string | null
          complete_date?: string | null
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          member_id?: string
          milestone_window?: string | null
          requires_certifier?: boolean
          sort_order?: number
          start_date?: string | null
          task?: string
          trainee_initials?: string | null
          trainee_signed_at?: string | null
          trainee_signed_by?: string | null
          trainer_initials?: string | null
          trainer_signed_at?: string | null
          trainer_signed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_797_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_797_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_803: {
        Row: {
          base_id: string
          eval_date: string | null
          evaluator_initials: string | null
          evaluator_signed_at: string | null
          evaluator_signed_by: string | null
          id: string
          in_ugt: string | null
          locked_at: string | null
          locked_by: string | null
          member_id: string
          remarks: string | null
          results: string | null
          section: string
          sort_order: number
          sts_item: string | null
          unsat_comment: string | null
        }
        Insert: {
          base_id: string
          eval_date?: string | null
          evaluator_initials?: string | null
          evaluator_signed_at?: string | null
          evaluator_signed_by?: string | null
          id?: string
          in_ugt?: string | null
          locked_at?: string | null
          locked_by?: string | null
          member_id: string
          remarks?: string | null
          results?: string | null
          section: string
          sort_order?: number
          sts_item?: string | null
          unsat_comment?: string | null
        }
        Update: {
          base_id?: string
          eval_date?: string | null
          evaluator_initials?: string | null
          evaluator_signed_at?: string | null
          evaluator_signed_by?: string | null
          id?: string
          in_ugt?: string | null
          locked_at?: string | null
          locked_by?: string | null
          member_id?: string
          remarks?: string | null
          results?: string | null
          section?: string
          sort_order?: number
          sts_item?: string | null
          unsat_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amtr_803_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_803_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_803_catalog: {
        Row: {
          base_id: string
          created_at: string
          id: string
          managed: boolean
          retired: boolean
          section: string
          sort_order: number
          sts_item: string
          updated_at: string
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          managed?: boolean
          retired?: boolean
          section: string
          sort_order?: number
          sts_item: string
          updated_at?: string
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          managed?: boolean
          retired?: boolean
          section?: string
          sort_order?: number
          sts_item?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_803_catalog_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_803_sections: {
        Row: {
          base_id: string
          builtin: boolean
          created_at: string
          id: string
          label: string
          section_key: string
          seed_default: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_id: string
          builtin?: boolean
          created_at?: string
          id?: string
          label: string
          section_key: string
          seed_default?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_id?: string
          builtin?: boolean
          created_at?: string
          id?: string
          label?: string
          section_key?: string
          seed_default?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_803_sections_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          base_id: string
          created_at: string
          detail: string | null
          id: string
          member_id: string | null
          row_id: string | null
          table_name: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          base_id: string
          created_at?: string
          detail?: string | null
          id?: string
          member_id?: string | null
          row_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          base_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          member_id?: string | null
          row_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amtr_audit_log_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_audit_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_catalog_version: {
        Row: {
          base_id: string
          updated_at: string
          version: string
        }
        Insert: {
          base_id: string
          updated_at?: string
          version: string
        }
        Update: {
          base_id?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_catalog_version_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: true
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_files: {
        Row: {
          base_id: string
          created_at: string
          document_date: string | null
          document_title: string | null
          id: string
          member_id: string
          mime_type: string | null
          name: string
          size: string | null
          sort_order: number
          status: string
          storage_path: string | null
          uploaded_at: string | null
        }
        Insert: {
          base_id: string
          created_at?: string
          document_date?: string | null
          document_title?: string | null
          id?: string
          member_id: string
          mime_type?: string | null
          name: string
          size?: string | null
          sort_order?: number
          status?: string
          storage_path?: string | null
          uploaded_at?: string | null
        }
        Update: {
          base_id?: string
          created_at?: string
          document_date?: string | null
          document_title?: string | null
          id?: string
          member_id?: string
          mime_type?: string | null
          name?: string
          size?: string | null
          sort_order?: number
          status?: string
          storage_path?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amtr_files_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_files_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_formal_catalog: {
        Row: {
          base_id: string
          course: string
          created_at: string
          id: string
          managed: boolean
          retired: boolean
          section: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_id: string
          course: string
          created_at?: string
          id?: string
          managed?: boolean
          retired?: boolean
          section: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_id?: string
          course?: string
          created_at?: string
          id?: string
          managed?: boolean
          retired?: boolean
          section?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_formal_catalog_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_formal_progress: {
        Row: {
          base_id: string
          catalog_id: string
          complete_date: string | null
          id: string
          member_id: string
          start_date: string | null
        }
        Insert: {
          base_id: string
          catalog_id: string
          complete_date?: string | null
          id?: string
          member_id: string
          start_date?: string | null
        }
        Update: {
          base_id?: string
          catalog_id?: string
          complete_date?: string | null
          id?: string
          member_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amtr_formal_progress_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_formal_progress_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "amtr_formal_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_formal_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_inspection_checklist: {
        Row: {
          auto_key: string | null
          base_id: string
          created_at: string
          id: string
          item_number: string | null
          kind: string
          label: string
          managed: boolean
          retired: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          auto_key?: string | null
          base_id: string
          created_at?: string
          id?: string
          item_number?: string | null
          kind: string
          label: string
          managed?: boolean
          retired?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          auto_key?: string | null
          base_id?: string
          created_at?: string
          id?: string
          item_number?: string | null
          kind?: string
          label?: string
          managed?: boolean
          retired?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_inspection_checklist_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_inspections: {
        Row: {
          base_id: string
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_623a_id: string | null
          created_at: string
          created_by: string | null
          gap_count: number
          id: string
          inspection_date: string
          items: Json
          member_id: string
          na_count: number
          no_count: number
          notes: string | null
          status: string
          updated_at: string
          yes_count: number
        }
        Insert: {
          base_id: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_623a_id?: string | null
          created_at?: string
          created_by?: string | null
          gap_count?: number
          id?: string
          inspection_date?: string
          items?: Json
          member_id: string
          na_count?: number
          no_count?: number
          notes?: string | null
          status?: string
          updated_at?: string
          yes_count?: number
        }
        Update: {
          base_id?: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_623a_id?: string | null
          created_at?: string
          created_by?: string | null
          gap_count?: number
          id?: string
          inspection_date?: string
          items?: Json
          member_id?: string
          na_count?: number
          no_count?: number
          notes?: string | null
          status?: string
          updated_at?: string
          yes_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "amtr_inspections_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_inspections_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_jqs_catalog: {
        Row: {
          base_id: string
          core_cert: string | null
          created_at: string
          deploy_sei: string | null
          depth: number
          id: string
          kind: string
          managed: boolean
          number: string | null
          prof3: string | null
          prof5: string | null
          prof7: string | null
          prof9: string | null
          required: boolean
          retired: boolean
          sort_order: number
          title: string
          training_refs: string | null
          updated_at: string
        }
        Insert: {
          base_id: string
          core_cert?: string | null
          created_at?: string
          deploy_sei?: string | null
          depth?: number
          id?: string
          kind: string
          managed?: boolean
          number?: string | null
          prof3?: string | null
          prof5?: string | null
          prof7?: string | null
          prof9?: string | null
          required?: boolean
          retired?: boolean
          sort_order?: number
          title: string
          training_refs?: string | null
          updated_at?: string
        }
        Update: {
          base_id?: string
          core_cert?: string | null
          created_at?: string
          deploy_sei?: string | null
          depth?: number
          id?: string
          kind?: string
          managed?: boolean
          number?: string | null
          prof3?: string | null
          prof5?: string | null
          prof7?: string | null
          prof9?: string | null
          required?: boolean
          retired?: boolean
          sort_order?: number
          title?: string
          training_refs?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_jqs_catalog_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_jqs_progress: {
        Row: {
          base_id: string
          catalog_id: string
          certifier_initials: string | null
          certifier_signed_at: string | null
          certifier_signed_by: string | null
          complete_date: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          member_id: string
          start_date: string | null
          trainee_initials: string | null
          trainee_signed_at: string | null
          trainee_signed_by: string | null
          trainer_initials: string | null
          trainer_signed_at: string | null
          trainer_signed_by: string | null
        }
        Insert: {
          base_id: string
          catalog_id: string
          certifier_initials?: string | null
          certifier_signed_at?: string | null
          certifier_signed_by?: string | null
          complete_date?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          member_id: string
          start_date?: string | null
          trainee_initials?: string | null
          trainee_signed_at?: string | null
          trainee_signed_by?: string | null
          trainer_initials?: string | null
          trainer_signed_at?: string | null
          trainer_signed_by?: string | null
        }
        Update: {
          base_id?: string
          catalog_id?: string
          certifier_initials?: string | null
          certifier_signed_at?: string | null
          certifier_signed_by?: string | null
          complete_date?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          member_id?: string
          start_date?: string | null
          trainee_initials?: string | null
          trainee_signed_at?: string | null
          trainee_signed_by?: string | null
          trainer_initials?: string | null
          trainer_signed_at?: string | null
          trainer_signed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amtr_jqs_progress_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_jqs_progress_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "amtr_jqs_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_jqs_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_member_exclusions: {
        Row: {
          base_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_member_exclusions_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_member_exclusions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_members: {
        Row: {
          base_id: string
          commander: string | null
          created_at: string
          created_by: string | null
          dafsc: string | null
          date_assigned: string | null
          duty_position: string | null
          full_name: string
          grade: string | null
          id: string
          installation: string | null
          status: string
          supervisor: string | null
          tsc: string | null
          unit: string | null
          updated_at: string
          user_id: string | null
          utm: string | null
        }
        Insert: {
          base_id: string
          commander?: string | null
          created_at?: string
          created_by?: string | null
          dafsc?: string | null
          date_assigned?: string | null
          duty_position?: string | null
          full_name: string
          grade?: string | null
          id?: string
          installation?: string | null
          status?: string
          supervisor?: string | null
          tsc?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string | null
          utm?: string | null
        }
        Update: {
          base_id?: string
          commander?: string | null
          created_at?: string
          created_by?: string | null
          dafsc?: string | null
          date_assigned?: string | null
          duty_position?: string | null
          full_name?: string
          grade?: string | null
          id?: string
          installation?: string | null
          status?: string
          supervisor?: string | null
          tsc?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string | null
          utm?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amtr_members_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_milestone_catalog: {
        Row: {
          base_id: string
          created_at: string
          haf_milestone: string | null
          id: string
          managed: boolean
          path: string
          phase_label: string
          retired: boolean
          sort_order: number
          sts_items: string | null
          target_window: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          base_id: string
          created_at?: string
          haf_milestone?: string | null
          id?: string
          managed?: boolean
          path: string
          phase_label: string
          retired?: boolean
          sort_order?: number
          sts_items?: string | null
          target_window?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          base_id?: string
          created_at?: string
          haf_milestone?: string | null
          id?: string
          managed?: boolean
          path?: string
          phase_label?: string
          retired?: boolean
          sort_order?: number
          sts_items?: string | null
          target_window?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_milestone_catalog_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_milestone_progress: {
        Row: {
          base_id: string
          catalog_id: string
          certifier_initials: string | null
          certifier_signed_at: string | null
          certifier_signed_by: string | null
          completed: boolean
          completed_date: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          member_id: string
          target_window: string | null
        }
        Insert: {
          base_id: string
          catalog_id: string
          certifier_initials?: string | null
          certifier_signed_at?: string | null
          certifier_signed_by?: string | null
          completed?: boolean
          completed_date?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          member_id: string
          target_window?: string | null
        }
        Update: {
          base_id?: string
          catalog_id?: string
          certifier_initials?: string | null
          certifier_signed_at?: string | null
          certifier_signed_by?: string | null
          completed?: boolean
          completed_date?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          member_id?: string
          target_window?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amtr_milestone_progress_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_milestone_progress_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "amtr_milestone_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_milestone_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_notifications: {
        Row: {
          base_id: string
          body: string
          created_at: string
          dedupe_key: string | null
          dismissed_at: string | null
          id: string
          kind: string
          member_id: string
          recipient_user_id: string
          target_item_id: string | null
          target_tab: string | null
        }
        Insert: {
          base_id: string
          body: string
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          id?: string
          kind: string
          member_id: string
          recipient_user_id: string
          target_item_id?: string | null
          target_tab?: string | null
        }
        Update: {
          base_id?: string
          body?: string
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          id?: string
          kind?: string
          member_id?: string
          recipient_user_id?: string
          target_item_id?: string | null
          target_tab?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amtr_notifications_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_qtp: {
        Row: {
          base_id: string
          complete_date: string | null
          created_at: string
          ecd: string | null
          id: string
          member_id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_id: string
          complete_date?: string | null
          created_at?: string
          ecd?: string | null
          id?: string
          member_id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_id?: string
          complete_date?: string | null
          created_at?: string
          ecd?: string | null
          id?: string
          member_id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_qtp_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_qtp_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_qtp_lessons: {
        Row: {
          base_id: string
          complete_date: string | null
          id: string
          name: string
          qtp_id: string
          sort_order: number
          start_date: string | null
        }
        Insert: {
          base_id: string
          complete_date?: string | null
          id?: string
          name: string
          qtp_id: string
          sort_order?: number
          start_date?: string | null
        }
        Update: {
          base_id?: string
          complete_date?: string | null
          id?: string
          name?: string
          qtp_id?: string
          sort_order?: number
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amtr_qtp_lessons_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_qtp_lessons_qtp_id_fkey"
            columns: ["qtp_id"]
            isOneToOne: false
            referencedRelation: "amtr_qtp"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_qual_catalog: {
        Row: {
          base_id: string
          category: string
          created_at: string
          id: string
          managed: boolean
          name: string
          retired: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_id: string
          category: string
          created_at?: string
          id?: string
          managed?: boolean
          name: string
          retired?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_id?: string
          category?: string
          created_at?: string
          id?: string
          managed?: boolean
          name?: string
          retired?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_qual_catalog_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_qual_progress: {
        Row: {
          attained: boolean
          base_id: string
          catalog_id: string
          complete_date: string | null
          created_at: string
          id: string
          member_id: string
          updated_at: string
        }
        Insert: {
          attained?: boolean
          base_id: string
          catalog_id: string
          complete_date?: string | null
          created_at?: string
          id?: string
          member_id: string
          updated_at?: string
        }
        Update: {
          attained?: boolean
          base_id?: string
          catalog_id?: string
          complete_date?: string | null
          created_at?: string
          id?: string
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_qual_progress_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_qual_progress_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "amtr_qual_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_qual_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_quals: {
        Row: {
          base_id: string
          id: string
          member_id: string
          name: string
          notes: string | null
          sort_order: number
          value: string | null
        }
        Insert: {
          base_id: string
          id?: string
          member_id: string
          name: string
          notes?: string | null
          sort_order?: number
          value?: string | null
        }
        Update: {
          base_id?: string
          id?: string
          member_id?: string
          name?: string
          notes?: string | null
          sort_order?: number
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amtr_quals_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_quals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_rat_catalog: {
        Row: {
          base_id: string
          category: string | null
          course: string
          created_at: string
          frequency: string
          id: string
          managed: boolean
          method: string | null
          retired: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_id: string
          category?: string | null
          course: string
          created_at?: string
          frequency?: string
          id?: string
          managed?: boolean
          method?: string | null
          retired?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_id?: string
          category?: string | null
          course?: string
          created_at?: string
          frequency?: string
          id?: string
          managed?: boolean
          method?: string | null
          retired?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_rat_catalog_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_rat_progress: {
        Row: {
          base_id: string
          catalog_id: string
          completed: string | null
          due: string | null
          id: string
          member_id: string
        }
        Insert: {
          base_id: string
          catalog_id: string
          completed?: string | null
          due?: string | null
          id?: string
          member_id: string
        }
        Update: {
          base_id?: string
          catalog_id?: string
          completed?: string | null
          due?: string | null
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_rat_progress_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_rat_progress_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "amtr_rat_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_rat_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amtr_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_reference_index: {
        Row: {
          base_id: string
          created_at: string
          id: string
          link: string | null
          publication: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          link?: string | null
          publication?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          link?: string | null
          publication?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_reference_index_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      amtr_role_assignments: {
        Row: {
          base_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amtr_role_assignments_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amtr_role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_review_digest_log: {
        Row: {
          aep_due_date: string | null
          base_id: string
          id: string
          reasons: string[]
          recipient: string
          send_date: string
          sent_at: string
          whmp_due_date: string | null
        }
        Insert: {
          aep_due_date?: string | null
          base_id: string
          id?: string
          reasons?: string[]
          recipient: string
          send_date: string
          sent_at?: string
          whmp_due_date?: string | null
        }
        Update: {
          aep_due_date?: string | null
          base_id?: string
          id?: string
          reasons?: string[]
          recipient?: string
          send_date?: string
          sent_at?: string
          whmp_due_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "annual_review_digest_log_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      arff_status_log: {
        Row: {
          aircraft_name: string | null
          base_id: string | null
          changed_by: string | null
          created_at: string
          id: string
          new_cat: number | null
          new_readiness: string | null
          old_cat: number | null
          old_readiness: string | null
          reason: string | null
        }
        Insert: {
          aircraft_name?: string | null
          base_id?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_cat?: number | null
          new_readiness?: string | null
          old_cat?: number | null
          old_readiness?: string | null
          reason?: string | null
        }
        Update: {
          aircraft_name?: string | null
          base_id?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_cat?: number | null
          new_readiness?: string | null
          old_cat?: number | null
          old_readiness?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arff_status_log_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arff_status_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      base_areas: {
        Row: {
          area_name: string
          base_id: string
          created_at: string
          id: string
          sort_order: number
        }
        Insert: {
          area_name: string
          base_id: string
          created_at?: string
          id?: string
          sort_order?: number
        }
        Update: {
          area_name?: string
          base_id?: string
          created_at?: string
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_areas_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      base_arff_aircraft: {
        Row: {
          aircraft_name: string
          base_id: string
          created_at: string
          id: string
          sort_order: number
        }
        Insert: {
          aircraft_name: string
          base_id: string
          created_at?: string
          id?: string
          sort_order?: number
        }
        Update: {
          aircraft_name?: string
          base_id?: string
          created_at?: string
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_arff_aircraft_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      base_facilities: {
        Row: {
          base_id: string
          created_at: string
          description: string
          facility_number: string
          id: string
          sort_order: number
        }
        Insert: {
          base_id: string
          created_at?: string
          description: string
          facility_number: string
          id?: string
          sort_order?: number
        }
        Update: {
          base_id?: string
          created_at?: string
          description?: string
          facility_number?: string
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_facilities_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      base_inspection_items: {
        Row: {
          id: string
          item_key: string
          item_number: number
          item_text: string
          item_type: string
          section_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          item_key: string
          item_number: number
          item_text: string
          item_type?: string
          section_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          item_key?: string
          item_number?: number
          item_text?: string
          item_type?: string
          section_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_inspection_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "base_inspection_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      base_inspection_sections: {
        Row: {
          conditional: string | null
          guidance: string | null
          id: string
          section_id: string
          sort_order: number
          template_id: string
          title: string
        }
        Insert: {
          conditional?: string | null
          guidance?: string | null
          id?: string
          section_id: string
          sort_order?: number
          template_id: string
          title: string
        }
        Update: {
          conditional?: string | null
          guidance?: string | null
          id?: string
          section_id?: string
          sort_order?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_inspection_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "base_inspection_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      base_inspection_templates: {
        Row: {
          base_id: string
          created_at: string
          id: string
          template_type: string
          updated_at: string
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          template_type: string
          updated_at?: string
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_inspection_templates_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      base_kiosk_tokens: {
        Row: {
          base_id: string
          token: string
          updated_at: string
        }
        Insert: {
          base_id: string
          token: string
          updated_at?: string
        }
        Update: {
          base_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_kiosk_tokens_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: true
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      base_members: {
        Row: {
          base_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_members_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      base_navaids: {
        Row: {
          base_id: string
          created_at: string
          id: string
          navaid_name: string
          sort_order: number
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          navaid_name: string
          sort_order?: number
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          navaid_name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_navaids_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      base_runways: {
        Row: {
          base_id: string
          created_at: string
          end1_approach_lighting: string | null
          end1_designator: string
          end1_elevation_msl: number | null
          end1_heading: number | null
          end1_latitude: number | null
          end1_longitude: number | null
          end2_approach_lighting: string | null
          end2_designator: string
          end2_elevation_msl: number | null
          end2_heading: number | null
          end2_latitude: number | null
          end2_longitude: number | null
          faa_approach_category: string | null
          faa_approach_type: string | null
          icao_approach_classification: string | null
          icao_code_number: number | null
          icao_strip_width_m: number | null
          id: string
          length_ft: number
          runway_class: string | null
          runway_id: string
          surface: string
          true_heading: number | null
          width_ft: number
        }
        Insert: {
          base_id: string
          created_at?: string
          end1_approach_lighting?: string | null
          end1_designator: string
          end1_elevation_msl?: number | null
          end1_heading?: number | null
          end1_latitude?: number | null
          end1_longitude?: number | null
          end2_approach_lighting?: string | null
          end2_designator: string
          end2_elevation_msl?: number | null
          end2_heading?: number | null
          end2_latitude?: number | null
          end2_longitude?: number | null
          faa_approach_category?: string | null
          faa_approach_type?: string | null
          icao_approach_classification?: string | null
          icao_code_number?: number | null
          icao_strip_width_m?: number | null
          id?: string
          length_ft: number
          runway_class?: string | null
          runway_id: string
          surface?: string
          true_heading?: number | null
          width_ft: number
        }
        Update: {
          base_id?: string
          created_at?: string
          end1_approach_lighting?: string | null
          end1_designator?: string
          end1_elevation_msl?: number | null
          end1_heading?: number | null
          end1_latitude?: number | null
          end1_longitude?: number | null
          end2_approach_lighting?: string | null
          end2_designator?: string
          end2_elevation_msl?: number | null
          end2_heading?: number | null
          end2_latitude?: number | null
          end2_longitude?: number | null
          faa_approach_category?: string | null
          faa_approach_type?: string | null
          icao_approach_classification?: string | null
          icao_code_number?: number | null
          icao_strip_width_m?: number | null
          id?: string
          length_ft?: number
          runway_class?: string | null
          runway_id?: string
          surface?: string
          true_heading?: number | null
          width_ft?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_runways_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      base_taxiways: {
        Row: {
          base_id: string
          centerline_coords: Json
          created_at: string | null
          created_by: string | null
          designator: string
          id: string
          notes: string | null
          runway_class: string | null
          service_branch: string | null
          standard: string
          taxiway_type: string
          tdg: number | null
          updated_at: string | null
          width_ft: number | null
        }
        Insert: {
          base_id: string
          centerline_coords?: Json
          created_at?: string | null
          created_by?: string | null
          designator: string
          id?: string
          notes?: string | null
          runway_class?: string | null
          service_branch?: string | null
          standard?: string
          taxiway_type?: string
          tdg?: number | null
          updated_at?: string | null
          width_ft?: number | null
        }
        Update: {
          base_id?: string
          centerline_coords?: Json
          created_at?: string | null
          created_by?: string | null
          designator?: string
          id?: string
          notes?: string | null
          runway_class?: string | null
          service_branch?: string | null
          standard?: string
          taxiway_type?: string
          tdg?: number | null
          updated_at?: string | null
          width_ft?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "base_taxiways_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_taxiways_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      base_wildlife_species: {
        Row: {
          added_by: string | null
          base_id: string
          created_at: string | null
          id: string
          is_favorite: boolean
          species_common: string
        }
        Insert: {
          added_by?: string | null
          base_id: string
          created_at?: string | null
          id?: string
          is_favorite?: boolean
          species_common: string
        }
        Update: {
          added_by?: string | null
          base_id?: string
          created_at?: string | null
          id?: string
          is_favorite?: boolean
          species_common?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_wildlife_species_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_wildlife_species_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      bases: {
        Row: {
          activity_templates: Json | null
          // MANUAL after regen: DB column is text; narrowed to match lib/airport-mode.ts
          airport_type: 'usaf' | 'faa_part139'
          amops_email: string | null
          aoc_number: string | null
          arff_config: Json
          c2imera_ppr_eta_column_id: string | null
          c2imera_unit: string
          ce_shops: string[]
          checklist_reset_time: string
          contractor_templates: Json | null
          created_at: string
          default_closed_message: string | null
          default_ooo_message: string | null
          discrepancy_type_shop_map: Json | null
          distance_unit: string
          elevation_msl: number | null
          enabled_modules: string[]
          faa_site_number: string | null
          feedback_form_config: Json
          icao: string | null
          id: string
          installation_code: string | null
          is_active: boolean
          kiosk_enabled: boolean
          location: string | null
          majcom: string | null
          map_provider: string
          name: string
          // MANUAL after regen: DB column is text; narrowed to match lib/airport-mode.ts
          obstruction_surface_set: 'ufc_3_260_01' | 'faa_part77' | 'icao_annex14'
          part139_class: string | null
          qrc_review_interval: string
          quick_setup_pending: Json
          setup_progress: Json
          shift_count: number
          shift_name_day: string | null
          shift_name_mid: string | null
          shift_name_swing: string | null
          status_labels: Json
          timezone: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          activity_templates?: Json | null
          // MANUAL after regen: DB column is text; narrowed to match lib/airport-mode.ts
          airport_type?: 'usaf' | 'faa_part139'
          amops_email?: string | null
          aoc_number?: string | null
          arff_config?: Json
          c2imera_ppr_eta_column_id?: string | null
          c2imera_unit?: string
          ce_shops?: string[]
          checklist_reset_time?: string
          contractor_templates?: Json | null
          created_at?: string
          default_closed_message?: string | null
          default_ooo_message?: string | null
          discrepancy_type_shop_map?: Json | null
          distance_unit?: string
          elevation_msl?: number | null
          enabled_modules?: string[]
          faa_site_number?: string | null
          feedback_form_config?: Json
          icao?: string | null
          id?: string
          installation_code?: string | null
          is_active?: boolean
          kiosk_enabled?: boolean
          location?: string | null
          majcom?: string | null
          map_provider?: string
          name: string
          // MANUAL after regen: DB column is text; narrowed to match lib/airport-mode.ts
          obstruction_surface_set?: 'ufc_3_260_01' | 'faa_part77' | 'icao_annex14'
          part139_class?: string | null
          qrc_review_interval?: string
          quick_setup_pending?: Json
          setup_progress?: Json
          shift_count?: number
          shift_name_day?: string | null
          shift_name_mid?: string | null
          shift_name_swing?: string | null
          status_labels?: Json
          timezone?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          activity_templates?: Json | null
          // MANUAL after regen: DB column is text; narrowed to match lib/airport-mode.ts
          airport_type?: 'usaf' | 'faa_part139'
          amops_email?: string | null
          aoc_number?: string | null
          arff_config?: Json
          c2imera_ppr_eta_column_id?: string | null
          c2imera_unit?: string
          ce_shops?: string[]
          checklist_reset_time?: string
          contractor_templates?: Json | null
          created_at?: string
          default_closed_message?: string | null
          default_ooo_message?: string | null
          discrepancy_type_shop_map?: Json | null
          distance_unit?: string
          elevation_msl?: number | null
          enabled_modules?: string[]
          faa_site_number?: string | null
          feedback_form_config?: Json
          icao?: string | null
          id?: string
          installation_code?: string | null
          is_active?: boolean
          kiosk_enabled?: boolean
          location?: string | null
          majcom?: string | null
          map_provider?: string
          name?: string
          // MANUAL after regen: DB column is text; narrowed to match lib/airport-mode.ts
          obstruction_surface_set?: 'ufc_3_260_01' | 'faa_part77' | 'icao_annex14'
          part139_class?: string | null
          qrc_review_interval?: string
          quick_setup_pending?: Json
          setup_progress?: Json
          shift_count?: number
          shift_name_day?: string | null
          shift_name_mid?: string | null
          shift_name_swing?: string | null
          status_labels?: Json
          timezone?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bwc_history: {
        Row: {
          base_id: string | null
          bwc_value: string
          created_at: string | null
          id: string
          notes: string | null
          set_at: string
          set_by: string | null
          source: string | null
          source_id: string | null
        }
        Insert: {
          base_id?: string | null
          bwc_value: string
          created_at?: string | null
          id?: string
          notes?: string | null
          set_at?: string
          set_by?: string | null
          source?: string | null
          source_id?: string | null
        }
        Update: {
          base_id?: string | null
          bwc_value?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          set_at?: string
          set_by?: string | null
          source?: string | null
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bwc_history_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      check_comments: {
        Row: {
          base_id: string | null
          check_id: string
          comment: string
          created_at: string
          id: string
          user_name: string
        }
        Insert: {
          base_id?: string | null
          check_id: string
          comment: string
          created_at?: string
          id?: string
          user_name: string
        }
        Update: {
          base_id?: string | null
          check_id?: string
          comment?: string
          created_at?: string
          id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_comments_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_comments_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "airfield_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_status_boards: {
        Row: {
          base_id: string
          board_name: string
          created_at: string
          created_by: string | null
          id: string
          section: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_id: string
          board_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          section?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_id?: string
          board_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          section?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_status_boards_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_status_boards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_status_items: {
        Row: {
          base_id: string
          board_id: string
          id: string
          item_name: string
          notes: string | null
          sort_order: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_id: string
          board_id: string
          id?: string
          item_name: string
          notes?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_id?: string
          board_id?: string
          id?: string
          item_name?: string
          notes?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_status_items_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_status_items_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "custom_status_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_status_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_feedback: {
        Row: {
          base_id: string
          comments: string | null
          email: string | null
          id: string
          ip_hash: string | null
          name: string | null
          organization: string | null
          overall_rating: number | null
          responses: Json
          submitted_at: string
        }
        Insert: {
          base_id: string
          comments?: string | null
          email?: string | null
          id?: string
          ip_hash?: string | null
          name?: string | null
          organization?: string | null
          overall_rating?: number | null
          responses?: Json
          submitted_at?: string
        }
        Update: {
          base_id?: string
          comments?: string | null
          email?: string | null
          id?: string
          ip_hash?: string | null
          name?: string | null
          organization?: string | null
          overall_rating?: number | null
          responses?: Json
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_feedback_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_review_slots: {
        Row: {
          base_id: string
          created_at: string
          id: string
          label: string
          permission_key: string | null
          required: boolean
          slot_key: string
          sort_order: number
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          label: string
          permission_key?: string | null
          required?: boolean
          slot_key: string
          sort_order: number
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          label?: string
          permission_key?: string | null
          required?: boolean
          slot_key?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_review_slots_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reviews: {
        Row: {
          afm_events_hash: string | null
          afm_notes: string | null
          afm_signed_at: string | null
          afm_signed_by: string | null
          base_id: string
          created_at: string
          day_amsl_events_hash: string | null
          day_amsl_notes: string | null
          day_amsl_signed_at: string | null
          day_amsl_signed_by: string | null
          fully_certified_at: string | null
          id: string
          mid_amsl_events_hash: string | null
          mid_amsl_notes: string | null
          mid_amsl_signed_at: string | null
          mid_amsl_signed_by: string | null
          namo_events_hash: string | null
          namo_notes: string | null
          namo_signed_at: string | null
          namo_signed_by: string | null
          review_date: string
          swing_amsl_events_hash: string | null
          swing_amsl_notes: string | null
          swing_amsl_signed_at: string | null
          swing_amsl_signed_by: string | null
          updated_at: string
        }
        Insert: {
          afm_events_hash?: string | null
          afm_notes?: string | null
          afm_signed_at?: string | null
          afm_signed_by?: string | null
          base_id: string
          created_at?: string
          day_amsl_events_hash?: string | null
          day_amsl_notes?: string | null
          day_amsl_signed_at?: string | null
          day_amsl_signed_by?: string | null
          fully_certified_at?: string | null
          id?: string
          mid_amsl_events_hash?: string | null
          mid_amsl_notes?: string | null
          mid_amsl_signed_at?: string | null
          mid_amsl_signed_by?: string | null
          namo_events_hash?: string | null
          namo_notes?: string | null
          namo_signed_at?: string | null
          namo_signed_by?: string | null
          review_date: string
          swing_amsl_events_hash?: string | null
          swing_amsl_notes?: string | null
          swing_amsl_signed_at?: string | null
          swing_amsl_signed_by?: string | null
          updated_at?: string
        }
        Update: {
          afm_events_hash?: string | null
          afm_notes?: string | null
          afm_signed_at?: string | null
          afm_signed_by?: string | null
          base_id?: string
          created_at?: string
          day_amsl_events_hash?: string | null
          day_amsl_notes?: string | null
          day_amsl_signed_at?: string | null
          day_amsl_signed_by?: string | null
          fully_certified_at?: string | null
          id?: string
          mid_amsl_events_hash?: string | null
          mid_amsl_notes?: string | null
          mid_amsl_signed_at?: string | null
          mid_amsl_signed_by?: string | null
          namo_events_hash?: string | null
          namo_notes?: string | null
          namo_signed_at?: string | null
          namo_signed_by?: string | null
          review_date?: string
          swing_amsl_events_hash?: string | null
          swing_amsl_notes?: string | null
          swing_amsl_signed_at?: string | null
          swing_amsl_signed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reviews_afm_signed_by_fkey"
            columns: ["afm_signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reviews_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reviews_day_amsl_signed_by_fkey"
            columns: ["day_amsl_signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reviews_mid_amsl_signed_by_fkey"
            columns: ["mid_amsl_signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reviews_namo_signed_by_fkey"
            columns: ["namo_signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reviews_swing_amsl_signed_by_fkey"
            columns: ["swing_amsl_signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_boards: {
        Row: {
          base_id: string
          created_at: string
          id: string
          is_default: boolean
          layout: Json
          name: string
          owner_id: string | null
          role_template: string | null
          scope: string
          updated_at: string
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          layout?: Json
          name?: string
          owner_id?: string | null
          role_template?: string | null
          scope?: string
          updated_at?: string
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          layout?: Json
          name?: string
          owner_id?: string | null
          role_template?: string | null
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_boards_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_boards_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_user_defaults: {
        Row: {
          base_id: string
          board_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_id: string
          board_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_id?: string
          board_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_user_defaults_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_user_defaults_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "dashboard_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_user_defaults_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discrepancies: {
        Row: {
          assigned_shop: string | null
          assigned_to: string | null
          base_id: string | null
          created_at: string
          current_status: string
          description: string
          display_id: string
          estimated_completion_date: string | null
          estimated_cost: string | null
          facility_number: string | null
          id: string
          infrastructure_feature_id: string | null
          inspection_id: string | null
          latitude: number | null
          lighting_system_id: string | null
          linked_notam_id: string | null
          location_text: string
          longitude: number | null
          notam_reference: string | null
          photo_count: number
          project_number: string | null
          reported_by: string | null
          resolution_date: string | null
          resolution_notes: string | null
          risk_control_measure: string | null
          severity: string
          status: string
          title: string
          type: string
          updated_at: string
          work_order_number: string | null
        }
        Insert: {
          assigned_shop?: string | null
          assigned_to?: string | null
          base_id?: string | null
          created_at?: string
          current_status?: string
          description: string
          display_id: string
          estimated_completion_date?: string | null
          estimated_cost?: string | null
          facility_number?: string | null
          id?: string
          infrastructure_feature_id?: string | null
          inspection_id?: string | null
          latitude?: number | null
          lighting_system_id?: string | null
          linked_notam_id?: string | null
          location_text: string
          longitude?: number | null
          notam_reference?: string | null
          photo_count?: number
          project_number?: string | null
          reported_by?: string | null
          resolution_date?: string | null
          resolution_notes?: string | null
          risk_control_measure?: string | null
          severity?: string
          status?: string
          title: string
          type: string
          updated_at?: string
          work_order_number?: string | null
        }
        Update: {
          assigned_shop?: string | null
          assigned_to?: string | null
          base_id?: string | null
          created_at?: string
          current_status?: string
          description?: string
          display_id?: string
          estimated_completion_date?: string | null
          estimated_cost?: string | null
          facility_number?: string | null
          id?: string
          infrastructure_feature_id?: string | null
          inspection_id?: string | null
          latitude?: number | null
          lighting_system_id?: string | null
          linked_notam_id?: string | null
          location_text?: string
          longitude?: number | null
          notam_reference?: string | null
          photo_count?: number
          project_number?: string | null
          reported_by?: string | null
          resolution_date?: string | null
          resolution_notes?: string | null
          risk_control_measure?: string | null
          severity?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          work_order_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discrepancies_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancies_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancies_infrastructure_feature_id_fkey"
            columns: ["infrastructure_feature_id"]
            isOneToOne: false
            referencedRelation: "infrastructure_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancies_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancies_lighting_system_id_fkey"
            columns: ["lighting_system_id"]
            isOneToOne: false
            referencedRelation: "lighting_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancies_linked_notam_id_fkey"
            columns: ["linked_notam_id"]
            isOneToOne: false
            referencedRelation: "notams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancies_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discrepancy_statuses: {
        Row: {
          description: string | null
          is_terminal: boolean
          key: string
          label_faa: string
          label_usaf: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          is_terminal?: boolean
          key: string
          label_faa: string
          label_usaf: string
          sort_order: number
        }
        Update: {
          description?: string | null
          is_terminal?: boolean
          key?: string
          label_faa?: string
          label_usaf?: string
          sort_order?: number
        }
        Relationships: []
      }
      driving_check_items: {
        Row: {
          base_id: string
          created_at: string
          guidance: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_id: string
          created_at?: string
          guidance?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_id?: string
          created_at?: string
          guidance?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driving_check_items_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      driving_check_results: {
        Row: {
          check_id: string
          created_at: string
          id: string
          item_id: string | null
          item_label: string
          notes: string | null
          sort_order: number
          status: string
        }
        Insert: {
          check_id: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_label: string
          notes?: string | null
          sort_order?: number
          status: string
        }
        Update: {
          check_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_label?: string
          notes?: string | null
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "driving_check_results_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "driving_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driving_check_results_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "driving_check_items"
            referencedColumns: ["id"]
          },
        ]
      }
      driving_checks: {
        Row: {
          base_id: string
          checked_at: string
          completed_by: string | null
          completed_by_name: string | null
          completed_by_oi: string | null
          contractor_id: string | null
          created_at: string
          driver_483_number: string | null
          driver_name: string
          driver_office_symbol: string | null
          driver_phone: string | null
          driver_rank: string | null
          driver_unit: string | null
          form_483_expires: string | null
          form_483_status: string
          id: string
          location: string
          notes: string | null
          overall_result: string
          pov_pass_number: string | null
          updated_at: string
          vehicle_id: string | null
          vehicle_type: string | null
          violation_description: string | null
        }
        Insert: {
          base_id: string
          checked_at?: string
          completed_by?: string | null
          completed_by_name?: string | null
          completed_by_oi?: string | null
          contractor_id?: string | null
          created_at?: string
          driver_483_number?: string | null
          driver_name: string
          driver_office_symbol?: string | null
          driver_phone?: string | null
          driver_rank?: string | null
          driver_unit?: string | null
          form_483_expires?: string | null
          form_483_status: string
          id?: string
          location: string
          notes?: string | null
          overall_result: string
          pov_pass_number?: string | null
          updated_at?: string
          vehicle_id?: string | null
          vehicle_type?: string | null
          violation_description?: string | null
        }
        Update: {
          base_id?: string
          checked_at?: string
          completed_by?: string | null
          completed_by_name?: string | null
          completed_by_oi?: string | null
          contractor_id?: string | null
          created_at?: string
          driver_483_number?: string | null
          driver_name?: string
          driver_office_symbol?: string | null
          driver_phone?: string | null
          driver_rank?: string | null
          driver_unit?: string | null
          form_483_expires?: string | null
          form_483_status?: string
          id?: string
          location?: string
          notes?: string | null
          overall_result?: string
          pov_pass_number?: string | null
          updated_at?: string
          vehicle_id?: string | null
          vehicle_type?: string | null
          violation_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driving_checks_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driving_checks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driving_checks_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "airfield_contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      email_broadcasts: {
        Row: {
          body: string
          created_at: string
          failed_count: number
          filters: Json
          id: string
          recipient_count: number
          sender_id: string | null
          sent_count: number
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          failed_count?: number
          filters?: Json
          id?: string
          recipient_count?: number
          sender_id?: string | null
          sent_count?: number
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          failed_count?: number
          filters?: Json
          id?: string
          recipient_count?: number
          sender_id?: string | null
          sent_count?: number
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_broadcasts_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      field_condition_reports: {
        Row: {
          base_id: string
          conditions_unchanged_since: string | null
          created_at: string
          ficon_text: string
          generated_at: string
          generated_by: string | null
          generated_by_oi: string | null
          id: string
          notes: string | null
          runway_id: string
          superseded_by_id: string | null
          temperature_f: number | null
          treatments: string[]
          valid_until: string
        }
        Insert: {
          base_id: string
          conditions_unchanged_since?: string | null
          created_at?: string
          ficon_text: string
          generated_at?: string
          generated_by?: string | null
          generated_by_oi?: string | null
          id?: string
          notes?: string | null
          runway_id: string
          superseded_by_id?: string | null
          temperature_f?: number | null
          treatments?: string[]
          valid_until: string
        }
        Update: {
          base_id?: string
          conditions_unchanged_since?: string | null
          created_at?: string
          ficon_text?: string
          generated_at?: string
          generated_by?: string | null
          generated_by_oi?: string | null
          id?: string
          notes?: string | null
          runway_id?: string
          superseded_by_id?: string | null
          temperature_f?: number | null
          treatments?: string[]
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_condition_reports_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_condition_reports_conditions_unchanged_since_fkey"
            columns: ["conditions_unchanged_since"]
            isOneToOne: false
            referencedRelation: "field_condition_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_condition_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_condition_reports_runway_id_fkey"
            columns: ["runway_id"]
            isOneToOne: false
            referencedRelation: "base_runways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_condition_reports_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "field_condition_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      field_condition_thirds: {
        Row: {
          contaminant: string
          coverage_percent: number | null
          depth_in: number | null
          id: string
          override_reason: string | null
          report_id: string
          rwycc: number
          rwycc_derived: number
          rwycc_manual_override: boolean
          sort_order: number
          third: string
        }
        Insert: {
          contaminant: string
          coverage_percent?: number | null
          depth_in?: number | null
          id?: string
          override_reason?: string | null
          report_id: string
          rwycc: number
          rwycc_derived: number
          rwycc_manual_override?: boolean
          sort_order: number
          third: string
        }
        Update: {
          contaminant?: string
          coverage_percent?: number | null
          depth_in?: number | null
          id?: string
          override_reason?: string | null
          report_id?: string
          rwycc?: number
          rwycc_derived?: number
          rwycc_manual_override?: boolean
          sort_order?: number
          third?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_condition_thirds_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "field_condition_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      flip_appointment: {
        Row: {
          base_id: string
          custodians: Json
          file_name: string | null
          file_path: string | null
          id: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_id: string
          custodians?: Json
          file_name?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_id?: string
          custodians?: Json
          file_name?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flip_appointment_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: true
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_appointment_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flip_change_events: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          base_id: string
          change_id: string
          created_at: string
          event_type: string
          id: string
          remarks: string | null
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          base_id: string
          change_id: string
          created_at?: string
          event_type: string
          id?: string
          remarks?: string | null
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          base_id?: string
          change_id?: string
          created_at?: string
          event_type?: string
          id?: string
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flip_change_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_change_events_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_change_events_change_id_fkey"
            columns: ["change_id"]
            isOneToOne: false
            referencedRelation: "flip_changes"
            referencedColumns: ["id"]
          },
        ]
      }
      flip_changes: {
        Row: {
          additions: string | null
          afm_approved_at: string | null
          afm_approved_by: string | null
          base_id: string
          coordinated_at: string
          creation_date: string | null
          deletions: string | null
          details: string | null
          flip_title: string
          id: string
          notam: string | null
          pdf_filename: string | null
          pdf_storage_path: string | null
          posted_date: string | null
          posted_initials: string | null
          processed_date: string | null
          published_date: string | null
          reference_doc_page: string | null
          rejected: boolean
          revisions_from: string | null
          revisions_to: string | null
          stage: string
          submitted_by_name: string
          submitted_by_user: string | null
          updated_at: string
        }
        Insert: {
          additions?: string | null
          afm_approved_at?: string | null
          afm_approved_by?: string | null
          base_id: string
          coordinated_at?: string
          creation_date?: string | null
          deletions?: string | null
          details?: string | null
          flip_title: string
          id?: string
          notam?: string | null
          pdf_filename?: string | null
          pdf_storage_path?: string | null
          posted_date?: string | null
          posted_initials?: string | null
          processed_date?: string | null
          published_date?: string | null
          reference_doc_page?: string | null
          rejected?: boolean
          revisions_from?: string | null
          revisions_to?: string | null
          stage?: string
          submitted_by_name: string
          submitted_by_user?: string | null
          updated_at?: string
        }
        Update: {
          additions?: string | null
          afm_approved_at?: string | null
          afm_approved_by?: string | null
          base_id?: string
          coordinated_at?: string
          creation_date?: string | null
          deletions?: string | null
          details?: string | null
          flip_title?: string
          id?: string
          notam?: string | null
          pdf_filename?: string | null
          pdf_storage_path?: string | null
          posted_date?: string | null
          posted_initials?: string | null
          processed_date?: string | null
          published_date?: string | null
          reference_doc_page?: string | null
          rejected?: boolean
          revisions_from?: string | null
          revisions_to?: string | null
          stage?: string
          submitted_by_name?: string
          submitted_by_user?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flip_changes_afm_approved_by_fkey"
            columns: ["afm_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_changes_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_changes_submitted_by_user_fkey"
            columns: ["submitted_by_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flip_list: {
        Row: {
          base_id: string
          created_at: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "flip_list_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      flip_references: {
        Row: {
          base_id: string
          file_type: string
          id: string
          storage_path: string
          title: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          base_id: string
          file_type: string
          id?: string
          storage_path: string
          title: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          base_id?: string
          file_type?: string
          id?: string
          storage_path?: string
          title?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flip_references_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_references_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flip_review_items: {
        Row: {
          base_id: string
          corrective_action: string | null
          date_corrected: string | null
          discrepancy: boolean
          discrepancy_note: string | null
          effective_date: string | null
          flip_title: string
          id: string
          review_id: string
          sort_order: number
        }
        Insert: {
          base_id: string
          corrective_action?: string | null
          date_corrected?: string | null
          discrepancy?: boolean
          discrepancy_note?: string | null
          effective_date?: string | null
          flip_title: string
          id?: string
          review_id: string
          sort_order?: number
        }
        Update: {
          base_id?: string
          corrective_action?: string | null
          date_corrected?: string | null
          discrepancy?: boolean
          discrepancy_note?: string | null
          effective_date?: string | null
          flip_title?: string
          id?: string
          review_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "flip_review_items_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_review_items_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "flip_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      flip_review_signoffs: {
        Row: {
          afm_signed_at: string | null
          afm_signed_by: string | null
          base_id: string
          custodian_signed_at: string | null
          custodian_signed_by: string | null
          id: string
          namo_signed_at: string | null
          namo_signed_by: string | null
          review_id: string
        }
        Insert: {
          afm_signed_at?: string | null
          afm_signed_by?: string | null
          base_id: string
          custodian_signed_at?: string | null
          custodian_signed_by?: string | null
          id?: string
          namo_signed_at?: string | null
          namo_signed_by?: string | null
          review_id: string
        }
        Update: {
          afm_signed_at?: string | null
          afm_signed_by?: string | null
          base_id?: string
          custodian_signed_at?: string | null
          custodian_signed_by?: string | null
          id?: string
          namo_signed_at?: string | null
          namo_signed_by?: string | null
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flip_review_signoffs_afm_signed_by_fkey"
            columns: ["afm_signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_review_signoffs_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_review_signoffs_custodian_signed_by_fkey"
            columns: ["custodian_signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_review_signoffs_namo_signed_by_fkey"
            columns: ["namo_signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_review_signoffs_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "flip_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      flip_reviews: {
        Row: {
          base_id: string
          created_at: string
          created_by: string | null
          cycle: string
          id: string
          review_date: string
        }
        Insert: {
          base_id: string
          created_at?: string
          created_by?: string | null
          cycle: string
          id?: string
          review_date: string
        }
        Update: {
          base_id?: string
          created_at?: string
          created_by?: string | null
          cycle?: string
          id?: string
          review_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "flip_reviews_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_reviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flip_role_assignments: {
        Row: {
          base_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flip_role_assignments_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flip_text_sections: {
        Row: {
          base_id: string
          content: string
          id: string
          section_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_id: string
          content?: string
          id?: string
          section_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_id?: string
          content?: string
          id?: string
          section_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flip_text_sections_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flip_text_sections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fpr_check_results: {
        Row: {
          check_id: string
          created_at: string
          id: string
          item_id: string | null
          item_label: string
          notes: string | null
          sort_order: number
          status: string
        }
        Insert: {
          check_id: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_label: string
          notes?: string | null
          sort_order?: number
          status: string
        }
        Update: {
          check_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_label?: string
          notes?: string | null
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpr_check_results_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "fpr_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpr_check_results_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "fpr_checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      fpr_checklist_items: {
        Row: {
          base_id: string
          created_at: string
          guidance: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_id: string
          created_at?: string
          guidance?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_id?: string
          created_at?: string
          guidance?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpr_checklist_items_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      fpr_checks: {
        Row: {
          base_id: string
          check_date: string
          completed_at: string | null
          completed_by: string | null
          completed_by_oi: string | null
          created_at: string
          id: string
          notes: string | null
          shift: string
          started_at: string
        }
        Insert: {
          base_id: string
          check_date: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_oi?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          shift: string
          started_at?: string
        }
        Update: {
          base_id?: string
          check_date?: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_oi?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          shift?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpr_checks_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpr_checks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      infrastructure_features: {
        Row: {
          bar_group_id: string | null
          base_id: string
          block: string | null
          created_at: string
          created_by: string | null
          feature_type: string
          id: string
          label: string | null
          latitude: number
          layer: string | null
          longitude: number
          notes: string | null
          rotation: number
          source: string
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          system_component_id: string | null
          updated_at: string
        }
        Insert: {
          bar_group_id?: string | null
          base_id: string
          block?: string | null
          created_at?: string
          created_by?: string | null
          feature_type: string
          id?: string
          label?: string | null
          latitude: number
          layer?: string | null
          longitude: number
          notes?: string | null
          rotation?: number
          source?: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          system_component_id?: string | null
          updated_at?: string
        }
        Update: {
          bar_group_id?: string | null
          base_id?: string
          block?: string | null
          created_at?: string
          created_by?: string | null
          feature_type?: string
          id?: string
          label?: string | null
          latitude?: number
          layer?: string | null
          longitude?: number
          notes?: string | null
          rotation?: number
          source?: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          system_component_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_infrastructure_features_component"
            columns: ["system_component_id"]
            isOneToOne: false
            referencedRelation: "lighting_system_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infrastructure_features_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infrastructure_features_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infrastructure_features_status_changed_by_fkey"
            columns: ["status_changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_item_system_links: {
        Row: {
          component_id: string | null
          created_at: string
          id: string
          item_id: string
          system_id: string
        }
        Insert: {
          component_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          system_id: string
        }
        Update: {
          component_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_item_system_links_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "lighting_system_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_item_system_links_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "base_inspection_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_item_system_links_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "lighting_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          base_id: string | null
          bwc_value: string | null
          completed_at: string | null
          completed_by_id: string | null
          completed_by_name: string | null
          completion_percent: number
          construction_meeting: boolean
          created_at: string
          daily_group_id: string | null
          display_id: string
          draft_data: Json | null
          failed_count: number
          filed_at: string | null
          filed_by_id: string | null
          filed_by_name: string | null
          id: string
          inspection_date: string
          inspection_type: string
          inspector_id: string | null
          inspector_name: string | null
          items: Json
          joint_monthly: boolean
          na_count: number
          notes: string | null
          passed_count: number
          personnel: string[]
          rcr_condition: string | null
          rcr_value: string | null
          rsc_condition: string | null
          saved_at: string | null
          saved_by_id: string | null
          saved_by_name: string | null
          started_at: string | null
          status: string
          temperature_f: number | null
          total_items: number
          updated_at: string
          weather_conditions: string | null
        }
        Insert: {
          base_id?: string | null
          bwc_value?: string | null
          completed_at?: string | null
          completed_by_id?: string | null
          completed_by_name?: string | null
          completion_percent?: number
          construction_meeting?: boolean
          created_at?: string
          daily_group_id?: string | null
          display_id: string
          draft_data?: Json | null
          failed_count?: number
          filed_at?: string | null
          filed_by_id?: string | null
          filed_by_name?: string | null
          id?: string
          inspection_date?: string
          inspection_type: string
          inspector_id?: string | null
          inspector_name?: string | null
          items?: Json
          joint_monthly?: boolean
          na_count?: number
          notes?: string | null
          passed_count?: number
          personnel?: string[]
          rcr_condition?: string | null
          rcr_value?: string | null
          rsc_condition?: string | null
          saved_at?: string | null
          saved_by_id?: string | null
          saved_by_name?: string | null
          started_at?: string | null
          status?: string
          temperature_f?: number | null
          total_items?: number
          updated_at?: string
          weather_conditions?: string | null
        }
        Update: {
          base_id?: string | null
          bwc_value?: string | null
          completed_at?: string | null
          completed_by_id?: string | null
          completed_by_name?: string | null
          completion_percent?: number
          construction_meeting?: boolean
          created_at?: string
          daily_group_id?: string | null
          display_id?: string
          draft_data?: Json | null
          failed_count?: number
          filed_at?: string | null
          filed_by_id?: string | null
          filed_by_name?: string | null
          id?: string
          inspection_date?: string
          inspection_type?: string
          inspector_id?: string | null
          inspector_name?: string | null
          items?: Json
          joint_monthly?: boolean
          na_count?: number
          notes?: string | null
          passed_count?: number
          personnel?: string[]
          rcr_condition?: string | null
          rcr_value?: string | null
          rsc_condition?: string | null
          saved_at?: string | null
          saved_by_id?: string | null
          saved_by_name?: string | null
          started_at?: string | null
          status?: string
          temperature_f?: number | null
          total_items?: number
          updated_at?: string
          weather_conditions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_completed_by_id_fkey"
            columns: ["completed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_filed_by_id_fkey"
            columns: ["filed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lighting_system_components: {
        Row: {
          allowable_no_adjacent: boolean | null
          allowable_outage_consecutive: number | null
          allowable_outage_count: number | null
          allowable_outage_pct: number | null
          allowable_outage_text: string | null
          component_type: string
          created_at: string
          id: string
          is_zero_tolerance: boolean | null
          label: string
          notam_text_template: string | null
          q_code: string | null
          requires_ce_notification: boolean | null
          requires_notam: boolean | null
          requires_obstruction_notam_attrs: boolean | null
          requires_system_shutoff: boolean | null
          requires_terps_notification: boolean | null
          sort_order: number | null
          system_id: string
          total_count: number
        }
        Insert: {
          allowable_no_adjacent?: boolean | null
          allowable_outage_consecutive?: number | null
          allowable_outage_count?: number | null
          allowable_outage_pct?: number | null
          allowable_outage_text?: string | null
          component_type: string
          created_at?: string
          id?: string
          is_zero_tolerance?: boolean | null
          label: string
          notam_text_template?: string | null
          q_code?: string | null
          requires_ce_notification?: boolean | null
          requires_notam?: boolean | null
          requires_obstruction_notam_attrs?: boolean | null
          requires_system_shutoff?: boolean | null
          requires_terps_notification?: boolean | null
          sort_order?: number | null
          system_id: string
          total_count?: number
        }
        Update: {
          allowable_no_adjacent?: boolean | null
          allowable_outage_consecutive?: number | null
          allowable_outage_count?: number | null
          allowable_outage_pct?: number | null
          allowable_outage_text?: string | null
          component_type?: string
          created_at?: string
          id?: string
          is_zero_tolerance?: boolean | null
          label?: string
          notam_text_template?: string | null
          q_code?: string | null
          requires_ce_notification?: boolean | null
          requires_notam?: boolean | null
          requires_obstruction_notam_attrs?: boolean | null
          requires_system_shutoff?: boolean | null
          requires_terps_notification?: boolean | null
          sort_order?: number | null
          system_id?: string
          total_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "lighting_system_components_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "lighting_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      lighting_systems: {
        Row: {
          base_id: string
          created_at: string
          id: string
          is_precision: boolean | null
          name: string
          notes: string | null
          runway_or_taxiway: string | null
          sort_order: number
          system_type: string
          updated_at: string
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          is_precision?: boolean | null
          name: string
          notes?: string | null
          runway_or_taxiway?: string | null
          sort_order?: number
          system_type: string
          updated_at?: string
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          is_precision?: boolean | null
          name?: string
          notes?: string | null
          runway_or_taxiway?: string | null
          sort_order?: number
          system_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lighting_systems_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      local_regulation_reviews: {
        Row: {
          base_id: string
          created_at: string
          id: string
          initials_snapshot: string | null
          regulation_id: string
          reviewed_at: string
          user_id: string
          version_at_review: number
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          initials_snapshot?: string | null
          regulation_id: string
          reviewed_at?: string
          user_id: string
          version_at_review: number
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          initials_snapshot?: string | null
          regulation_id?: string
          reviewed_at?: string
          user_id?: string
          version_at_review?: number
        }
        Relationships: [
          {
            foreignKeyName: "local_regulation_reviews_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_regulation_reviews_regulation_id_fkey"
            columns: ["regulation_id"]
            isOneToOne: false
            referencedRelation: "local_regulations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_regulation_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      local_regulations: {
        Row: {
          base_id: string
          created_at: string
          created_by: string | null
          description: string | null
          file_name: string
          file_size_bytes: number | null
          id: string
          is_archived: boolean
          mime_type: string | null
          review_interval: string
          storage_path: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          base_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name: string
          file_size_bytes?: number | null
          id?: string
          is_archived?: boolean
          mime_type?: string | null
          review_interval?: string
          storage_path: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          base_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          is_archived?: boolean
          mime_type?: string | null
          review_interval?: string
          storage_path?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "local_regulations_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_regulations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_leads: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          organization_type: string
          role: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          organization_type: string
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          organization_type?: string
          role?: string | null
        }
        Relationships: []
      }
      mods_exemption_attachments: {
        Row: {
          base_id: string
          caption: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          kind: string
          mime_type: string | null
          record_id: string
          uploaded_by: string | null
        }
        Insert: {
          base_id: string
          caption?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          record_id: string
          uploaded_by?: string | null
        }
        Update: {
          base_id?: string
          caption?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          record_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mods_exemption_attachments_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mods_exemption_attachments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "mods_exemptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mods_exemption_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mods_exemption_reviews: {
        Row: {
          base_id: string
          created_at: string
          id: string
          justification_still_valid: boolean
          notes: string | null
          recommendation: string | null
          record_id: string
          review_date: string
          reviewed_by: string | null
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          justification_still_valid: boolean
          notes?: string | null
          recommendation?: string | null
          record_id: string
          review_date: string
          reviewed_by?: string | null
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          justification_still_valid?: boolean
          notes?: string | null
          recommendation?: string | null
          record_id?: string
          review_date?: string
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mods_exemption_reviews_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mods_exemption_reviews_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "mods_exemptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mods_exemption_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mods_exemptions: {
        Row: {
          agis_tracking: string | null
          approval_authority: string | null
          arff_small_airport: boolean
          base_id: string
          baseline_summary: string | null
          created_at: string
          created_by: string | null
          date_decided: string | null
          date_submitted: string | null
          decision_conditions: string | null
          decision_summary: string | null
          deviation_date: string | null
          docket_number: string | null
          effective_date: string | null
          expiration_date: string | null
          id: string
          justification: string | null
          last_reviewed_date: string | null
          mos_category: string | null
          mos_subcategory: string | null
          next_review_due: string | null
          notes: string | null
          notified_date: string | null
          public_interest: string | null
          record_type: string
          relief_summary: string | null
          safety_justification: string | null
          standard_reference: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
          written_notice_provided: boolean
          written_notice_requested: boolean
        }
        Insert: {
          agis_tracking?: string | null
          approval_authority?: string | null
          arff_small_airport?: boolean
          base_id: string
          baseline_summary?: string | null
          created_at?: string
          created_by?: string | null
          date_decided?: string | null
          date_submitted?: string | null
          decision_conditions?: string | null
          decision_summary?: string | null
          deviation_date?: string | null
          docket_number?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          justification?: string | null
          last_reviewed_date?: string | null
          mos_category?: string | null
          mos_subcategory?: string | null
          next_review_due?: string | null
          notes?: string | null
          notified_date?: string | null
          public_interest?: string | null
          record_type: string
          relief_summary?: string | null
          safety_justification?: string | null
          standard_reference: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          written_notice_provided?: boolean
          written_notice_requested?: boolean
        }
        Update: {
          agis_tracking?: string | null
          approval_authority?: string | null
          arff_small_airport?: boolean
          base_id?: string
          baseline_summary?: string | null
          created_at?: string
          created_by?: string | null
          date_decided?: string | null
          date_submitted?: string | null
          decision_conditions?: string | null
          decision_summary?: string | null
          deviation_date?: string | null
          docket_number?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          justification?: string | null
          last_reviewed_date?: string | null
          mos_category?: string | null
          mos_subcategory?: string | null
          next_review_due?: string | null
          notes?: string | null
          notified_date?: string | null
          public_interest?: string | null
          record_type?: string
          relief_summary?: string | null
          safety_justification?: string | null
          standard_reference?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          written_notice_provided?: boolean
          written_notice_requested?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mods_exemptions_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mods_exemptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mods_exemptions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      navaid_statuses: {
        Row: {
          base_id: string | null
          id: string
          navaid_name: string
          notes: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_id?: string | null
          id?: string
          navaid_name: string
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_id?: string | null
          id?: string
          navaid_name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "navaid_statuses_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "navaid_statuses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notams: {
        Row: {
          base_id: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          effective_end: string | null
          effective_start: string
          full_text: string
          id: string
          linked_discrepancy_id: string | null
          notam_number: string
          notam_type: string | null
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          base_id?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_end?: string | null
          effective_start: string
          full_text: string
          id?: string
          linked_discrepancy_id?: string | null
          notam_number: string
          notam_type?: string | null
          source: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          base_id?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_end?: string | null
          effective_start?: string
          full_text?: string
          id?: string
          linked_discrepancy_id?: string | null
          notam_number?: string
          notam_type?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_notams_discrepancy"
            columns: ["linked_discrepancy_id"]
            isOneToOne: false
            referencedRelation: "discrepancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notams_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notams_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      obstruction_evaluations: {
        Row: {
          base_id: string | null
          controlling_surface: string | null
          created_at: string
          description: string | null
          display_id: string | null
          distance_from_centerline_ft: number | null
          evaluated_by: string | null
          has_violation: boolean
          id: string
          latitude: number | null
          linked_discrepancy_id: string | null
          longitude: number | null
          notes: string | null
          object_distance_ft: number | null
          object_elevation_msl: number | null
          object_height_agl: number
          obstruction_top_msl: number | null
          photo_storage_path: string | null
          results: Json
          runway_class: string | null
          surface_set: string | null
          violated_surfaces: string[] | null
        }
        Insert: {
          base_id?: string | null
          controlling_surface?: string | null
          created_at?: string
          description?: string | null
          display_id?: string | null
          distance_from_centerline_ft?: number | null
          evaluated_by?: string | null
          has_violation?: boolean
          id?: string
          latitude?: number | null
          linked_discrepancy_id?: string | null
          longitude?: number | null
          notes?: string | null
          object_distance_ft?: number | null
          object_elevation_msl?: number | null
          object_height_agl: number
          obstruction_top_msl?: number | null
          photo_storage_path?: string | null
          results?: Json
          runway_class?: string | null
          surface_set?: string | null
          violated_surfaces?: string[] | null
        }
        Update: {
          base_id?: string | null
          controlling_surface?: string | null
          created_at?: string
          description?: string | null
          display_id?: string | null
          distance_from_centerline_ft?: number | null
          evaluated_by?: string | null
          has_violation?: boolean
          id?: string
          latitude?: number | null
          linked_discrepancy_id?: string | null
          longitude?: number | null
          notes?: string | null
          object_distance_ft?: number | null
          object_elevation_msl?: number | null
          object_height_agl?: number
          obstruction_top_msl?: number | null
          photo_storage_path?: string | null
          results?: Json
          runway_class?: string | null
          surface_set?: string | null
          violated_surfaces?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "obstruction_evaluations_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obstruction_evaluations_evaluated_by_fkey"
            columns: ["evaluated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obstruction_evaluations_linked_discrepancy_id_fkey"
            columns: ["linked_discrepancy_id"]
            isOneToOne: false
            referencedRelation: "discrepancies"
            referencedColumns: ["id"]
          },
        ]
      }
      outage_events: {
        Row: {
          base_id: string
          created_at: string
          discrepancy_id: string | null
          event_type: string
          feature_id: string
          id: string
          notes: string | null
          reported_by: string | null
          system_component_id: string | null
        }
        Insert: {
          base_id: string
          created_at?: string
          discrepancy_id?: string | null
          event_type: string
          feature_id: string
          id?: string
          notes?: string | null
          reported_by?: string | null
          system_component_id?: string | null
        }
        Update: {
          base_id?: string
          created_at?: string
          discrepancy_id?: string | null
          event_type?: string
          feature_id?: string
          id?: string
          notes?: string | null
          reported_by?: string | null
          system_component_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outage_events_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outage_events_discrepancy_id_fkey"
            columns: ["discrepancy_id"]
            isOneToOne: false
            referencedRelation: "discrepancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outage_events_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "infrastructure_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outage_events_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outage_events_system_component_id_fkey"
            columns: ["system_component_id"]
            isOneToOne: false
            referencedRelation: "lighting_system_components"
            referencedColumns: ["id"]
          },
        ]
      }
      outage_rule_templates: {
        Row: {
          allowable_no_adjacent: boolean | null
          allowable_outage_consecutive: number | null
          allowable_outage_count: number | null
          allowable_outage_pct: number | null
          allowable_outage_text: string | null
          component_type: string
          dafman_notes: string | null
          id: string
          is_zero_tolerance: boolean | null
          label: string
          notam_text_template: string | null
          q_code: string | null
          requires_ce_notification: boolean | null
          requires_notam: boolean | null
          requires_obstruction_notam_attrs: boolean | null
          requires_system_shutoff: boolean | null
          requires_terps_notification: boolean | null
          sort_order: number | null
          standard: string
          system_type: string
        }
        Insert: {
          allowable_no_adjacent?: boolean | null
          allowable_outage_consecutive?: number | null
          allowable_outage_count?: number | null
          allowable_outage_pct?: number | null
          allowable_outage_text?: string | null
          component_type: string
          dafman_notes?: string | null
          id?: string
          is_zero_tolerance?: boolean | null
          label: string
          notam_text_template?: string | null
          q_code?: string | null
          requires_ce_notification?: boolean | null
          requires_notam?: boolean | null
          requires_obstruction_notam_attrs?: boolean | null
          requires_system_shutoff?: boolean | null
          requires_terps_notification?: boolean | null
          sort_order?: number | null
          standard?: string
          system_type: string
        }
        Update: {
          allowable_no_adjacent?: boolean | null
          allowable_outage_consecutive?: number | null
          allowable_outage_count?: number | null
          allowable_outage_pct?: number | null
          allowable_outage_text?: string | null
          component_type?: string
          dafman_notes?: string | null
          id?: string
          is_zero_tolerance?: boolean | null
          label?: string
          notam_text_template?: string | null
          q_code?: string | null
          requires_ce_notification?: boolean | null
          requires_notam?: boolean | null
          requires_obstruction_notam_attrs?: boolean | null
          requires_system_shutoff?: boolean | null
          requires_terps_notification?: boolean | null
          sort_order?: number | null
          standard?: string
          system_type?: string
        }
        Relationships: []
      }
      page_view_daily: {
        Row: {
          base_id: string
          count: number
          id: string
          last_viewed_at: string
          route: string
          user_id: string
          view_date: string
        }
        Insert: {
          base_id: string
          count?: number
          id?: string
          last_viewed_at?: string
          route: string
          user_id: string
          view_date?: string
        }
        Update: {
          base_id?: string
          count?: number
          id?: string
          last_viewed_at?: string
          route?: string
          user_id?: string
          view_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_view_daily_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_view_daily_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parking_apron_boundaries: {
        Row: {
          base_id: string
          created_at: string | null
          created_by: string | null
          id: string
          name: string | null
          notes: string | null
          plan_id: string
          polygon_coords: Json
          updated_at: string | null
        }
        Insert: {
          base_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          plan_id: string
          polygon_coords?: Json
          updated_at?: string | null
        }
        Update: {
          base_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          plan_id?: string
          polygon_coords?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parking_apron_boundaries_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_apron_boundaries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_apron_boundaries_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "parking_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      parking_obstacles: {
        Row: {
          base_id: string | null
          created_at: string | null
          created_by: string | null
          height_ft: number | null
          id: string
          latitude: number
          length_ft: number | null
          line_coords: Json | null
          longitude: number
          name: string | null
          notes: string | null
          obstacle_type: string | null
          radius_ft: number | null
          rotation_deg: number | null
          updated_at: string | null
          width_ft: number | null
        }
        Insert: {
          base_id?: string | null
          created_at?: string | null
          created_by?: string | null
          height_ft?: number | null
          id?: string
          latitude: number
          length_ft?: number | null
          line_coords?: Json | null
          longitude: number
          name?: string | null
          notes?: string | null
          obstacle_type?: string | null
          radius_ft?: number | null
          rotation_deg?: number | null
          updated_at?: string | null
          width_ft?: number | null
        }
        Update: {
          base_id?: string | null
          created_at?: string | null
          created_by?: string | null
          height_ft?: number | null
          id?: string
          latitude?: number
          length_ft?: number | null
          line_coords?: Json | null
          longitude?: number
          name?: string | null
          notes?: string | null
          obstacle_type?: string | null
          radius_ft?: number | null
          rotation_deg?: number | null
          updated_at?: string | null
          width_ft?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parking_obstacles_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_obstacles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parking_plans: {
        Row: {
          base_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_template: boolean
          plan_name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          base_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean
          plan_name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          base_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean
          plan_name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parking_plans_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_plans_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parking_spots: {
        Row: {
          aircraft_name: string | null
          base_id: string | null
          clearance_ft: number | null
          created_at: string | null
          heading_deg: number | null
          id: string
          latitude: number
          longitude: number
          notes: string | null
          plan_id: string | null
          sort_order: number | null
          spot_name: string | null
          spot_type: string | null
          status: string | null
          tail_number: string | null
          unit_callsign: string | null
          updated_at: string | null
        }
        Insert: {
          aircraft_name?: string | null
          base_id?: string | null
          clearance_ft?: number | null
          created_at?: string | null
          heading_deg?: number | null
          id?: string
          latitude: number
          longitude: number
          notes?: string | null
          plan_id?: string | null
          sort_order?: number | null
          spot_name?: string | null
          spot_type?: string | null
          status?: string | null
          tail_number?: string | null
          unit_callsign?: string | null
          updated_at?: string | null
        }
        Update: {
          aircraft_name?: string | null
          base_id?: string | null
          clearance_ft?: number | null
          created_at?: string | null
          heading_deg?: number | null
          id?: string
          latitude?: number
          longitude?: number
          notes?: string | null
          plan_id?: string | null
          sort_order?: number | null
          spot_name?: string | null
          spot_type?: string | null
          status?: string | null
          tail_number?: string | null
          unit_callsign?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parking_spots_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_spots_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "parking_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      parking_taxilanes: {
        Row: {
          base_id: string
          created_at: string | null
          created_by: string | null
          design_aircraft: string | null
          design_wingspan_ft: number | null
          id: string
          is_transient: boolean | null
          line_coords: Json
          name: string | null
          notes: string | null
          plan_id: string
          taxilane_type: string
          updated_at: string | null
        }
        Insert: {
          base_id: string
          created_at?: string | null
          created_by?: string | null
          design_aircraft?: string | null
          design_wingspan_ft?: number | null
          id?: string
          is_transient?: boolean | null
          line_coords?: Json
          name?: string | null
          notes?: string | null
          plan_id: string
          taxilane_type?: string
          updated_at?: string | null
        }
        Update: {
          base_id?: string
          created_at?: string | null
          created_by?: string | null
          design_aircraft?: string | null
          design_wingspan_ft?: number | null
          id?: string
          is_transient?: boolean | null
          line_coords?: Json
          name?: string | null
          notes?: string | null
          plan_id?: string
          taxilane_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parking_taxilanes_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_taxilanes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_taxilanes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "parking_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_extraction_status: {
        Row: {
          created_at: string
          error_message: string | null
          extracted_at: string | null
          file_name: string
          file_size: number | null
          status: string
          total_pages: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          extracted_at?: string | null
          file_name: string
          file_size?: number | null
          status?: string
          total_pages?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          extracted_at?: string | null
          file_name?: string
          file_size?: number | null
          status?: string
          total_pages?: number | null
        }
        Relationships: []
      }
      pdf_text_pages: {
        Row: {
          extracted_at: string
          file_name: string
          id: number
          page_number: number
          text_content: string
          tsv: unknown
        }
        Insert: {
          extracted_at?: string
          file_name: string
          id?: never
          page_number: number
          text_content?: string
          tsv?: unknown
        }
        Update: {
          extracted_at?: string
          file_name?: string
          id?: never
          page_number?: number
          text_content?: string
          tsv?: unknown
        }
        Relationships: []
      }
      permissions: {
        Row: {
          applies_to: string[]
          category: string
          description: string | null
          key: string
          label: string
        }
        Insert: {
          applies_to?: string[]
          category: string
          description?: string | null
          key: string
          label: string
        }
        Update: {
          applies_to?: string[]
          category?: string
          description?: string | null
          key?: string
          label?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          acsi_inspection_id: string | null
          acsi_item_id: string | null
          base_id: string | null
          captured_at: string
          check_id: string | null
          created_at: string
          discrepancy_id: string | null
          file_name: string
          file_size: number | null
          id: string
          inspection_id: string | null
          inspection_item_id: string | null
          issue_index: number | null
          latitude: number | null
          longitude: number | null
          mime_type: string
          storage_path: string
          thumbnail_path: string | null
          uploaded_by: string | null
          wildlife_sighting_id: string | null
          wildlife_strike_id: string | null
        }
        Insert: {
          acsi_inspection_id?: string | null
          acsi_item_id?: string | null
          base_id?: string | null
          captured_at?: string
          check_id?: string | null
          created_at?: string
          discrepancy_id?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          inspection_id?: string | null
          inspection_item_id?: string | null
          issue_index?: number | null
          latitude?: number | null
          longitude?: number | null
          mime_type?: string
          storage_path: string
          thumbnail_path?: string | null
          uploaded_by?: string | null
          wildlife_sighting_id?: string | null
          wildlife_strike_id?: string | null
        }
        Update: {
          acsi_inspection_id?: string | null
          acsi_item_id?: string | null
          base_id?: string | null
          captured_at?: string
          check_id?: string | null
          created_at?: string
          discrepancy_id?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          inspection_id?: string | null
          inspection_item_id?: string | null
          issue_index?: number | null
          latitude?: number | null
          longitude?: number | null
          mime_type?: string
          storage_path?: string
          thumbnail_path?: string | null
          uploaded_by?: string | null
          wildlife_sighting_id?: string | null
          wildlife_strike_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_acsi_inspection_id_fkey"
            columns: ["acsi_inspection_id"]
            isOneToOne: false
            referencedRelation: "acsi_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "airfield_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_discrepancy_id_fkey"
            columns: ["discrepancy_id"]
            isOneToOne: false
            referencedRelation: "discrepancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_wildlife_sighting_id_fkey"
            columns: ["wildlife_sighting_id"]
            isOneToOne: false
            referencedRelation: "wildlife_sightings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_wildlife_strike_id_fkey"
            columns: ["wildlife_strike_id"]
            isOneToOne: false
            referencedRelation: "wildlife_strikes"
            referencedColumns: ["id"]
          },
        ]
      }
      ppr_agencies: {
        Row: {
          agency_name: string
          base_id: string
          created_at: string
          id: string
          is_active: boolean
          notify_only: boolean
          send_calendar_invite: boolean
          sort_order: number
        }
        Insert: {
          agency_name: string
          base_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          notify_only?: boolean
          send_calendar_invite?: boolean
          sort_order?: number
        }
        Update: {
          agency_name?: string
          base_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notify_only?: boolean
          send_calendar_invite?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ppr_agencies_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      ppr_agency_emails: {
        Row: {
          agency_id: string
          base_id: string
          created_at: string
          email: string
          id: string
        }
        Insert: {
          agency_id: string
          base_id: string
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          agency_id?: string
          base_id?: string
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppr_agency_emails_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "ppr_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppr_agency_emails_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      ppr_agency_members: {
        Row: {
          agency_id: string
          base_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          agency_id: string
          base_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          base_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppr_agency_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "ppr_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppr_agency_members_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppr_agency_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ppr_columns: {
        Row: {
          base_id: string
          column_name: string
          column_type: string
          created_at: string
          id: string
          info_text: string | null
          is_required: boolean
          show_on_form: boolean
          show_on_log: boolean
          show_on_status: boolean
          sort_order: number
          time_display: string | null
        }
        Insert: {
          base_id: string
          column_name: string
          column_type?: string
          created_at?: string
          id?: string
          info_text?: string | null
          is_required?: boolean
          show_on_form?: boolean
          show_on_log?: boolean
          show_on_status?: boolean
          sort_order?: number
          time_display?: string | null
        }
        Update: {
          base_id?: string
          column_name?: string
          column_type?: string
          created_at?: string
          id?: string
          info_text?: string | null
          is_required?: boolean
          show_on_form?: boolean
          show_on_log?: boolean
          show_on_status?: boolean
          sort_order?: number
          time_display?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ppr_columns_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      ppr_coordination: {
        Row: {
          agency_id: string | null
          agency_name: string
          comment: string | null
          coordinated_at: string | null
          coordinated_by: string | null
          created_at: string
          entry_id: string
          id: string
          status: string
        }
        Insert: {
          agency_id?: string | null
          agency_name: string
          comment?: string | null
          coordinated_at?: string | null
          coordinated_by?: string | null
          created_at?: string
          entry_id: string
          id?: string
          status?: string
        }
        Update: {
          agency_id?: string | null
          agency_name?: string
          comment?: string | null
          coordinated_at?: string | null
          coordinated_by?: string | null
          created_at?: string
          entry_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppr_coordination_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "ppr_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppr_coordination_coordinated_by_fkey"
            columns: ["coordinated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppr_coordination_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "ppr_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      ppr_entries: {
        Row: {
          approval_at: string | null
          approval_user_id: string | null
          approver_oi: string | null
          arrival_date: string
          base_id: string
          cancellation_reason: string | null
          column_values: Json
          created_at: string
          created_by: string | null
          denial_reason: string | null
          departed_at: string | null
          departed_by: string | null
          id: string
          notes: string | null
          ppr_number: string
          public_submission: boolean
          requester_email: string | null
          requester_name: string | null
          requester_phone: string | null
          status: string
          triaged_at: string | null
          triaged_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approval_at?: string | null
          approval_user_id?: string | null
          approver_oi?: string | null
          arrival_date: string
          base_id: string
          cancellation_reason?: string | null
          column_values?: Json
          created_at?: string
          created_by?: string | null
          denial_reason?: string | null
          departed_at?: string | null
          departed_by?: string | null
          id?: string
          notes?: string | null
          ppr_number: string
          public_submission?: boolean
          requester_email?: string | null
          requester_name?: string | null
          requester_phone?: string | null
          status?: string
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approval_at?: string | null
          approval_user_id?: string | null
          approver_oi?: string | null
          arrival_date?: string
          base_id?: string
          cancellation_reason?: string | null
          column_values?: Json
          created_at?: string
          created_by?: string | null
          denial_reason?: string | null
          departed_at?: string | null
          departed_by?: string | null
          id?: string
          notes?: string | null
          ppr_number?: string
          public_submission?: boolean
          requester_email?: string | null
          requester_name?: string | null
          requester_phone?: string | null
          status?: string
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ppr_entries_approval_user_id_fkey"
            columns: ["approval_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppr_entries_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppr_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppr_entries_departed_by_fkey"
            columns: ["departed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppr_entries_triaged_by_fkey"
            columns: ["triaged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppr_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ppr_number_sequence: {
        Row: {
          arrival_date: string
          base_id: string
          last_seq: number
          updated_at: string
        }
        Insert: {
          arrival_date: string
          base_id: string
          last_seq?: number
          updated_at?: string
        }
        Update: {
          arrival_date?: string
          base_id?: string
          last_seq?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppr_number_sequence_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      ppr_remarks: {
        Row: {
          base_id: string
          created_at: string
          created_by: string | null
          entry_id: string
          id: string
          remark: string
        }
        Insert: {
          base_id: string
          created_at?: string
          created_by?: string | null
          entry_id: string
          id?: string
          remark: string
        }
        Update: {
          base_id?: string
          created_at?: string
          created_by?: string | null
          entry_id?: string
          id?: string
          remark?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppr_remarks_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppr_remarks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppr_remarks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "ppr_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_pdf_email: string | null
          edipi: string | null
          email: string
          first_name: string | null
          has_completed_setup_tour: boolean
          id: string
          is_active: boolean
          last_name: string | null
          last_seen_at: string | null
          last_seen_release_version: string | null
          must_change_password: boolean
          name: string
          office_symbol: string | null
          operating_initials: string | null
          organization: string | null
          phone: string | null
          primary_base_id: string | null
          rank: string | null
          role: string
          shop: string | null
          sidebar_config: Json | null
          status: string
          tours_completed: Json
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_pdf_email?: string | null
          edipi?: string | null
          email: string
          first_name?: string | null
          has_completed_setup_tour?: boolean
          id: string
          is_active?: boolean
          last_name?: string | null
          last_seen_at?: string | null
          last_seen_release_version?: string | null
          must_change_password?: boolean
          name: string
          office_symbol?: string | null
          operating_initials?: string | null
          organization?: string | null
          phone?: string | null
          primary_base_id?: string | null
          rank?: string | null
          role?: string
          shop?: string | null
          sidebar_config?: Json | null
          status?: string
          tours_completed?: Json
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_pdf_email?: string | null
          edipi?: string | null
          email?: string
          first_name?: string | null
          has_completed_setup_tour?: boolean
          id?: string
          is_active?: boolean
          last_name?: string | null
          last_seen_at?: string | null
          last_seen_release_version?: string | null
          must_change_password?: boolean
          name?: string
          office_symbol?: string | null
          operating_initials?: string | null
          organization?: string | null
          phone?: string | null
          primary_base_id?: string | null
          rank?: string | null
          role?: string
          shop?: string | null
          sidebar_config?: Json | null
          status?: string
          tours_completed?: Json
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_base_id_fkey"
            columns: ["primary_base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      qrc_executions: {
        Row: {
          base_id: string
          close_initials: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          label: string | null
          open_initials: string | null
          opened_at: string
          opened_by: string | null
          qrc_number: number
          remarks: string | null
          scn_data: Json | null
          status: string
          step_responses: Json
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          base_id: string
          close_initials?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          label?: string | null
          open_initials?: string | null
          opened_at?: string
          opened_by?: string | null
          qrc_number: number
          remarks?: string | null
          scn_data?: Json | null
          status?: string
          step_responses?: Json
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          base_id?: string
          close_initials?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          label?: string | null
          open_initials?: string | null
          opened_at?: string
          opened_by?: string | null
          qrc_number?: number
          remarks?: string | null
          scn_data?: Json | null
          status?: string
          step_responses?: Json
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qrc_executions_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qrc_executions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qrc_executions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qrc_executions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "qrc_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      qrc_monthly_reviews: {
        Row: {
          base_id: string
          created_at: string
          id: string
          notes: string | null
          reviewed_at: string
          template_id: string
          template_updated_at_at_review: string | null
          user_id: string
        }
        Insert: {
          base_id: string
          created_at?: string
          id?: string
          notes?: string | null
          reviewed_at?: string
          template_id: string
          template_updated_at_at_review?: string | null
          user_id: string
        }
        Update: {
          base_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          reviewed_at?: string
          template_id?: string
          template_updated_at_at_review?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qrc_monthly_reviews_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qrc_monthly_reviews_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "qrc_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qrc_monthly_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qrc_templates: {
        Row: {
          base_id: string
          created_at: string
          has_scn_form: boolean
          id: string
          is_active: boolean
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          notes: string | null
          qrc_number: number
          references: string | null
          review_notes: string | null
          scn_fields: Json | null
          sort_order: number
          steps: Json
          title: string
          updated_at: string
        }
        Insert: {
          base_id: string
          created_at?: string
          has_scn_form?: boolean
          id?: string
          is_active?: boolean
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          notes?: string | null
          qrc_number: number
          references?: string | null
          review_notes?: string | null
          scn_fields?: Json | null
          sort_order?: number
          steps?: Json
          title: string
          updated_at?: string
        }
        Update: {
          base_id?: string
          created_at?: string
          has_scn_form?: boolean
          id?: string
          is_active?: boolean
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          notes?: string | null
          qrc_number?: number
          references?: string | null
          review_notes?: string | null
          scn_fields?: Json | null
          sort_order?: number
          steps?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qrc_templates_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_hits: {
        Row: {
          bucket: string
          hit_at: string
          id: number
        }
        Insert: {
          bucket: string
          hit_at?: string
          id?: never
        }
        Update: {
          bucket?: string
          hit_at?: string
          id?: never
        }
        Relationships: []
      }
      read_file_acknowledgments: {
        Row: {
          acknowledged_at: string
          acknowledged_version: number
          base_id: string
          id: string
          initials_snapshot: string | null
          read_file_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          acknowledged_version: number
          base_id: string
          id?: string
          initials_snapshot?: string | null
          read_file_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          acknowledged_version?: number
          base_id?: string
          id?: string
          initials_snapshot?: string | null
          read_file_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "read_file_acknowledgments_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "read_file_acknowledgments_read_file_id_fkey"
            columns: ["read_file_id"]
            isOneToOne: false
            referencedRelation: "read_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "read_file_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      read_files: {
        Row: {
          base_id: string
          created_at: string
          created_by: string | null
          description: string | null
          file_name: string
          file_size_bytes: number | null
          id: string
          is_archived: boolean
          mime_type: string | null
          storage_path: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          base_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name: string
          file_size_bytes?: number | null
          id?: string
          is_archived?: boolean
          mime_type?: string | null
          storage_path: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          base_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          is_archived?: boolean
          mime_type?: string | null
          storage_path?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "read_files_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "read_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      regulations: {
        Row: {
          category: string
          created_at: string
          description: string
          file_size_bytes: number | null
          id: string
          is_core: boolean
          is_cross_ref: boolean
          is_scrubbed: boolean
          last_verified_at: string | null
          pub_type: string
          publication_date: string | null
          reg_id: string
          source: string
          source_section: string
          source_volume: string | null
          storage_path: string | null
          tags: string[]
          title: string
          url: string | null
          verified_date: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          file_size_bytes?: number | null
          id?: string
          is_core?: boolean
          is_cross_ref?: boolean
          is_scrubbed?: boolean
          last_verified_at?: string | null
          pub_type: string
          publication_date?: string | null
          reg_id: string
          source?: string
          source_section: string
          source_volume?: string | null
          storage_path?: string | null
          tags?: string[]
          title: string
          url?: string | null
          verified_date?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          file_size_bytes?: number | null
          id?: string
          is_core?: boolean
          is_cross_ref?: boolean
          is_scrubbed?: boolean
          last_verified_at?: string | null
          pub_type?: string
          publication_date?: string | null
          reg_id?: string
          source?: string
          source_section?: string
          source_volume?: string | null
          storage_path?: string | null
          tags?: string[]
          title?: string
          url?: string | null
          verified_date?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_key: string
          role: string
        }
        Insert: {
          permission_key: string
          role: string
        }
        Update: {
          permission_key?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      runway_status_log: {
        Row: {
          base_id: string | null
          changed_by: string | null
          created_at: string
          id: string
          new_active_runway: string | null
          new_advisory_text: string | null
          new_advisory_type: string | null
          new_runway_status: string | null
          old_active_runway: string | null
          old_advisory_text: string | null
          old_advisory_type: string | null
          old_runway_status: string | null
          reason: string | null
        }
        Insert: {
          base_id?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_active_runway?: string | null
          new_advisory_text?: string | null
          new_advisory_type?: string | null
          new_runway_status?: string | null
          old_active_runway?: string | null
          old_advisory_text?: string | null
          old_advisory_type?: string | null
          old_runway_status?: string | null
          reason?: string | null
        }
        Update: {
          base_id?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_active_runway?: string | null
          new_advisory_text?: string | null
          new_advisory_type?: string | null
          new_runway_status?: string | null
          old_active_runway?: string | null
          old_advisory_text?: string | null
          old_advisory_type?: string | null
          old_runway_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "runway_status_log_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runway_status_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scn_agencies: {
        Row: {
          agency_name: string
          base_id: string
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
        }
        Insert: {
          agency_name: string
          base_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          agency_name?: string
          base_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "scn_agencies_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      scn_check_results: {
        Row: {
          agency_id: string | null
          agency_name: string
          check_id: string
          created_at: string
          id: string
          notes: string | null
          sort_order: number
          status: string
        }
        Insert: {
          agency_id?: string | null
          agency_name: string
          check_id: string
          created_at?: string
          id?: string
          notes?: string | null
          sort_order?: number
          status: string
        }
        Update: {
          agency_id?: string | null
          agency_name?: string
          check_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scn_check_results_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "scn_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scn_check_results_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "scn_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      scn_checks: {
        Row: {
          base_id: string
          check_date: string
          check_type: string
          completed_at: string | null
          completed_by: string | null
          completed_by_oi: string | null
          created_at: string
          id: string
          notes: string | null
          started_at: string
        }
        Insert: {
          base_id: string
          check_date: string
          check_type: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_oi?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          started_at?: string
        }
        Update: {
          base_id?: string
          check_date?: string
          check_type?: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_oi?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scn_checks_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scn_checks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_checklist_items: {
        Row: {
          base_id: string
          created_at: string
          created_by: string | null
          frequency: string
          id: string
          is_active: boolean
          label: string
          shift: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_id: string
          created_at?: string
          created_by?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          label: string
          shift?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_id?: string
          created_at?: string
          created_by?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          label?: string
          shift?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_checklist_items_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_checklist_responses: {
        Row: {
          checklist_id: string
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          is_na: boolean
          item_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          checklist_id: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_na?: boolean
          item_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          checklist_id?: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_na?: boolean
          item_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_checklist_responses_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "shift_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_checklist_responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shift_checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_checklists: {
        Row: {
          base_id: string
          checklist_date: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          base_id: string
          checklist_date?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          base_id?: string
          checklist_date?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_checklists_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_audits: {
        Row: {
          audit_code: string
          audit_type: string
          base_id: string
          created_at: string
          created_by: string | null
          findings: Json
          findings_closed: number
          findings_open: number
          id: string
          notes: string | null
          performed_by: string | null
          performed_date: string | null
          report_url: string | null
          scheduled_date: string | null
          scope: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audit_code: string
          audit_type?: string
          base_id: string
          created_at?: string
          created_by?: string | null
          findings?: Json
          findings_closed?: number
          findings_open?: number
          id?: string
          notes?: string | null
          performed_by?: string | null
          performed_date?: string | null
          report_url?: string | null
          scheduled_date?: string | null
          scope?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audit_code?: string
          audit_type?: string
          base_id?: string
          created_at?: string
          created_by?: string | null
          findings?: Json
          findings_closed?: number
          findings_open?: number
          id?: string
          notes?: string | null
          performed_by?: string | null
          performed_date?: string | null
          report_url?: string | null
          scheduled_date?: string | null
          scope?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_audits_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_communications: {
        Row: {
          attachment_url: string | null
          audience: string | null
          base_id: string
          body: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          related_hazard_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attachment_url?: string | null
          audience?: string | null
          base_id: string
          body: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          related_hazard_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attachment_url?: string | null
          audience?: string | null
          base_id?: string
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          related_hazard_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_communications_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_communications_related_hazard_id_fkey"
            columns: ["related_hazard_id"]
            isOneToOne: false
            referencedRelation: "sms_hazards"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_hazards: {
        Row: {
          base_id: string
          closed_at: string | null
          closed_by: string | null
          closure_rationale: string | null
          created_at: string
          created_by: string | null
          current_band: string | null
          description: string | null
          hazard_code: string
          id: string
          identified_at: string
          identified_by: string | null
          latest_assessment_id: string | null
          residual_band: string | null
          risk_owner_user_id: string | null
          source_ref_id: string | null
          source_type: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_id: string
          closed_at?: string | null
          closed_by?: string | null
          closure_rationale?: string | null
          created_at?: string
          created_by?: string | null
          current_band?: string | null
          description?: string | null
          hazard_code: string
          id?: string
          identified_at?: string
          identified_by?: string | null
          latest_assessment_id?: string | null
          residual_band?: string | null
          risk_owner_user_id?: string | null
          source_ref_id?: string | null
          source_type?: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_id?: string
          closed_at?: string | null
          closed_by?: string | null
          closure_rationale?: string | null
          created_at?: string
          created_by?: string | null
          current_band?: string | null
          description?: string | null
          hazard_code?: string
          id?: string
          identified_at?: string
          identified_by?: string | null
          latest_assessment_id?: string | null
          residual_band?: string | null
          risk_owner_user_id?: string | null
          source_ref_id?: string | null
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_hazards_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_management_of_change: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          base_id: string
          change_category: string
          change_description: string
          created_at: string
          created_by: string | null
          effective_date: string | null
          id: string
          linked_hazard_id: string | null
          moc_code: string
          proposed_at: string
          proposed_by: string | null
          rejection_reason: string | null
          risk_analysis_summary: string | null
          status: string
          title: string
          triggered_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_id: string
          change_category?: string
          change_description: string
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          linked_hazard_id?: string | null
          moc_code: string
          proposed_at?: string
          proposed_by?: string | null
          rejection_reason?: string | null
          risk_analysis_summary?: string | null
          status?: string
          title: string
          triggered_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_id?: string
          change_category?: string
          change_description?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          linked_hazard_id?: string | null
          moc_code?: string
          proposed_at?: string
          proposed_by?: string | null
          rejection_reason?: string | null
          risk_analysis_summary?: string | null
          status?: string
          title?: string
          triggered_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_management_of_change_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_management_of_change_linked_hazard_id_fkey"
            columns: ["linked_hazard_id"]
            isOneToOne: false
            referencedRelation: "sms_hazards"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_mitigations: {
        Row: {
          base_id: string
          completed_at: string | null
          completed_by: string | null
          control_type: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          evidence_url: string | null
          hazard_id: string
          id: string
          notes: string | null
          owner_user_id: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_id: string
          completed_at?: string | null
          completed_by?: string | null
          control_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          evidence_url?: string | null
          hazard_id: string
          id?: string
          notes?: string | null
          owner_user_id?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_id?: string
          completed_at?: string | null
          completed_by?: string | null
          control_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          evidence_url?: string | null
          hazard_id?: string
          id?: string
          notes?: string | null
          owner_user_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_mitigations_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_mitigations_hazard_id_fkey"
            columns: ["hazard_id"]
            isOneToOne: false
            referencedRelation: "sms_hazards"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_policies: {
        Row: {
          accountable_executive_user_id: string | null
          base_id: string
          created_at: string
          created_by: string | null
          document_url: string | null
          effective_date: string | null
          employee_reporting_pledge: string | null
          id: string
          replaced_by_id: string | null
          review_due_date: string | null
          safety_objectives: Json
          signature_image_url: string | null
          signed_at: string | null
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          accountable_executive_user_id?: string | null
          base_id: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          effective_date?: string | null
          employee_reporting_pledge?: string | null
          id?: string
          replaced_by_id?: string | null
          review_due_date?: string | null
          safety_objectives?: Json
          signature_image_url?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          accountable_executive_user_id?: string | null
          base_id?: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          effective_date?: string | null
          employee_reporting_pledge?: string | null
          id?: string
          replaced_by_id?: string | null
          review_due_date?: string | null
          safety_objectives?: Json
          signature_image_url?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sms_policies_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_policies_replaced_by_id_fkey"
            columns: ["replaced_by_id"]
            isOneToOne: false
            referencedRelation: "sms_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_risk_assessments: {
        Row: {
          assessed_at: string
          assessed_by: string | null
          base_id: string
          created_at: string
          hazard_id: string
          id: string
          likelihood: number
          likelihood_rationale: string | null
          notes: string | null
          residual_likelihood: number | null
          residual_risk_band: string | null
          residual_risk_index: number | null
          residual_severity: number | null
          risk_band: string | null
          risk_index: number | null
          severity: number
          severity_rationale: string | null
          updated_at: string
        }
        Insert: {
          assessed_at?: string
          assessed_by?: string | null
          base_id: string
          created_at?: string
          hazard_id: string
          id?: string
          likelihood: number
          likelihood_rationale?: string | null
          notes?: string | null
          residual_likelihood?: number | null
          residual_risk_band?: string | null
          residual_risk_index?: number | null
          residual_severity?: number | null
          risk_band?: string | null
          risk_index?: number | null
          severity: number
          severity_rationale?: string | null
          updated_at?: string
        }
        Update: {
          assessed_at?: string
          assessed_by?: string | null
          base_id?: string
          created_at?: string
          hazard_id?: string
          id?: string
          likelihood?: number
          likelihood_rationale?: string | null
          notes?: string | null
          residual_likelihood?: number | null
          residual_risk_band?: string | null
          residual_risk_index?: number | null
          residual_severity?: number | null
          risk_band?: string | null
          risk_index?: number | null
          severity?: number
          severity_rationale?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_risk_assessments_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_risk_assessments_hazard_id_fkey"
            columns: ["hazard_id"]
            isOneToOne: false
            referencedRelation: "sms_hazards"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_safety_reports: {
        Row: {
          base_id: string
          category: string
          created_at: string
          description: string
          id: string
          immediate_action: string | null
          is_anonymous: boolean
          location_text: string | null
          occurred_at: string | null
          promoted_hazard_id: string | null
          report_code: string
          reporter_email: string | null
          reporter_name: string | null
          reporter_phone: string | null
          reporter_role: string | null
          source: string
          submitted_at: string
          triage_notes: string | null
          triage_status: string
          triaged_at: string | null
          triaged_by: string | null
          updated_at: string
        }
        Insert: {
          base_id: string
          category?: string
          created_at?: string
          description: string
          id?: string
          immediate_action?: string | null
          is_anonymous?: boolean
          location_text?: string | null
          occurred_at?: string | null
          promoted_hazard_id?: string | null
          report_code: string
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_phone?: string | null
          reporter_role?: string | null
          source?: string
          submitted_at?: string
          triage_notes?: string | null
          triage_status?: string
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Update: {
          base_id?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          immediate_action?: string | null
          is_anonymous?: boolean
          location_text?: string | null
          occurred_at?: string | null
          promoted_hazard_id?: string | null
          report_code?: string
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_phone?: string | null
          reporter_role?: string | null
          source?: string
          submitted_at?: string
          triage_notes?: string | null
          triage_status?: string
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_safety_reports_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_safety_reports_promoted_hazard_id_fkey"
            columns: ["promoted_hazard_id"]
            isOneToOne: false
            referencedRelation: "sms_hazards"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_spi_measurements: {
        Row: {
          base_id: string
          computed_by: string
          created_at: string
          id: string
          notes: string | null
          period_end: string
          period_start: string
          spi_id: string
          status: string
          value: number
        }
        Insert: {
          base_id: string
          computed_by?: string
          created_at?: string
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          spi_id: string
          status?: string
          value: number
        }
        Update: {
          base_id?: string
          computed_by?: string
          created_at?: string
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          spi_id?: string
          status?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "sms_spi_measurements_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_spi_measurements_spi_id_fkey"
            columns: ["spi_id"]
            isOneToOne: false
            referencedRelation: "sms_spis"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_spis: {
        Row: {
          active: boolean
          alert_threshold: number | null
          base_id: string
          code: string
          computation_key: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          measurement_frequency: string
          target_direction: string
          target_value: number | null
          title: string
          unit: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          alert_threshold?: number | null
          base_id: string
          code: string
          computation_key?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          measurement_frequency?: string
          target_direction?: string
          target_value?: number | null
          title: string
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          alert_threshold?: number | null
          base_id?: string
          code?: string
          computation_key?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          measurement_frequency?: string
          target_direction?: string
          target_value?: number | null
          title?: string
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_spis_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      status_board_layouts: {
        Row: {
          base_id: string
          layout: Json | null
          section_order: string[] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_id: string
          layout?: Json | null
          section_order?: string[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_id?: string
          layout?: Json | null
          section_order?: string[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_board_layouts_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: true
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_board_layouts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_updates: {
        Row: {
          base_id: string | null
          created_at: string
          discrepancy_id: string
          id: string
          new_status: string | null
          notes: string | null
          old_status: string | null
          updated_by: string | null
        }
        Insert: {
          base_id?: string | null
          created_at?: string
          discrepancy_id: string
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          updated_by?: string | null
        }
        Update: {
          base_id?: string | null
          created_at?: string
          discrepancy_id?: string
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_updates_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_updates_discrepancy_id_fkey"
            columns: ["discrepancy_id"]
            isOneToOne: false
            referencedRelation: "discrepancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_updates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_certificates: {
        Row: {
          base_id: string
          certificate_url: string | null
          created_at: string
          created_by: string | null
          credential: Database["public"]["Enums"]["training_credential"]
          expires_at: string | null
          id: string
          issued_at: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_id: string
          certificate_url?: string | null
          created_at?: string
          created_by?: string | null
          credential: Database["public"]["Enums"]["training_credential"]
          expires_at?: string | null
          id?: string
          issued_at: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_id?: string
          certificate_url?: string | null
          created_at?: string
          created_by?: string | null
          credential?: Database["public"]["Enums"]["training_credential"]
          expires_at?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_certificates_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_certificates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_digest_log: {
        Row: {
          base_id: string
          id: string
          recipient: string
          send_date: string
          sent_at: string
          topic_codes: string[]
          user_id: string
        }
        Insert: {
          base_id: string
          id?: string
          recipient: string
          send_date: string
          sent_at?: string
          topic_codes?: string[]
          user_id: string
        }
        Update: {
          base_id?: string
          id?: string
          recipient?: string
          send_date?: string
          sent_at?: string
          topic_codes?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_digest_log_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_digest_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_records: {
        Row: {
          base_id: string
          completed_at: string
          created_at: string
          created_by: string | null
          evidence_url: string | null
          expires_at: string | null
          id: string
          instructor_name_external: string | null
          instructor_user_id: string | null
          notes: string | null
          topic_id: string
          training_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_id: string
          completed_at: string
          created_at?: string
          created_by?: string | null
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          instructor_name_external?: string | null
          instructor_user_id?: string | null
          notes?: string | null
          topic_id: string
          training_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_id?: string
          completed_at?: string
          created_at?: string
          created_by?: string | null
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          instructor_name_external?: string | null
          instructor_user_id?: string | null
          notes?: string | null
          topic_id?: string
          training_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_records_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_instructor_user_id_fkey"
            columns: ["instructor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "training_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_renewals: {
        Row: {
          base_id: string
          id: string
          previous_record_id: string
          renewed_at: string
          renewed_record_id: string
        }
        Insert: {
          base_id: string
          id?: string
          previous_record_id: string
          renewed_at?: string
          renewed_record_id: string
        }
        Update: {
          base_id?: string
          id?: string
          previous_record_id?: string
          renewed_at?: string
          renewed_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_renewals_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_renewals_previous_record_id_fkey"
            columns: ["previous_record_id"]
            isOneToOne: false
            referencedRelation: "training_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_renewals_renewed_record_id_fkey"
            columns: ["renewed_record_id"]
            isOneToOne: false
            referencedRelation: "training_records"
            referencedColumns: ["id"]
          },
        ]
      }
      training_topics: {
        Row: {
          active: boolean
          applies_to: string[]
          base_id: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          initial_required: boolean
          material_url: string | null
          recurrent_frequency_months: number
          retention_months: number
          sort_order: number
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          applies_to?: string[]
          base_id?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          initial_required?: boolean
          material_url?: string | null
          recurrent_frequency_months?: number
          retention_months?: number
          sort_order?: number
          source?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          applies_to?: string[]
          base_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          initial_required?: boolean
          material_url?: string | null
          recurrent_frequency_months?: number
          retention_months?: number
          sort_order?: number
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_topics_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_document_pages: {
        Row: {
          document_id: string
          extracted_at: string
          file_name: string
          id: number
          page_number: number
          text_content: string
          tsv: unknown
          user_id: string
        }
        Insert: {
          document_id: string
          extracted_at?: string
          file_name: string
          id?: never
          page_number: number
          text_content?: string
          tsv?: unknown
          user_id: string
        }
        Update: {
          document_id?: string
          extracted_at?: string
          file_name?: string
          id?: never
          page_number?: number
          text_content?: string
          tsv?: unknown
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_document_pages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "user_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_documents: {
        Row: {
          base_id: string | null
          display_name: string
          extracted_at: string | null
          file_name: string
          file_size: number | null
          id: string
          notes: string | null
          status: string
          total_pages: number | null
          uploaded_at: string
          user_id: string
        }
        Insert: {
          base_id?: string | null
          display_name: string
          extracted_at?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          notes?: string | null
          status?: string
          total_pages?: number | null
          uploaded_at?: string
          user_id: string
        }
        Update: {
          base_id?: string | null
          display_name?: string
          extracted_at?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          notes?: string | null
          status?: string
          total_pages?: number | null
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permission_overrides: {
        Row: {
          created_at: string
          granted: boolean
          permission_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted: boolean
          permission_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          permission_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      user_regulation_pdfs: {
        Row: {
          file_name: string
          file_size_bytes: number | null
          id: string
          reg_id: string
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          file_name: string
          file_size_bytes?: number | null
          id?: string
          reg_id: string
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          reg_id?: string
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_regulation_pdfs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waiver_attachments: {
        Row: {
          caption: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          mime_type: string | null
          uploaded_by: string | null
          waiver_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
          waiver_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiver_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiver_attachments_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      waiver_coordination: {
        Row: {
          comments: string | null
          coordinated_date: string | null
          coordinator_name: string | null
          id: string
          office: string
          office_label: string | null
          status: string
          waiver_id: string
        }
        Insert: {
          comments?: string | null
          coordinated_date?: string | null
          coordinator_name?: string | null
          id?: string
          office: string
          office_label?: string | null
          status?: string
          waiver_id: string
        }
        Update: {
          comments?: string | null
          coordinated_date?: string | null
          coordinator_name?: string | null
          id?: string
          office?: string
          office_label?: string | null
          status?: string
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiver_coordination_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      waiver_criteria: {
        Row: {
          criteria_source: string
          description: string | null
          id: string
          reference: string | null
          sort_order: number
          waiver_id: string
        }
        Insert: {
          criteria_source: string
          description?: string | null
          id?: string
          reference?: string | null
          sort_order?: number
          waiver_id: string
        }
        Update: {
          criteria_source?: string
          description?: string | null
          id?: string
          reference?: string | null
          sort_order?: number
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiver_criteria_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      waiver_reviews: {
        Row: {
          created_at: string
          facilities_board_date: string | null
          id: string
          mitigation_verified: boolean | null
          notes: string | null
          presented_to_facilities_board: boolean | null
          project_status_update: string | null
          recommendation: string | null
          review_date: string | null
          review_year: number
          reviewed_by: string | null
          waiver_id: string
        }
        Insert: {
          created_at?: string
          facilities_board_date?: string | null
          id?: string
          mitigation_verified?: boolean | null
          notes?: string | null
          presented_to_facilities_board?: boolean | null
          project_status_update?: string | null
          recommendation?: string | null
          review_date?: string | null
          review_year: number
          reviewed_by?: string | null
          waiver_id: string
        }
        Update: {
          created_at?: string
          facilities_board_date?: string | null
          id?: string
          mitigation_verified?: boolean | null
          notes?: string | null
          presented_to_facilities_board?: boolean | null
          project_status_update?: string | null
          recommendation?: string | null
          review_date?: string | null
          review_year?: number
          reviewed_by?: string | null
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiver_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiver_reviews_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      waivers: {
        Row: {
          action_requested: string | null
          attachment_count: number
          base_id: string | null
          classification: string
          corrective_action: string | null
          created_at: string
          created_by: string | null
          criteria_impact: string | null
          date_approved: string | null
          date_submitted: string | null
          description: string
          estimated_cost: number | null
          expiration_date: string | null
          faa_case_number: string | null
          hazard_rating: string | null
          id: string
          justification: string | null
          last_reviewed_date: string | null
          location_description: string | null
          location_lat: number | null
          location_lng: number | null
          next_review_due: string | null
          notes: string | null
          period_valid: string | null
          photo_count: number
          program_fy: number | null
          project_number: string | null
          project_status: string | null
          proponent: string | null
          risk_assessment_summary: string | null
          status: string
          updated_at: string
          updated_by: string | null
          waiver_number: string
        }
        Insert: {
          action_requested?: string | null
          attachment_count?: number
          base_id?: string | null
          classification: string
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          criteria_impact?: string | null
          date_approved?: string | null
          date_submitted?: string | null
          description?: string
          estimated_cost?: number | null
          expiration_date?: string | null
          faa_case_number?: string | null
          hazard_rating?: string | null
          id?: string
          justification?: string | null
          last_reviewed_date?: string | null
          location_description?: string | null
          location_lat?: number | null
          location_lng?: number | null
          next_review_due?: string | null
          notes?: string | null
          period_valid?: string | null
          photo_count?: number
          program_fy?: number | null
          project_number?: string | null
          project_status?: string | null
          proponent?: string | null
          risk_assessment_summary?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          waiver_number: string
        }
        Update: {
          action_requested?: string | null
          attachment_count?: number
          base_id?: string | null
          classification?: string
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          criteria_impact?: string | null
          date_approved?: string | null
          date_submitted?: string | null
          description?: string
          estimated_cost?: number | null
          expiration_date?: string | null
          faa_case_number?: string | null
          hazard_rating?: string | null
          id?: string
          justification?: string | null
          last_reviewed_date?: string | null
          location_description?: string | null
          location_lat?: number | null
          location_lng?: number | null
          next_review_due?: string | null
          notes?: string | null
          period_valid?: string | null
          photo_count?: number
          program_fy?: number | null
          project_number?: string | null
          project_status?: string | null
          proponent?: string | null
          risk_assessment_summary?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          waiver_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "waivers_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waivers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waivers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wildlife_hazard_assessments: {
        Row: {
          ae_signed_at: string | null
          ae_user_id: string | null
          assessment_year: number
          base_id: string
          created_at: string
          created_by: string | null
          faa_acceptance_ref: string | null
          faa_accepted_at: string | null
          findings: Json
          hazardous_species: Json
          id: string
          last_reviewed_at: string | null
          mitigation_summary: string | null
          notes: string | null
          performed_at: string
          performed_by_external: string | null
          performed_by_user_id: string | null
          replaced_by_id: string | null
          report_url: string | null
          review_notes: string | null
          reviewed_by_user_id: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          ae_signed_at?: string | null
          ae_user_id?: string | null
          assessment_year: number
          base_id: string
          created_at?: string
          created_by?: string | null
          faa_acceptance_ref?: string | null
          faa_accepted_at?: string | null
          findings?: Json
          hazardous_species?: Json
          id?: string
          last_reviewed_at?: string | null
          mitigation_summary?: string | null
          notes?: string | null
          performed_at: string
          performed_by_external?: string | null
          performed_by_user_id?: string | null
          replaced_by_id?: string | null
          report_url?: string | null
          review_notes?: string | null
          reviewed_by_user_id?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          ae_signed_at?: string | null
          ae_user_id?: string | null
          assessment_year?: number
          base_id?: string
          created_at?: string
          created_by?: string | null
          faa_acceptance_ref?: string | null
          faa_accepted_at?: string | null
          findings?: Json
          hazardous_species?: Json
          id?: string
          last_reviewed_at?: string | null
          mitigation_summary?: string | null
          notes?: string | null
          performed_at?: string
          performed_by_external?: string | null
          performed_by_user_id?: string | null
          replaced_by_id?: string | null
          report_url?: string | null
          review_notes?: string | null
          reviewed_by_user_id?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wildlife_hazard_assessments_ae_user_id_fkey"
            columns: ["ae_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildlife_hazard_assessments_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildlife_hazard_assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildlife_hazard_assessments_performed_by_user_id_fkey"
            columns: ["performed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildlife_hazard_assessments_replaced_by_id_fkey"
            columns: ["replaced_by_id"]
            isOneToOne: false
            referencedRelation: "wildlife_hazard_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildlife_hazard_assessments_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wildlife_sightings: {
        Row: {
          action_taken: string | null
          airfield_zone: string | null
          base_id: string | null
          behavior: string | null
          bwc_at_time: string | null
          check_id: string | null
          count_observed: number
          created_at: string | null
          discrepancy_id: string | null
          dispersal_effective: boolean | null
          dispersal_method: string | null
          display_id: string
          id: string
          inspection_id: string | null
          latitude: number | null
          location_text: string | null
          longitude: number | null
          notes: string | null
          observed_at: string
          observed_by: string
          observed_by_id: string | null
          photo_count: number | null
          precipitation: string | null
          size_category: string | null
          sky_condition: string | null
          species_common: string
          species_group: string
          species_scientific: string | null
          time_of_day: string | null
          updated_at: string | null
        }
        Insert: {
          action_taken?: string | null
          airfield_zone?: string | null
          base_id?: string | null
          behavior?: string | null
          bwc_at_time?: string | null
          check_id?: string | null
          count_observed?: number
          created_at?: string | null
          discrepancy_id?: string | null
          dispersal_effective?: boolean | null
          dispersal_method?: string | null
          display_id: string
          id?: string
          inspection_id?: string | null
          latitude?: number | null
          location_text?: string | null
          longitude?: number | null
          notes?: string | null
          observed_at?: string
          observed_by: string
          observed_by_id?: string | null
          photo_count?: number | null
          precipitation?: string | null
          size_category?: string | null
          sky_condition?: string | null
          species_common: string
          species_group: string
          species_scientific?: string | null
          time_of_day?: string | null
          updated_at?: string | null
        }
        Update: {
          action_taken?: string | null
          airfield_zone?: string | null
          base_id?: string | null
          behavior?: string | null
          bwc_at_time?: string | null
          check_id?: string | null
          count_observed?: number
          created_at?: string | null
          discrepancy_id?: string | null
          dispersal_effective?: boolean | null
          dispersal_method?: string | null
          display_id?: string
          id?: string
          inspection_id?: string | null
          latitude?: number | null
          location_text?: string | null
          longitude?: number | null
          notes?: string | null
          observed_at?: string
          observed_by?: string
          observed_by_id?: string | null
          photo_count?: number | null
          precipitation?: string | null
          size_category?: string | null
          sky_condition?: string | null
          species_common?: string
          species_group?: string
          species_scientific?: string | null
          time_of_day?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wildlife_sightings_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildlife_sightings_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "airfield_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildlife_sightings_discrepancy_id_fkey"
            columns: ["discrepancy_id"]
            isOneToOne: false
            referencedRelation: "discrepancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildlife_sightings_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildlife_sightings_observed_by_id_fkey"
            columns: ["observed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wildlife_strikes: {
        Row: {
          aircraft_registration: string | null
          aircraft_type: string | null
          altitude_agl: number | null
          base_id: string | null
          bwc_at_time: string | null
          created_at: string | null
          damage_level: string | null
          discrepancy_id: string | null
          display_id: string
          engine_ingested: boolean | null
          engine_type: string | null
          engines_ingested: number[] | null
          flight_effect: string | null
          hours_out_of_service: number | null
          id: string
          lab_identification: string | null
          latitude: number | null
          location_text: string | null
          longitude: number | null
          notes: string | null
          number_seen: number | null
          number_struck: number | null
          other_cost: number | null
          parts_damaged: string[] | null
          parts_struck: string[] | null
          phase_of_flight: string | null
          photo_count: number | null
          pilot_warned: boolean | null
          precipitation: string | null
          remains_collected: boolean | null
          remains_sent_to_lab: boolean | null
          repair_cost: number | null
          reported_by: string
          reported_by_id: string | null
          sighting_id: string | null
          size_category: string | null
          sky_condition: string | null
          species_common: string | null
          species_group: string | null
          species_scientific: string | null
          speed_ias: number | null
          strike_date: string
          time_of_day: string | null
          updated_at: string | null
        }
        Insert: {
          aircraft_registration?: string | null
          aircraft_type?: string | null
          altitude_agl?: number | null
          base_id?: string | null
          bwc_at_time?: string | null
          created_at?: string | null
          damage_level?: string | null
          discrepancy_id?: string | null
          display_id: string
          engine_ingested?: boolean | null
          engine_type?: string | null
          engines_ingested?: number[] | null
          flight_effect?: string | null
          hours_out_of_service?: number | null
          id?: string
          lab_identification?: string | null
          latitude?: number | null
          location_text?: string | null
          longitude?: number | null
          notes?: string | null
          number_seen?: number | null
          number_struck?: number | null
          other_cost?: number | null
          parts_damaged?: string[] | null
          parts_struck?: string[] | null
          phase_of_flight?: string | null
          photo_count?: number | null
          pilot_warned?: boolean | null
          precipitation?: string | null
          remains_collected?: boolean | null
          remains_sent_to_lab?: boolean | null
          repair_cost?: number | null
          reported_by: string
          reported_by_id?: string | null
          sighting_id?: string | null
          size_category?: string | null
          sky_condition?: string | null
          species_common?: string | null
          species_group?: string | null
          species_scientific?: string | null
          speed_ias?: number | null
          strike_date?: string
          time_of_day?: string | null
          updated_at?: string | null
        }
        Update: {
          aircraft_registration?: string | null
          aircraft_type?: string | null
          altitude_agl?: number | null
          base_id?: string | null
          bwc_at_time?: string | null
          created_at?: string | null
          damage_level?: string | null
          discrepancy_id?: string | null
          display_id?: string
          engine_ingested?: boolean | null
          engine_type?: string | null
          engines_ingested?: number[] | null
          flight_effect?: string | null
          hours_out_of_service?: number | null
          id?: string
          lab_identification?: string | null
          latitude?: number | null
          location_text?: string | null
          longitude?: number | null
          notes?: string | null
          number_seen?: number | null
          number_struck?: number | null
          other_cost?: number | null
          parts_damaged?: string[] | null
          parts_struck?: string[] | null
          phase_of_flight?: string | null
          photo_count?: number | null
          pilot_warned?: boolean | null
          precipitation?: string | null
          remains_collected?: boolean | null
          remains_sent_to_lab?: boolean | null
          repair_cost?: number | null
          reported_by?: string
          reported_by_id?: string | null
          sighting_id?: string | null
          size_category?: string | null
          sky_condition?: string | null
          species_common?: string | null
          species_group?: string | null
          species_scientific?: string | null
          speed_ias?: number | null
          strike_date?: string
          time_of_day?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wildlife_strikes_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildlife_strikes_discrepancy_id_fkey"
            columns: ["discrepancy_id"]
            isOneToOne: false
            referencedRelation: "discrepancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildlife_strikes_reported_by_id_fkey"
            columns: ["reported_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildlife_strikes_sighting_id_fkey"
            columns: ["sighting_id"]
            isOneToOne: false
            referencedRelation: "wildlife_sightings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _expire_weather_advisories: { Args: never; Returns: number }
      _ppr_generate_number: {
        Args: { p_arrival: string; p_base_id: string; p_oi: string }
        Returns: string
      }
      _sms_compute_spi_measurements: {
        Args: { p_target_date?: string }
        Returns: number
      }
      _sms_next_code: {
        Args: { p_base_id: string; p_prefix: string; p_table: string }
        Returns: string
      }
      _sms_risk_band: { Args: { p_index: number }; Returns: string }
      _sms_seed_default_spis: {
        Args: { p_base_id: string }
        Returns: undefined
      }
      amtr_base_for_path: { Args: { p_name: string }; Returns: string }
      amtr_reopen: {
        Args: { p_row_id: string; p_slot: string; p_table: string }
        Returns: undefined
      }
      amtr_required_slots: {
        Args: { p_row_id: string; p_table: string }
        Returns: string[]
      }
      amtr_sign: {
        Args: {
          p_initials: string
          p_row_id: string
          p_slot: string
          p_table: string
        }
        Returns: undefined
      }
      amtr_slots_for_table: { Args: { p_table: string }; Returns: string[] }
      amtr_transcribe: {
        Args: {
          p_complete_date: string
          p_initials: string
          p_row_id: string
          p_slot: string
          p_table: string
        }
        Returns: undefined
      }
      approve_sms_moc: {
        Args: { p_approval_notes?: string; p_moc_id: string }
        Returns: Json
      }
      base_exists: { Args: { p_base_id: string }; Returns: boolean }
      ces_update_discrepancy: {
        Args: {
          p_current_status?: string
          p_id: string
          p_note?: string
          p_resolution_notes?: string
        }
        Returns: {
          assigned_shop: string | null
          assigned_to: string | null
          base_id: string | null
          created_at: string
          current_status: string
          description: string
          display_id: string
          estimated_completion_date: string | null
          estimated_cost: string | null
          facility_number: string | null
          id: string
          infrastructure_feature_id: string | null
          inspection_id: string | null
          latitude: number | null
          lighting_system_id: string | null
          linked_notam_id: string | null
          location_text: string
          longitude: number | null
          notam_reference: string | null
          photo_count: number
          project_number: string | null
          reported_by: string | null
          resolution_date: string | null
          resolution_notes: string | null
          risk_control_measure: string | null
          severity: string
          status: string
          title: string
          type: string
          updated_at: string
          work_order_number: string | null
        }
        SetofOptions: {
          from: "*"
          to: "discrepancies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_rate_limit: {
        Args: { p_bucket: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      flip_sign_review: {
        Args: { p_review_id: string; p_slot: string }
        Returns: {
          afm_signed_at: string | null
          afm_signed_by: string | null
          base_id: string
          custodian_signed_at: string | null
          custodian_signed_by: string | null
          id: string
          namo_signed_at: string | null
          namo_signed_by: string | null
          review_id: string
        }
        SetofOptions: {
          from: "*"
          to: "flip_review_signoffs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_display_id: {
        Args: { prefix: string; seq_name: string }
        Returns: string
      }
      get_public_feedback_config: {
        Args: { p_base_id: string }
        Returns: {
          base_name: string
          config: Json
          module_enabled: boolean
        }[]
      }
      get_public_ppr_config: {
        Args: { p_base_id: string }
        Returns: {
          base_name: string
          columns: Json
          module_enabled: boolean
          timezone: string
        }[]
      }
      get_public_ppr_config_by_icao: {
        Args: { p_icao: string }
        Returns: {
          base_id: string
          base_name: string
          columns: Json
          module_enabled: boolean
          timezone: string
        }[]
      }
      get_public_safety_report_config_by_icao: {
        Args: { p_icao: string }
        Returns: {
          airport_type: string
          base_id: string
          base_name: string
          module_enabled: boolean
        }[]
      }
      is_1098_year_archived: {
        Args: { base_uuid: string; year_text: string }
        Returns: boolean
      }
      promote_safety_report_to_hazard: {
        Args: {
          p_description?: string
          p_report_id: string
          p_title: string
          p_triage_notes?: string
        }
        Returns: Json
      }
      record_page_view: {
        Args: { p_base_id: string; p_route: string }
        Returns: undefined
      }
      reject_sms_moc: {
        Args: { p_moc_id: string; p_rejection_reason: string }
        Returns: Json
      }
      safety_update_rsc_bwc: {
        Args: {
          p_base_id: string
          p_bwc_value?: string
          p_rcr_condition?: string
          p_rcr_midpoint?: string
          p_rcr_rollout?: string
          p_rcr_touchdown?: string
          p_reason?: string
          p_rsc_condition?: string
        }
        Returns: {
          active_runway: string
          advisories: Json
          advisory_text: string | null
          advisory_type: string | null
          afm_closed: boolean
          afm_closed_message: string | null
          afm_ooo_message: string | null
          afm_out_of_office: boolean
          arff_cat: number | null
          arff_statuses: Json | null
          base_id: string | null
          bwc_updated_at: string | null
          bwc_value: string | null
          construction_remarks: string | null
          id: string
          misc_remarks: string | null
          rcr_condition: string | null
          rcr_midpoint: string | null
          rcr_rollout: string | null
          rcr_touchdown: string | null
          rcr_updated_at: string | null
          rsc_condition: string | null
          rsc_updated_at: string | null
          runway_status: string
          runway_statuses: Json | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "airfield_status"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_all_pdfs: {
        Args: { max_results?: number; search_query: string }
        Returns: {
          file_name: string
          headline: string
          page_number: number
          rank: number
        }[]
      }
      search_pdf: {
        Args: { search_query: string; target_file: string }
        Returns: {
          headline: string
          page_number: number
          rank: number
        }[]
      }
      search_user_documents: {
        Args: { max_results?: number; search_query: string }
        Returns: {
          document_id: string
          file_name: string
          headline: string
          page_number: number
          rank: number
        }[]
      }
      sign_daily_review_slot: {
        Args: {
          p_base_id: string
          p_date: string
          p_events_hash: string
          p_notes?: string
          p_shift_count?: number
          p_slot: string
        }
        Returns: {
          afm_events_hash: string | null
          afm_notes: string | null
          afm_signed_at: string | null
          afm_signed_by: string | null
          base_id: string
          created_at: string
          day_amsl_events_hash: string | null
          day_amsl_notes: string | null
          day_amsl_signed_at: string | null
          day_amsl_signed_by: string | null
          fully_certified_at: string | null
          id: string
          mid_amsl_events_hash: string | null
          mid_amsl_notes: string | null
          mid_amsl_signed_at: string | null
          mid_amsl_signed_by: string | null
          namo_events_hash: string | null
          namo_notes: string | null
          namo_signed_at: string | null
          namo_signed_by: string | null
          review_date: string
          swing_amsl_events_hash: string | null
          swing_amsl_notes: string | null
          swing_amsl_signed_at: string | null
          swing_amsl_signed_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "daily_reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sign_sms_policy: {
        Args: {
          p_effective_date: string
          p_policy_id: string
          p_signature_image_url?: string
        }
        Returns: Json
      }
      submit_public_ppr_request: {
        Args: {
          p_arrival_date: string
          p_base_id: string
          p_column_values?: Json
          p_notes?: string
          p_requester_email: string
          p_requester_name: string
          p_requester_phone: string
        }
        Returns: Json
      }
      submit_safety_report_public: {
        Args: {
          p_base_id: string
          p_category: string
          p_description: string
          p_immediate_action?: string
          p_location_text?: string
          p_occurred_at?: string
          p_reporter_email?: string
          p_reporter_name?: string
          p_reporter_phone?: string
          p_reporter_role?: string
        }
        Returns: Json
      }
      supersede_aep_plan: {
        Args: {
          p_approved_by_faa_at?: string
          p_document_url?: string
          p_effective_date: string
          p_faa_acceptance_ref?: string
          p_notes?: string
          p_prior_plan_id: string
          p_storage_path?: string
          p_version: string
        }
        Returns: Json
      }
      user_has_base_access: {
        Args: { p_base_id: string; p_user_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { p_key: string; p_user_id: string }
        Returns: boolean
      }
      user_is_sys_admin: { Args: { p_user_id: string }; Returns: boolean }
      user_shares_base: {
        Args: { p_target: string; p_viewer: string }
        Returns: boolean
      }
      waiver_base_for_path: { Args: { p_name: string }; Returns: string }
    }
    Enums: {
      training_credential:
        | "AAAE-CM"
        | "ACE-Ops"
        | "ACE-Comm"
        | "ACE-Sec"
        | "ACE-WHC"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      training_credential: [
        "AAAE-CM",
        "ACE-Ops",
        "ACE-Comm",
        "ACE-Sec",
        "ACE-WHC",
      ],
    },
  },
} as const

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
  | 'ppr'
  | 'airfield_status'
  | 'majcom_rfm'
  // Civilian Part 139 roles
  | 'accountable_executive'
  | 'sms_manager'
  | 'aep_coordinator'
  | 'ops_supervisor'
  | 'arff_chief'

export type ProfileStatus = 'active' | 'deactivated' | 'pending'

export type DiscrepancyStatus = 'open' | 'completed' | 'cancelled'
export type CurrentStatus = 'submitted_to_afm' | 'submitted_to_ces' | 'awaiting_action_by_ces' | 'waiting_for_project' | 'work_completed_awaiting_verification'
export type CheckType = 'fod' | 'rsc' | 'ife' | 'ground_emergency' | 'heavy_aircraft' | 'bash' | 'rcr' | 'construction' | 'other'
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
  /** Facility number (from base_facilities) */
  facility_number?: string
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
export type BaseTaxiway = Database['public']['Tables']['base_taxiways']['Row']
export type BaseWildlifeSpecies = Database['public']['Tables']['base_wildlife_species']['Row']

// === QRC (Quick Reaction Checklist) Types ===

export type QrcStepType = 'checkbox' | 'checkbox_with_note' | 'notify_agencies' | 'fill_field' | 'time_field' | 'conditional' | 'text' | 'textarea'

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
  // Tri-state. When present, takes precedence over `completed`. Legacy executions
  // only set `completed`; `lib/qrc-step-status.ts` bridges the two.
  status?: 'completed' | 'not_applicable'
  completed_by?: string
  completed_at?: string
  value?: string
  agencies_checked?: string[]
  // Per-agency N/A list for notify_agencies steps; same semantic as `status`.
  agencies_na?: string[]
  notes?: string
}

// Per-user monthly review row (qrc_monthly_reviews). Defined here rather than
// derived from Database['Tables'] because the supabase-generated types haven't
// been regenerated against migration 2026050300 yet.
export type QrcMonthlyReview = {
  id: string
  base_id: string
  template_id: string
  user_id: string
  reviewed_at: string
  template_updated_at_at_review: string | null
  notes: string | null
  created_at: string
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
  /** Required on N items — the mitigation or interim control for the finding. */
  risk_control_measure: string
  photo_ids: string[]
  areas: string[]
  /** @deprecated Use `pins` instead */
  latitude: number | null
  /** @deprecated Use `pins` instead */
  longitude: number | null
  pins: { lat: number; lng: number }[]
  linked_discrepancy_id?: string | null
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
  /**
   * When false, the PDF export skips this member's signature block but
   * still lists them in the Inspection Team roster. Undefined / true is
   * treated as required so existing draft + filed rows that predate
   * this field stay backwards-compatible.
   */
  signature_required?: boolean
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
  /** Civilian (Part 139 Form 5280-4) cover-sheet fields. Optional — USAF drafts never set these. */
  arff_index?: string
  airport_class?: string
  inspector?: string
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
  /** Civilian (Part 139 Form 5280-4) cover-sheet fields. Null for USAF ACSI. */
  arff_index: string | null
  airport_class: string | null
  inspector: string | null
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
