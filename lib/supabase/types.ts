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
      airfield_checks: {
        Row: {
          areas: string[]
          base_id: string | null
          check_type: string
          completed_at: string | null
          completed_by: string | null
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
          id: string
          length_ft: number
          runway_class: string
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
          id?: string
          length_ft: number
          runway_class?: string
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
          id?: string
          length_ft?: number
          runway_class?: string
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
          arff_config: Json
          ce_shops: string[]
          checklist_reset_time: string
          contractor_templates: Json | null
          created_at: string
          default_closed_message: string | null
          default_ooo_message: string | null
          discrepancy_type_shop_map: Json | null
          elevation_msl: number | null
          enabled_modules: string[]
          feedback_form_config: Json
          icao: string | null
          id: string
          installation_code: string | null
          is_active: boolean
          location: string | null
          majcom: string | null
          name: string
          setup_progress: Json
          shift_count: number
          status_labels: Json
          timezone: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          activity_templates?: Json | null
          arff_config?: Json
          ce_shops?: string[]
          checklist_reset_time?: string
          contractor_templates?: Json | null
          created_at?: string
          default_closed_message?: string | null
          default_ooo_message?: string | null
          discrepancy_type_shop_map?: Json | null
          elevation_msl?: number | null
          enabled_modules?: string[]
          feedback_form_config?: Json
          icao?: string | null
          id?: string
          installation_code?: string | null
          is_active?: boolean
          location?: string | null
          majcom?: string | null
          name: string
          setup_progress?: Json
          shift_count?: number
          status_labels?: Json
          timezone?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          activity_templates?: Json | null
          arff_config?: Json
          ce_shops?: string[]
          checklist_reset_time?: string
          contractor_templates?: Json | null
          created_at?: string
          default_closed_message?: string | null
          default_ooo_message?: string | null
          discrepancy_type_shop_map?: Json | null
          elevation_msl?: number | null
          enabled_modules?: string[]
          feedback_form_config?: Json
          icao?: string | null
          id?: string
          installation_code?: string | null
          is_active?: boolean
          location?: string | null
          majcom?: string | null
          name?: string
          setup_progress?: Json
          shift_count?: number
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
            foreignKeyName: "daily_reviews_swing_amsl_signed_by_fkey"
            columns: ["swing_amsl_signed_by"]
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
            foreignKeyName: "daily_reviews_afm_signed_by_fkey"
            columns: ["afm_signed_by"]
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
          reported_by: string | null
          resolution_date: string | null
          resolution_notes: string | null
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
          reported_by?: string | null
          resolution_date?: string | null
          resolution_notes?: string | null
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
          reported_by?: string | null
          resolution_date?: string | null
          resolution_notes?: string | null
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
          runway_class: string
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
          runway_class: string
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
          runway_class?: string
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
          system_type?: string
        }
        Relationships: []
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
      ppr_columns: {
        Row: {
          base_id: string
          column_name: string
          column_type: string
          created_at: string
          id: string
          is_required: boolean
          sort_order: number
        }
        Insert: {
          base_id: string
          column_name: string
          column_type?: string
          created_at?: string
          id?: string
          is_required?: boolean
          sort_order?: number
        }
        Update: {
          base_id?: string
          column_name?: string
          column_type?: string
          created_at?: string
          id?: string
          is_required?: boolean
          sort_order?: number
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
      ppr_entries: {
        Row: {
          approver_oi: string | null
          arrival_date: string
          base_id: string
          column_values: Json
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          ppr_number: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approver_oi?: string | null
          arrival_date: string
          base_id: string
          column_values?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          ppr_number: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approver_oi?: string | null
          arrival_date?: string
          base_id?: string
          column_values?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          ppr_number?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
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
            foreignKeyName: "ppr_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          id: string
          is_active: boolean
          last_name: string | null
          last_seen_at: string | null
          name: string
          operating_initials: string | null
          organization: string | null
          phone: string | null
          primary_base_id: string | null
          rank: string | null
          role: string
          shop: string | null
          sidebar_config: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_pdf_email?: string | null
          edipi?: string | null
          email: string
          first_name?: string | null
          id: string
          is_active?: boolean
          last_name?: string | null
          last_seen_at?: string | null
          name: string
          operating_initials?: string | null
          organization?: string | null
          phone?: string | null
          primary_base_id?: string | null
          rank?: string | null
          role?: string
          shop?: string | null
          sidebar_config?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_pdf_email?: string | null
          edipi?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          last_seen_at?: string | null
          name?: string
          operating_initials?: string | null
          organization?: string | null
          phone?: string | null
          primary_base_id?: string | null
          rank?: string | null
          role?: string
          shop?: string | null
          sidebar_config?: Json | null
          status?: string
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
          open_initials: string | null
          opened_at: string
          opened_by: string | null
          qrc_number: number
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
          open_initials?: string | null
          opened_at?: string
          opened_by?: string | null
          qrc_number: number
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
          open_initials?: string | null
          opened_at?: string
          opened_by?: string | null
          qrc_number?: number
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
            foreignKeyName: "qrc_executions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "qrc_templates"
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
      generate_display_id: {
        Args: { prefix: string; seq_name: string }
        Returns: string
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
      update_airfield_status:
        | {
            Args: { p_updated_by?: string; p_updates: Json }
            Returns: undefined
          }
        | {
            Args: { p_base_id?: string; p_updated_by?: string; p_updates: Json }
            Returns: undefined
          }
      user_can_write: { Args: { p_user_id: string }; Returns: boolean }
      user_has_base_access: {
        Args: { p_base_id: string; p_user_id: string }
        Returns: boolean
      }
      user_is_admin: { Args: { p_user_id: string }; Returns: boolean }
      user_is_base_admin_at: {
        Args: { p_base_id: string; p_user_id: string }
        Returns: boolean
      }
      user_is_sys_admin: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
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

export type ProfileStatus = 'active' | 'deactivated' | 'pending'

export type DiscrepancyStatus = 'open' | 'completed' | 'cancelled'
export type CurrentStatus = 'submitted_to_afm' | 'submitted_to_ces' | 'awaiting_action_by_ces' | 'waiting_for_project' | 'work_completed_awaiting_verification'
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
