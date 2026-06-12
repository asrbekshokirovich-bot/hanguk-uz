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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      adiga_calendar_events: {
        Row: {
          begin_date: string
          created_at: string
          end_date: string
          event_name_ko: string
          fetched_at: string
          gubun: string | null
          id: string
          institution_id: string | null
          institution_name_ko_raw: string | null
          remarks_ko: string | null
          schedule_type: string
          source_blob_hash: string | null
          subject_ko: string
          track_ko: string | null
          updated_at: string
        }
        Insert: {
          begin_date: string
          created_at?: string
          end_date: string
          event_name_ko: string
          fetched_at?: string
          gubun?: string | null
          id?: string
          institution_id?: string | null
          institution_name_ko_raw?: string | null
          remarks_ko?: string | null
          schedule_type: string
          source_blob_hash?: string | null
          subject_ko: string
          track_ko?: string | null
          updated_at?: string
        }
        Update: {
          begin_date?: string
          created_at?: string
          end_date?: string
          event_name_ko?: string
          fetched_at?: string
          gubun?: string | null
          id?: string
          institution_id?: string | null
          institution_name_ko_raw?: string | null
          remarks_ko?: string | null
          schedule_type?: string
          source_blob_hash?: string | null
          subject_ko?: string
          track_ko?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adiga_calendar_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adiga_calendar_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "adiga_calendar_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adiga_calendar_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "adiga_calendar_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "adiga_calendar_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      admission_cycles: {
        Row: {
          applicant_category: string | null
          attention_reason: string | null
          created_at: string
          cycle_track: string
          guideline_document_id: string | null
          id: string
          institution_id: string
          intake_term: string
          intake_year: number
          is_unified: boolean
          needs_attention: boolean
          round_number: number
          source_text_ko: string | null
          status: string
          superseded_by_id: string | null
          updated_at: string
        }
        Insert: {
          applicant_category?: string | null
          attention_reason?: string | null
          created_at?: string
          cycle_track: string
          guideline_document_id?: string | null
          id?: string
          institution_id: string
          intake_term: string
          intake_year: number
          is_unified?: boolean
          needs_attention?: boolean
          round_number?: number
          source_text_ko?: string | null
          status?: string
          superseded_by_id?: string | null
          updated_at?: string
        }
        Update: {
          applicant_category?: string | null
          attention_reason?: string | null
          created_at?: string
          cycle_track?: string
          guideline_document_id?: string | null
          id?: string
          institution_id?: string
          intake_term?: string
          intake_year?: number
          is_unified?: boolean
          needs_attention?: boolean
          round_number?: number
          source_text_ko?: string | null
          status?: string
          superseded_by_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_cycles_guideline_document_id_fkey"
            columns: ["guideline_document_id"]
            isOneToOne: false
            referencedRelation: "guideline_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_cycles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_cycles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "admission_cycles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_cycles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "admission_cycles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "admission_cycles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "admission_cycles_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "admission_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_cycles_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["cycle_id"]
          },
        ]
      }
      admission_sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          failed: number | null
          found: number | null
          id: string
          processed: number | null
          program_level: string
          semester: string
          started_at: string | null
          status: string
          total: number | null
          triggered_by: string | null
          year: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          failed?: number | null
          found?: number | null
          id?: string
          processed?: number | null
          program_level: string
          semester: string
          started_at?: string | null
          status?: string
          total?: number | null
          triggered_by?: string | null
          year: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          failed?: number | null
          found?: number | null
          id?: string
          processed?: number | null
          program_level?: string
          semester?: string
          started_at?: string | null
          status?: string
          total?: number | null
          triggered_by?: string | null
          year?: number
        }
        Relationships: []
      }
      ai_context_cache: {
        Row: {
          context_data: Json
          id: string
          updated_at: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          context_data: Json
          id?: string
          updated_at?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          context_data?: Json
          id?: string
          updated_at?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          content: string
          context_snapshot: Json | null
          created_at: string | null
          id: string
          role: string
          user_id: string
          user_type: string
        }
        Insert: {
          content: string
          context_snapshot?: Json | null
          created_at?: string | null
          id?: string
          role: string
          user_id: string
          user_type: string
        }
        Update: {
          content?: string
          context_snapshot?: Json | null
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      announcement_sources: {
        Row: {
          consecutive_fails: number
          created_at: string
          cron_high_season_minutes: number
          cron_off_season_minutes: number
          id: string
          institution_id: string | null
          jitter_minutes: number
          last_polled_at: string | null
          next_poll_at: string | null
          notes: string | null
          source_type: string
          status: string
          url_ko: string
        }
        Insert: {
          consecutive_fails?: number
          created_at?: string
          cron_high_season_minutes?: number
          cron_off_season_minutes?: number
          id?: string
          institution_id?: string | null
          jitter_minutes?: number
          last_polled_at?: string | null
          next_poll_at?: string | null
          notes?: string | null
          source_type: string
          status?: string
          url_ko: string
        }
        Update: {
          consecutive_fails?: number
          created_at?: string
          cron_high_season_minutes?: number
          cron_off_season_minutes?: number
          id?: string
          institution_id?: string | null
          jitter_minutes?: number
          last_polled_at?: string | null
          next_poll_at?: string | null
          notes?: string | null
          source_type?: string
          status?: string
          url_ko?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_sources_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_sources_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "announcement_sources_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_sources_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "announcement_sources_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "announcement_sources_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      announcements: {
        Row: {
          attachments: Json | null
          classifier_confidence: number | null
          classifier_label: string | null
          detected_at: string
          external_post_id: string | null
          guideline_document_id: string | null
          id: string
          posted_at: string | null
          source_id: string
          title_ko: string
          url_ko: string
        }
        Insert: {
          attachments?: Json | null
          classifier_confidence?: number | null
          classifier_label?: string | null
          detected_at?: string
          external_post_id?: string | null
          guideline_document_id?: string | null
          id?: string
          posted_at?: string | null
          source_id: string
          title_ko: string
          url_ko: string
        }
        Update: {
          attachments?: Json | null
          classifier_confidence?: number | null
          classifier_label?: string | null
          detected_at?: string
          external_post_id?: string | null
          guideline_document_id?: string | null
          id?: string
          posted_at?: string | null
          source_id?: string
          title_ko?: string
          url_ko?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_guideline_document_id_fkey"
            columns: ["guideline_document_id"]
            isOneToOne: false
            referencedRelation: "guideline_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "announcement_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      app_version_pings: {
        Row: {
          build: number | null
          channel: string
          last_seen_at: string
          locale: string | null
          platform: string
          raw_user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          build?: number | null
          channel?: string
          last_seen_at?: string
          locale?: string | null
          platform: string
          raw_user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          build?: number | null
          channel?: string
          last_seen_at?: string
          locale?: string | null
          platform?: string
          raw_user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_version_pings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      app_versions: {
        Row: {
          channel: string
          download_url: string
          force_full_reinstall: boolean
          force_update: boolean | null
          id: string
          ios_app_store_url: string | null
          latest_version: string
          min_supported_version: string | null
          release_notes: string | null
          rollout_percentage: number
          sha256: string | null
          size_bytes: number | null
        }
        Insert: {
          channel?: string
          download_url: string
          force_full_reinstall?: boolean
          force_update?: boolean | null
          id: string
          ios_app_store_url?: string | null
          latest_version: string
          min_supported_version?: string | null
          release_notes?: string | null
          rollout_percentage?: number
          sha256?: string | null
          size_bytes?: number | null
        }
        Update: {
          channel?: string
          download_url?: string
          force_full_reinstall?: boolean
          force_update?: boolean | null
          id?: string
          ios_app_store_url?: string | null
          latest_version?: string
          min_supported_version?: string | null
          release_notes?: string | null
          rollout_percentage?: number
          sha256?: string | null
          size_bytes?: number | null
        }
        Relationships: []
      }
      application_form_cache: {
        Row: {
          analyzed_data: Json | null
          created_at: string
          field_confidence: Json | null
          form_url: string | null
          id: string
          institution_id: string | null
          is_valid: boolean
          last_validated_at: string | null
          program_level: string
          scraped_at: string
          scraped_content: string | null
          semester: string
          source: string | null
          updated_at: string
          validation_status: string | null
          year: number
        }
        Insert: {
          analyzed_data?: Json | null
          created_at?: string
          field_confidence?: Json | null
          form_url?: string | null
          id?: string
          institution_id?: string | null
          is_valid?: boolean
          last_validated_at?: string | null
          program_level: string
          scraped_at?: string
          scraped_content?: string | null
          semester: string
          source?: string | null
          updated_at?: string
          validation_status?: string | null
          year: number
        }
        Update: {
          analyzed_data?: Json | null
          created_at?: string
          field_confidence?: Json | null
          form_url?: string | null
          id?: string
          institution_id?: string | null
          is_valid?: boolean
          last_validated_at?: string | null
          program_level?: string
          scraped_at?: string
          scraped_content?: string | null
          semester?: string
          source?: string | null
          updated_at?: string
          validation_status?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "application_form_cache_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_form_cache_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "application_form_cache_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_form_cache_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "application_form_cache_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "application_form_cache_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      application_form_changes: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          cache_id: string
          change_type: string
          detected_at: string
          field_name: string
          id: string
          institution_id: string | null
          new_value: string | null
          notes: string | null
          old_value: string | null
          severity: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          cache_id: string
          change_type: string
          detected_at?: string
          field_name: string
          id?: string
          institution_id?: string | null
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          severity?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          cache_id?: string
          change_type?: string
          detected_at?: string
          field_name?: string
          id?: string
          institution_id?: string | null
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_form_changes_cache_id_fkey"
            columns: ["cache_id"]
            isOneToOne: false
            referencedRelation: "application_form_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_form_changes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_form_changes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "application_form_changes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_form_changes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "application_form_changes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "application_form_changes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      application_form_validations: {
        Row: {
          cache_id: string
          discrepancies: Json | null
          field_confidence_scores: Json | null
          id: string
          institution_id: string | null
          overall_confidence: number
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          validated_at: string
          validation_type: string
        }
        Insert: {
          cache_id: string
          discrepancies?: Json | null
          field_confidence_scores?: Json | null
          id?: string
          institution_id?: string | null
          overall_confidence?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          validated_at?: string
          validation_type: string
        }
        Update: {
          cache_id?: string
          discrepancies?: Json | null
          field_confidence_scores?: Json | null
          id?: string
          institution_id?: string | null
          overall_confidence?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          validated_at?: string
          validation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_form_validations_cache_id_fkey"
            columns: ["cache_id"]
            isOneToOne: false
            referencedRelation: "application_form_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_form_validations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_form_validations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "application_form_validations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_form_validations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "application_form_validations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "application_form_validations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          decision: string | null
          decision_at: string | null
          id: string
          institution_id: string | null
          intake_id: string | null
          notes: string | null
          status: string
          status_history: Json | null
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision?: string | null
          decision_at?: string | null
          id?: string
          institution_id?: string | null
          intake_id?: string | null
          notes?: string | null
          status?: string
          status_history?: Json | null
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: string | null
          decision_at?: string | null
          id?: string
          institution_id?: string | null
          intake_id?: string | null
          notes?: string | null
          status?: string
          status_history?: Json | null
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "applications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "applications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "applications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "applications_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      call_analyses: {
        Row: {
          action_items: Json | null
          call_id: string
          created_at: string
          entities: Json | null
          follow_up_needed: boolean
          follow_up_reason: string | null
          id: string
          intent: string | null
          lead_id: string | null
          model: string | null
          promises: Json | null
          risk_flags: string[] | null
          sentiment: string | null
          student_id: string | null
          summary_en: string | null
          summary_uz: string | null
          topics: string[] | null
          updated_at: string
        }
        Insert: {
          action_items?: Json | null
          call_id: string
          created_at?: string
          entities?: Json | null
          follow_up_needed?: boolean
          follow_up_reason?: string | null
          id?: string
          intent?: string | null
          lead_id?: string | null
          model?: string | null
          promises?: Json | null
          risk_flags?: string[] | null
          sentiment?: string | null
          student_id?: string | null
          summary_en?: string | null
          summary_uz?: string | null
          topics?: string[] | null
          updated_at?: string
        }
        Update: {
          action_items?: Json | null
          call_id?: string
          created_at?: string
          entities?: Json | null
          follow_up_needed?: boolean
          follow_up_reason?: string | null
          id?: string
          intent?: string | null
          lead_id?: string | null
          model?: string | null
          promises?: Json | null
          risk_flags?: string[] | null
          sentiment?: string | null
          student_id?: string | null
          summary_en?: string | null
          summary_uz?: string | null
          topics?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_analyses_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analyses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analyses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "call_analyses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          call_type: string
          callee_id: string
          caller_id: string
          created_at: string
          ended_at: string | null
          id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          call_type?: string
          callee_id: string
          caller_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          call_type?: string
          callee_id?: string
          caller_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_signals: {
        Row: {
          created_at: string
          id: string
          sender_id: string
          session_id: string
          signal_data: Json
          signal_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          sender_id: string
          session_id: string
          signal_data: Json
          signal_type: string
        }
        Update: {
          created_at?: string
          id?: string
          sender_id?: string
          session_id?: string
          signal_data?: Json
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          call_id: string
          created_at: string
          full_text: string | null
          id: string
          language_code: string | null
          provider: string
          segments: Json | null
          updated_at: string
          word_count: number | null
        }
        Insert: {
          call_id: string
          created_at?: string
          full_text?: string | null
          id?: string
          language_code?: string | null
          provider?: string
          segments?: Json | null
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          call_id?: string
          created_at?: string
          full_text?: string | null
          id?: string
          language_code?: string | null
          provider?: string
          segments?: Json | null
          updated_at?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          created_at: string
          direction: string
          duration: number | null
          ended_at: string | null
          external_call_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          phone_number: string
          recording_url: string | null
          staff_id: string | null
          started_at: string
          status: string
          student_id: string | null
          updated_at: string
          voip_provider: string | null
        }
        Insert: {
          created_at?: string
          direction?: string
          duration?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          phone_number: string
          recording_url?: string | null
          staff_id?: string | null
          started_at?: string
          status?: string
          student_id?: string | null
          updated_at?: string
          voip_provider?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          duration?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          phone_number?: string
          recording_url?: string | null
          staff_id?: string | null
          started_at?: string
          status?: string
          student_id?: string | null
          updated_at?: string
          voip_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "calls_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
          {
            foreignKeyName: "calls_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "calls_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      change_event_outbox: {
        Row: {
          attempts: number
          event_type: string
          id: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          queued_at: string
          sent_at: string | null
          status: string
          target_id: string
          target_table: string
        }
        Insert: {
          attempts?: number
          event_type: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          queued_at?: string
          sent_at?: string | null
          status?: string
          target_id: string
          target_table: string
        }
        Update: {
          attempts?: number
          event_type?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          queued_at?: string
          sent_at?: string | null
          status?: string
          target_id?: string
          target_table?: string
        }
        Relationships: []
      }
      change_events: {
        Row: {
          detected_at: string
          entity_id: string
          entity_type: string
          field_name: string | null
          id: string
          new_value: Json | null
          notify_status: string
          notify_users_at: string | null
          old_value: Json | null
          reason: string | null
        }
        Insert: {
          detected_at?: string
          entity_id: string
          entity_type: string
          field_name?: string | null
          id?: string
          new_value?: Json | null
          notify_status?: string
          notify_users_at?: string | null
          old_value?: Json | null
          reason?: string | null
        }
        Update: {
          detected_at?: string
          entity_id?: string
          entity_type?: string
          field_name?: string | null
          id?: string
          new_value?: Json | null
          notify_status?: string
          notify_users_at?: string | null
          old_value?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      channel_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string | null
          id: string
          message_type: string | null
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "room_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_processing_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json | null
          ref_id: string
          ref_table: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json | null
          ref_id: string
          ref_table: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json | null
          ref_id?: string
          ref_table?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      communication_embeddings: {
        Row: {
          channel: string | null
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          source_id: string
          source_type: string
          student_id: string | null
        }
        Insert: {
          channel?: string | null
          chunk_index?: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          source_id: string
          source_type: string
          student_id?: string | null
        }
        Update: {
          channel?: string | null
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          source_id?: string
          source_type?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_embeddings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_embeddings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "communication_embeddings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      communication_identities: {
        Row: {
          attached_by: string | null
          channel: string
          confidence: string
          created_at: string
          display_name: string | null
          id: string
          identifier: string
          identifier_label: string | null
          lead_id: string | null
          notes: string | null
          source: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          attached_by?: string | null
          channel: string
          confidence?: string
          created_at?: string
          display_name?: string | null
          id?: string
          identifier: string
          identifier_label?: string | null
          lead_id?: string | null
          notes?: string | null
          source?: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          attached_by?: string | null
          channel?: string
          confidence?: string
          created_at?: string
          display_name?: string | null
          id?: string
          identifier?: string
          identifier_label?: string | null
          lead_id?: string | null
          notes?: string | null
          source?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_identities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_identities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "communication_identities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      crawl_findings: {
        Row: {
          announcement_id: string | null
          crawl_run_id: string | null
          details: Json | null
          detected_at: string
          finding_type: string | null
          id: string
        }
        Insert: {
          announcement_id?: string | null
          crawl_run_id?: string | null
          details?: Json | null
          detected_at?: string
          finding_type?: string | null
          id?: string
        }
        Update: {
          announcement_id?: string | null
          crawl_run_id?: string | null
          details?: Json | null
          detected_at?: string
          finding_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_findings_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_findings_crawl_run_id_fkey"
            columns: ["crawl_run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_runs: {
        Row: {
          ended_at: string | null
          error_text: string | null
          http_status_code: number | null
          id: string
          records_changed: number
          records_new: number
          records_seen: number
          source_id: string
          started_at: string
          status: string | null
        }
        Insert: {
          ended_at?: string | null
          error_text?: string | null
          http_status_code?: number | null
          id?: string
          records_changed?: number
          records_new?: number
          records_seen?: number
          source_id: string
          started_at?: string
          status?: string | null
        }
        Update: {
          ended_at?: string | null
          error_text?: string | null
          http_status_code?: number | null
          id?: string
          records_changed?: number
          records_new?: number
          records_seen?: number
          source_id?: string
          started_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "announcement_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_dates: {
        Row: {
          created_at: string
          cycle_id: string
          ends_at: string | null
          event_type: string
          extractor_confidence: number | null
          id: string
          is_tentative: boolean
          notes_ko: string | null
          recruitment_unit_id: string | null
          source_blob_hash: string | null
          source_text_ko: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          ends_at?: string | null
          event_type: string
          extractor_confidence?: number | null
          id?: string
          is_tentative?: boolean
          notes_ko?: string | null
          recruitment_unit_id?: string | null
          source_blob_hash?: string | null
          source_text_ko?: string | null
          starts_at: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          ends_at?: string | null
          event_type?: string
          extractor_confidence?: number | null
          id?: string
          is_tentative?: boolean
          notes_ko?: string | null
          recruitment_unit_id?: string | null
          source_blob_hash?: string | null
          source_text_ko?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_dates_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "admission_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_dates_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "cycle_dates_recruitment_unit_id_fkey"
            columns: ["recruitment_unit_id"]
            isOneToOne: false
            referencedRelation: "recruitment_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_dates_recruitment_unit_id_fkey"
            columns: ["recruitment_unit_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["recruitment_unit_id"]
          },
        ]
      }
      distribution_transfer_items: {
        Row: {
          created_at: string | null
          deducted_amount: number
          id: string
          percentage: number
          recipient_name: string
          transfer_id: string | null
        }
        Insert: {
          created_at?: string | null
          deducted_amount: number
          id?: string
          percentage: number
          recipient_name: string
          transfer_id?: string | null
        }
        Update: {
          created_at?: string | null
          deducted_amount?: number
          id?: string
          percentage?: number
          recipient_name?: string
          transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "distribution_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_transfers: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          total_amount: number
          transfer_month: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          total_amount: number
          transfer_month: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          total_amount?: number
          transfer_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      document_extractions: {
        Row: {
          created_at: string
          doc_type: string | null
          document_id: string
          full_text: string | null
          id: string
          key_fields: Json | null
          language: string | null
          model: string | null
          student_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          doc_type?: string | null
          document_id: string
          full_text?: string | null
          id?: string
          key_fields?: Json | null
          language?: string | null
          model?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          doc_type?: string | null
          document_id?: string
          full_text?: string | null
          id?: string
          key_fields?: Json | null
          language?: string | null
          model?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_extractions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_extractions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "document_extractions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      documents: {
        Row: {
          application_id: string | null
          created_at: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          intake_id: string | null
          name: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          intake_id?: string | null
          name: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          intake_id?: string | null
          name?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      documents_required: {
        Row: {
          applicant_category: string
          attention_reason: string | null
          country_specific: Json | null
          created_at: string
          cycle_id: string
          document_type: string
          id: string
          is_apostille_required: boolean
          is_required: boolean
          needs_attention: boolean
          notes_ko: string | null
          source_text_ko: string | null
        }
        Insert: {
          applicant_category: string
          attention_reason?: string | null
          country_specific?: Json | null
          created_at?: string
          cycle_id: string
          document_type: string
          id?: string
          is_apostille_required?: boolean
          is_required?: boolean
          needs_attention?: boolean
          notes_ko?: string | null
          source_text_ko?: string | null
        }
        Update: {
          applicant_category?: string
          attention_reason?: string | null
          country_specific?: Json | null
          created_at?: string
          cycle_id?: string
          document_type?: string
          id?: string
          is_apostille_required?: boolean
          is_required?: boolean
          needs_attention?: boolean
          notes_ko?: string | null
          source_text_ko?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_required_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "admission_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_required_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["cycle_id"]
          },
        ]
      }
      embedding_chunks: {
        Row: {
          chunk_meta: Json | null
          chunk_text_ko: string
          created_at: string
          embedding: string | null
          guideline_document_id: string | null
          id: string
          institution_id: string | null
        }
        Insert: {
          chunk_meta?: Json | null
          chunk_text_ko: string
          created_at?: string
          embedding?: string | null
          guideline_document_id?: string | null
          id?: string
          institution_id?: string | null
        }
        Update: {
          chunk_meta?: Json | null
          chunk_text_ko?: string
          created_at?: string
          embedding?: string | null
          guideline_document_id?: string | null
          id?: string
          institution_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embedding_chunks_guideline_document_id_fkey"
            columns: ["guideline_document_id"]
            isOneToOne: false
            referencedRelation: "guideline_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embedding_chunks_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embedding_chunks_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "embedding_chunks_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embedding_chunks_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "embedding_chunks_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "embedding_chunks_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string
          expense_date: string
          id: string
          linked_transaction_id: string | null
          notes: string | null
          payment_method: string | null
          recipient: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          expense_date?: string
          id?: string
          linked_transaction_id?: string | null
          notes?: string | null
          payment_method?: string | null
          recipient?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          expense_date?: string
          id?: string
          linked_transaction_id?: string | null
          notes?: string | null
          payment_method?: string | null
          recipient?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "expenses_linked_transaction_id_fkey"
            columns: ["linked_transaction_id"]
            isOneToOne: true
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_jobs: {
        Row: {
          accuracy_self_score: number | null
          archetype: string
          cost_usd: number | null
          ended_at: string | null
          error_text: string | null
          field_group: string
          guideline_document_id: string
          id: string
          input_tokens: number | null
          latency_ms: number | null
          llm_model: string | null
          llm_provider: string | null
          output_tokens: number | null
          parsed_output: Json | null
          raw_output: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          accuracy_self_score?: number | null
          archetype: string
          cost_usd?: number | null
          ended_at?: string | null
          error_text?: string | null
          field_group: string
          guideline_document_id: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          llm_model?: string | null
          llm_provider?: string | null
          output_tokens?: number | null
          parsed_output?: Json | null
          raw_output?: Json | null
          started_at?: string | null
          status?: string
        }
        Update: {
          accuracy_self_score?: number | null
          archetype?: string
          cost_usd?: number | null
          ended_at?: string | null
          error_text?: string | null
          field_group?: string
          guideline_document_id?: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          llm_model?: string | null
          llm_provider?: string | null
          output_tokens?: number | null
          parsed_output?: Json | null
          raw_output?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_jobs_guideline_document_id_fkey"
            columns: ["guideline_document_id"]
            isOneToOne: false
            referencedRelation: "guideline_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_audit_log: {
        Row: {
          after: Json | null
          before: Json | null
          changed_at: string
          changed_by: string | null
          id: string
          op: string
          row_id: string
          table_name: string
        }
        Insert: {
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          op: string
          row_id: string
          table_name: string
        }
        Update: {
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          op?: string
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      gks_designated_universities: {
        Row: {
          created_at: string
          gks_program_info_id: string
          id: string
          institution_id: string | null
          is_global_network: boolean | null
          is_rd: boolean | null
          is_uic: boolean | null
          slot_allocation: number | null
          university_type: string | null
        }
        Insert: {
          created_at?: string
          gks_program_info_id: string
          id?: string
          institution_id?: string | null
          is_global_network?: boolean | null
          is_rd?: boolean | null
          is_uic?: boolean | null
          slot_allocation?: number | null
          university_type?: string | null
        }
        Update: {
          created_at?: string
          gks_program_info_id?: string
          id?: string
          institution_id?: string | null
          is_global_network?: boolean | null
          is_rd?: boolean | null
          is_uic?: boolean | null
          slot_allocation?: number | null
          university_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gks_designated_universities_gks_program_info_id_fkey"
            columns: ["gks_program_info_id"]
            isOneToOne: false
            referencedRelation: "gks_program_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gks_designated_universities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gks_designated_universities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "gks_designated_universities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gks_designated_universities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "gks_designated_universities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "gks_designated_universities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      gks_program_info: {
        Row: {
          announcement_date: string | null
          application_end: string | null
          application_start: string | null
          benefits: Json | null
          contact_email: string | null
          created_at: string
          eligibility: Json | null
          id: string
          notes: string | null
          program_level: string
          result_date: string | null
          review_period_end: string | null
          review_period_start: string | null
          sub_track: string
          total_slots: number | null
          track_type: string
          updated_at: string
          year: number
        }
        Insert: {
          announcement_date?: string | null
          application_end?: string | null
          application_start?: string | null
          benefits?: Json | null
          contact_email?: string | null
          created_at?: string
          eligibility?: Json | null
          id?: string
          notes?: string | null
          program_level: string
          result_date?: string | null
          review_period_end?: string | null
          review_period_start?: string | null
          sub_track: string
          total_slots?: number | null
          track_type: string
          updated_at?: string
          year: number
        }
        Update: {
          announcement_date?: string | null
          application_end?: string | null
          application_start?: string | null
          benefits?: Json | null
          contact_email?: string | null
          created_at?: string
          eligibility?: Json | null
          id?: string
          notes?: string | null
          program_level?: string
          result_date?: string | null
          review_period_end?: string | null
          review_period_start?: string | null
          sub_track?: string
          total_slots?: number | null
          track_type?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      guideline_documents: {
        Row: {
          archetype: string | null
          fetched_at: string
          file_hash_sha256: string
          file_size_bytes: number | null
          http_etag: string | null
          http_last_modified: string | null
          id: string
          institution_id: string
          language: string
          last_checked_at: string | null
          mime_type: string | null
          parse_status: string
          parsed_version: number
          source_url_ko: string
          storage_path: string
          superseded_by_id: string | null
        }
        Insert: {
          archetype?: string | null
          fetched_at?: string
          file_hash_sha256: string
          file_size_bytes?: number | null
          http_etag?: string | null
          http_last_modified?: string | null
          id?: string
          institution_id: string
          language?: string
          last_checked_at?: string | null
          mime_type?: string | null
          parse_status?: string
          parsed_version?: number
          source_url_ko: string
          storage_path: string
          superseded_by_id?: string | null
        }
        Update: {
          archetype?: string | null
          fetched_at?: string
          file_hash_sha256?: string
          file_size_bytes?: number | null
          http_etag?: string | null
          http_last_modified?: string | null
          id?: string
          institution_id?: string
          language?: string
          last_checked_at?: string | null
          mime_type?: string | null
          parse_status?: string
          parsed_version?: number
          source_url_ko?: string
          storage_path?: string
          superseded_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guideline_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guideline_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "guideline_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guideline_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "guideline_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "guideline_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "guideline_documents_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "guideline_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      income_distribution_settings: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          percentage: number
          recipient_name: string
          recipient_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          percentage: number
          recipient_name: string
          recipient_type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          percentage?: number
          recipient_name?: string
          recipient_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      income_distributions: {
        Row: {
          base_amount: number
          created_at: string | null
          distributed_amount: number
          distribution_month: string
          id: string
          paid_at: string | null
          payment_id: string | null
          percentage: number
          recipient_id: string | null
          recipient_name: string
          status: string
        }
        Insert: {
          base_amount: number
          created_at?: string | null
          distributed_amount: number
          distribution_month: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          percentage: number
          recipient_id?: string | null
          recipient_name: string
          status?: string
        }
        Update: {
          base_amount?: number
          created_at?: string | null
          distributed_amount?: number
          distribution_month?: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          percentage?: number
          recipient_id?: string | null
          recipient_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_distributions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_distributions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "income_distribution_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          city_ko: string | null
          created_at: string
          display_names: Json
          id: string
          ieqas_status: string | null
          institution_type: string
          is_partner: boolean
          is_visible_on_map: boolean
          is_women_only: boolean
          kcue_code: string | null
          last_verified_at: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name_en: string | null
          name_ko: string
          name_ko_short: string | null
          primary_admissions_url_ko: string | null
          primary_domain: string
          region_code: string | null
          romanization: string | null
          source_blob_hash: string | null
          tier: number | null
          updated_at: string
          virtual_tour: Json | null
          walkaround_url: string | null
          wikidata_id: string | null
        }
        Insert: {
          city_ko?: string | null
          created_at?: string
          display_names?: Json
          id?: string
          ieqas_status?: string | null
          institution_type: string
          is_partner?: boolean
          is_visible_on_map?: boolean
          is_women_only?: boolean
          kcue_code?: string | null
          last_verified_at?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name_en?: string | null
          name_ko: string
          name_ko_short?: string | null
          primary_admissions_url_ko?: string | null
          primary_domain: string
          region_code?: string | null
          romanization?: string | null
          source_blob_hash?: string | null
          tier?: number | null
          updated_at?: string
          virtual_tour?: Json | null
          walkaround_url?: string | null
          wikidata_id?: string | null
        }
        Update: {
          city_ko?: string | null
          created_at?: string
          display_names?: Json
          id?: string
          ieqas_status?: string | null
          institution_type?: string
          is_partner?: boolean
          is_visible_on_map?: boolean
          is_women_only?: boolean
          kcue_code?: string | null
          last_verified_at?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name_en?: string | null
          name_ko?: string
          name_ko_short?: string | null
          primary_admissions_url_ko?: string | null
          primary_domain?: string
          region_code?: string | null
          romanization?: string | null
          source_blob_hash?: string | null
          tier?: number | null
          updated_at?: string
          virtual_tour?: Json | null
          walkaround_url?: string | null
          wikidata_id?: string | null
        }
        Relationships: []
      }
      intakes: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          is_open: boolean
          season: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_open?: boolean
          season: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_open?: boolean
          season?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      intercom_calls: {
        Row: {
          callee_id: string
          caller_id: string
          channel_name: string
          created_at: string | null
          ended_at: string | null
          id: string
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          callee_id: string
          caller_id: string
          channel_name: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          callee_id?: string
          caller_id?: string
          channel_name?: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      interview_feedback: {
        Row: {
          communication_score: number | null
          confidence_score: number | null
          content_score: number | null
          created_at: string
          detailed_feedback: string | null
          id: string
          improvements: Json | null
          language_score: number | null
          message_scores: Json | null
          overall_score: number | null
          session_id: string
          strengths: Json | null
        }
        Insert: {
          communication_score?: number | null
          confidence_score?: number | null
          content_score?: number | null
          created_at?: string
          detailed_feedback?: string | null
          id?: string
          improvements?: Json | null
          language_score?: number | null
          message_scores?: Json | null
          overall_score?: number | null
          session_id: string
          strengths?: Json | null
        }
        Update: {
          communication_score?: number | null
          confidence_score?: number | null
          content_score?: number | null
          created_at?: string
          detailed_feedback?: string | null
          id?: string
          improvements?: Json | null
          language_score?: number | null
          message_scores?: Json | null
          overall_score?: number | null
          session_id?: string
          strengths?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_messages: {
        Row: {
          audio_url: string | null
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          audio_url?: string | null
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          audio_url?: string | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_questions: {
        Row: {
          category: string
          created_at: string
          difficulty: string
          id: string
          institution_id: string | null
          is_active: boolean
          question_en: string | null
          question_ko: string
          question_ru: string | null
          question_uz: string | null
          sample_answer: string | null
          tips: string | null
        }
        Insert: {
          category: string
          created_at?: string
          difficulty?: string
          id?: string
          institution_id?: string | null
          is_active?: boolean
          question_en?: string | null
          question_ko: string
          question_ru?: string | null
          question_uz?: string | null
          sample_answer?: string | null
          tips?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          difficulty?: string
          id?: string
          institution_id?: string | null
          is_active?: boolean
          question_en?: string | null
          question_ko?: string
          question_ru?: string | null
          question_uz?: string | null
          sample_answer?: string | null
          tips?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_questions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_questions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "interview_questions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_questions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "interview_questions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "interview_questions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          focus_topic: string | null
          heygen_session_id: string | null
          id: string
          session_type: string
          started_at: string
          status: string
          student_id: string
          target_institution_id: string | null
          time_limit_seconds: number | null
          timed_mode: boolean | null
          vapi_call_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          focus_topic?: string | null
          heygen_session_id?: string | null
          id?: string
          session_type?: string
          started_at?: string
          status?: string
          student_id: string
          target_institution_id?: string | null
          time_limit_seconds?: number | null
          timed_mode?: boolean | null
          vapi_call_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          focus_topic?: string | null
          heygen_session_id?: string | null
          id?: string
          session_type?: string
          started_at?: string
          status?: string
          student_id?: string
          target_institution_id?: string | null
          time_limit_seconds?: number | null
          timed_mode?: boolean | null
          vapi_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_target_institution_id_fkey"
            columns: ["target_institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_sessions_target_institution_id_fkey"
            columns: ["target_institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "interview_sessions_target_institution_id_fkey"
            columns: ["target_institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_sessions_target_institution_id_fkey"
            columns: ["target_institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "interview_sessions_target_institution_id_fkey"
            columns: ["target_institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "interview_sessions_target_institution_id_fkey"
            columns: ["target_institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          ai_analysis: string | null
          contact_type: string | null
          contacted_at: string | null
          content: string
          created_at: string
          created_by: string
          duration_minutes: number | null
          id: string
          lead_id: string
          outcome: string | null
          updated_at: string
        }
        Insert: {
          ai_analysis?: string | null
          contact_type?: string | null
          contacted_at?: string | null
          content: string
          created_at?: string
          created_by: string
          duration_minutes?: number | null
          id?: string
          lead_id: string
          outcome?: string | null
          updated_at?: string
        }
        Update: {
          ai_analysis?: string | null
          contact_type?: string | null
          contacted_at?: string | null
          content?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number | null
          id?: string
          lead_id?: string
          outcome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_summary: string | null
          assigned_to: string | null
          birth_date: string | null
          budget_range: string | null
          city: string | null
          contract_date: string | null
          contract_number: string | null
          converted_to_student_id: string | null
          created_at: string
          created_by: string | null
          education_level: string | null
          email: string | null
          english_level: string | null
          enriched_at: string | null
          exam_date: string | null
          exam_type: string | null
          full_name: string
          how_heard: string | null
          id: string
          intake_id: string | null
          interest_level: string | null
          korean_level: string | null
          last_contacted_at: string | null
          login_count: number | null
          login_history: string[] | null
          next_follow_up: string | null
          notes: string | null
          password: string | null
          payment_plan: string | null
          phone: string | null
          preferred_program: string | null
          preferred_start_date: string | null
          preferred_university: string | null
          priority_score: number | null
          referred_by_student_id: string | null
          source: string
          source_id: string | null
          status: string
          target_intake: string | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          assigned_to?: string | null
          birth_date?: string | null
          budget_range?: string | null
          city?: string | null
          contract_date?: string | null
          contract_number?: string | null
          converted_to_student_id?: string | null
          created_at?: string
          created_by?: string | null
          education_level?: string | null
          email?: string | null
          english_level?: string | null
          enriched_at?: string | null
          exam_date?: string | null
          exam_type?: string | null
          full_name: string
          how_heard?: string | null
          id?: string
          intake_id?: string | null
          interest_level?: string | null
          korean_level?: string | null
          last_contacted_at?: string | null
          login_count?: number | null
          login_history?: string[] | null
          next_follow_up?: string | null
          notes?: string | null
          password?: string | null
          payment_plan?: string | null
          phone?: string | null
          preferred_program?: string | null
          preferred_start_date?: string | null
          preferred_university?: string | null
          priority_score?: number | null
          referred_by_student_id?: string | null
          source?: string
          source_id?: string | null
          status?: string
          target_intake?: string | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          assigned_to?: string | null
          birth_date?: string | null
          budget_range?: string | null
          city?: string | null
          contract_date?: string | null
          contract_number?: string | null
          converted_to_student_id?: string | null
          created_at?: string
          created_by?: string | null
          education_level?: string | null
          email?: string | null
          english_level?: string | null
          enriched_at?: string | null
          exam_date?: string | null
          exam_type?: string | null
          full_name?: string
          how_heard?: string | null
          id?: string
          intake_id?: string | null
          interest_level?: string | null
          korean_level?: string | null
          last_contacted_at?: string | null
          login_count?: number | null
          login_history?: string[] | null
          next_follow_up?: string | null
          notes?: string | null
          password?: string | null
          payment_plan?: string | null
          phone?: string | null
          preferred_program?: string | null
          preferred_start_date?: string | null
          preferred_university?: string | null
          priority_score?: number | null
          referred_by_student_id?: string | null
          source?: string
          source_id?: string | null
          status?: string
          target_intake?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referred_by_student_id_fkey"
            columns: ["referred_by_student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      legacy_scholarships: {
        Row: {
          amount_description: string | null
          amount_krw: number | null
          application_deadline: string | null
          application_url: string | null
          coverage: string | null
          created_at: string | null
          description: string | null
          description_en: string | null
          description_ko: string | null
          description_ru: string | null
          description_uz: string | null
          eligibility_criteria: Json | null
          id: string
          institution_id: string | null
          is_active: boolean | null
          language_track: string | null
          name: string
          name_en: string | null
          name_ko: string | null
          name_ru: string | null
          name_uz: string | null
          program_level: string | null
          required_documents: string[] | null
          scholarship_type: string
          updated_at: string | null
        }
        Insert: {
          amount_description?: string | null
          amount_krw?: number | null
          application_deadline?: string | null
          application_url?: string | null
          coverage?: string | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_ko?: string | null
          description_ru?: string | null
          description_uz?: string | null
          eligibility_criteria?: Json | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          language_track?: string | null
          name: string
          name_en?: string | null
          name_ko?: string | null
          name_ru?: string | null
          name_uz?: string | null
          program_level?: string | null
          required_documents?: string[] | null
          scholarship_type?: string
          updated_at?: string | null
        }
        Update: {
          amount_description?: string | null
          amount_krw?: number | null
          application_deadline?: string | null
          application_url?: string | null
          coverage?: string | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_ko?: string | null
          description_ru?: string | null
          description_uz?: string | null
          eligibility_criteria?: Json | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          language_track?: string | null
          name?: string
          name_en?: string | null
          name_ko?: string | null
          name_ru?: string | null
          name_uz?: string | null
          program_level?: string | null
          required_documents?: string[] | null
          scholarship_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_scholarships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_scholarships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "legacy_scholarships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_scholarships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "legacy_scholarships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "legacy_scholarships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      mentions: {
        Row: {
          content_preview: string | null
          context_id: string
          context_type: string
          created_at: string
          id: string
          mentioned_by: string
          mentioned_user_id: string
          read_at: string | null
        }
        Insert: {
          content_preview?: string | null
          context_id: string
          context_type: string
          created_at?: string
          id?: string
          mentioned_by: string
          mentioned_user_id: string
          read_at?: string | null
        }
        Update: {
          content_preview?: string | null
          context_id?: string
          context_type?: string
          created_at?: string
          id?: string
          mentioned_by?: string
          mentioned_user_id?: string
          read_at?: string | null
        }
        Relationships: []
      }
      message_threads: {
        Row: {
          created_at: string
          id: string
          intake_id: string | null
          last_message_at: string
          sender_avatar: string | null
          sender_id: string
          sender_name: string | null
          source: string
          status: string
          student_id: string | null
          unread_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          intake_id?: string | null
          last_message_at?: string
          sender_avatar?: string | null
          sender_id: string
          sender_name?: string | null
          source: string
          status?: string
          student_id?: string | null
          unread_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          intake_id?: string | null
          last_message_at?: string
          sender_avatar?: string | null
          sender_id?: string
          sender_name?: string | null
          source?: string
          status?: string
          student_id?: string | null
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          assigned_to: string | null
          content: string
          created_at: string
          direction: string
          external_id: string | null
          id: string
          message_type: string
          metadata: Json | null
          replied_at: string | null
          replied_by: string | null
          sender_avatar: string | null
          sender_id: string | null
          sender_name: string | null
          source: string
          status: string
          student_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          content: string
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          replied_at?: string | null
          replied_by?: string | null
          sender_avatar?: string | null
          sender_id?: string | null
          sender_name?: string | null
          source: string
          status?: string
          student_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          content?: string
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          replied_at?: string | null
          replied_by?: string | null
          sender_avatar?: string | null
          sender_id?: string | null
          sender_name?: string | null
          source?: string
          status?: string
          student_id?: string | null
        }
        Relationships: []
      }
      monthly_payment_categories: {
        Row: {
          amount: number
          category_type: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          recipient_name: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category_type?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          recipient_name?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_type?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          recipient_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      operational_fund_allocations: {
        Row: {
          allocated_amount: number
          allocation_month: string
          category_id: string | null
          created_at: string
          id: string
          payment_id: string | null
          status: string
          student_id: string
        }
        Insert: {
          allocated_amount?: number
          allocation_month: string
          category_id?: string | null
          created_at?: string
          id?: string
          payment_id?: string | null
          status?: string
          student_id: string
        }
        Update: {
          allocated_amount?: number
          allocation_month?: string
          category_id?: string | null
          created_at?: string
          id?: string
          payment_id?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_fund_allocations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "monthly_payment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_fund_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_fund_settings: {
        Row: {
          amount_per_student: number
          currency: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_per_student?: number
          currency?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_per_student?: number
          currency?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_fund_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          gateway_fee: number | null
          id: string
          notes: string | null
          payment_id: string
          payment_method: string | null
          receipt_url: string | null
          receipt_urls: string[] | null
          transaction_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          gateway_fee?: number | null
          id?: string
          notes?: string | null
          payment_id: string
          payment_method?: string | null
          receipt_url?: string | null
          receipt_urls?: string[] | null
          transaction_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          gateway_fee?: number | null
          id?: string
          notes?: string | null
          payment_id?: string
          payment_method?: string | null
          receipt_url?: string | null
          receipt_urls?: string[] | null
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          application_id: string | null
          created_at: string
          currency: string
          due_date: string | null
          id: string
          intake_id: string | null
          invoice_number: string | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          payment_type: string
          receipt_url: string | null
          receipt_urls: string[] | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          application_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          intake_id?: string | null
          invoice_number?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_type: string
          receipt_url?: string | null
          receipt_urls?: string[] | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          application_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          intake_id?: string | null
          invoice_number?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_type?: string
          receipt_url?: string | null
          receipt_urls?: string[] | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      pdf_access_log: {
        Row: {
          bucket: string | null
          expires_at: string | null
          granted_at: string
          guideline_document_id: string | null
          id: string
          ip_address: unknown
          reason: string | null
          signed_url_ttl_sec: number
          storage_path: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          bucket?: string | null
          expires_at?: string | null
          granted_at?: string
          guideline_document_id?: string | null
          id?: string
          ip_address?: unknown
          reason?: string | null
          signed_url_ttl_sec?: number
          storage_path: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          bucket?: string | null
          expires_at?: string | null
          granted_at?: string
          guideline_document_id?: string | null
          id?: string
          ip_address?: unknown
          reason?: string | null
          signed_url_ttl_sec?: number
          storage_path?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdf_access_log_guideline_document_id_fkey"
            columns: ["guideline_document_id"]
            isOneToOne: false
            referencedRelation: "guideline_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_access_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      peer_review_queue: {
        Row: {
          document_type: string
          draft_id: string | null
          id: string
          institution_id: string | null
          is_matched: boolean | null
          language: string | null
          submitted_at: string | null
        }
        Insert: {
          document_type: string
          draft_id?: string | null
          id?: string
          institution_id?: string | null
          is_matched?: boolean | null
          language?: string | null
          submitted_at?: string | null
        }
        Update: {
          document_type?: string
          draft_id?: string | null
          id?: string
          institution_id?: string | null
          is_matched?: boolean | null
          language?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "peer_review_queue_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "study_plan_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_review_queue_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_review_queue_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "peer_review_queue_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_review_queue_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "peer_review_queue_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "peer_review_queue_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      peer_reviews: {
        Row: {
          anonymous_name: string | null
          author_id: string
          completed_at: string | null
          created_at: string | null
          draft_id: string | null
          expires_at: string | null
          id: string
          improvements: string[] | null
          rating: number | null
          review_feedback: string | null
          reviewer_id: string | null
          status: string | null
          strengths: string[] | null
        }
        Insert: {
          anonymous_name?: string | null
          author_id: string
          completed_at?: string | null
          created_at?: string | null
          draft_id?: string | null
          expires_at?: string | null
          id?: string
          improvements?: string[] | null
          rating?: number | null
          review_feedback?: string | null
          reviewer_id?: string | null
          status?: string | null
          strengths?: string[] | null
        }
        Update: {
          anonymous_name?: string | null
          author_id?: string
          completed_at?: string | null
          created_at?: string | null
          draft_id?: string | null
          expires_at?: string | null
          id?: string
          improvements?: string[] | null
          rating?: number | null
          review_feedback?: string | null
          reviewer_id?: string | null
          status?: string | null
          strengths?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "peer_reviews_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "study_plan_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          additional_phone: string | null
          avatar_url: string | null
          birth_date: string | null
          city: string | null
          contract_date: string | null
          contract_url: string | null
          created_at: string
          dob: string | null
          full_name: string | null
          id: string
          ielts_score: number | null
          is_gks_applicant: boolean | null
          korean_region_preference: string | null
          language_track: string | null
          magic_code: string | null
          marketing_consent: boolean
          marketing_consent_at: string | null
          notes: string | null
          office_location: string | null
          parental_consent: boolean
          parental_email: string | null
          payment_mode: string | null
          payment_plan: string | null
          phone: string | null
          preferred_language: string | null
          role: string | null
          sip1_label: string | null
          sip1_password: string | null
          sip1_port: string | null
          sip1_server: string | null
          sip1_user: string | null
          sip2_label: string | null
          sip2_password: string | null
          sip2_port: string | null
          sip2_server: string | null
          sip2_user: string | null
          status: string | null
          study_work_priority: string | null
          topik_level: number | null
          university_notes: string | null
          university_selection_status:
            | Database["public"]["Enums"]["university_selection_status"]
            | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          additional_phone?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          contract_date?: string | null
          contract_url?: string | null
          created_at?: string
          dob?: string | null
          full_name?: string | null
          id?: string
          ielts_score?: number | null
          is_gks_applicant?: boolean | null
          korean_region_preference?: string | null
          language_track?: string | null
          magic_code?: string | null
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          notes?: string | null
          office_location?: string | null
          parental_consent?: boolean
          parental_email?: string | null
          payment_mode?: string | null
          payment_plan?: string | null
          phone?: string | null
          preferred_language?: string | null
          role?: string | null
          sip1_label?: string | null
          sip1_password?: string | null
          sip1_port?: string | null
          sip1_server?: string | null
          sip1_user?: string | null
          sip2_label?: string | null
          sip2_password?: string | null
          sip2_port?: string | null
          sip2_server?: string | null
          sip2_user?: string | null
          status?: string | null
          study_work_priority?: string | null
          topik_level?: number | null
          university_notes?: string | null
          university_selection_status?:
            | Database["public"]["Enums"]["university_selection_status"]
            | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          additional_phone?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          contract_date?: string | null
          contract_url?: string | null
          created_at?: string
          dob?: string | null
          full_name?: string | null
          id?: string
          ielts_score?: number | null
          is_gks_applicant?: boolean | null
          korean_region_preference?: string | null
          language_track?: string | null
          magic_code?: string | null
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          notes?: string | null
          office_location?: string | null
          parental_consent?: boolean
          parental_email?: string | null
          payment_mode?: string | null
          payment_plan?: string | null
          phone?: string | null
          preferred_language?: string | null
          role?: string | null
          sip1_label?: string | null
          sip1_password?: string | null
          sip1_port?: string | null
          sip1_server?: string | null
          sip1_user?: string | null
          sip2_label?: string | null
          sip2_password?: string | null
          sip2_port?: string | null
          sip2_server?: string | null
          sip2_user?: string | null
          status?: string | null
          study_work_priority?: string | null
          topik_level?: number | null
          university_notes?: string | null
          university_selection_status?:
            | Database["public"]["Enums"]["university_selection_status"]
            | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          data_go_kr_dept_code: string | null
          degree_level: string
          duration_years: number | null
          id: string
          institution_id: string
          language_of_instruction: string[]
          name_ko: string
          source_text_ko: string | null
        }
        Insert: {
          created_at?: string
          data_go_kr_dept_code?: string | null
          degree_level: string
          duration_years?: number | null
          id?: string
          institution_id: string
          language_of_instruction?: string[]
          name_ko: string
          source_text_ko?: string | null
        }
        Update: {
          created_at?: string
          data_go_kr_dept_code?: string | null
          degree_level?: string
          duration_years?: number | null
          id?: string
          institution_id?: string
          language_of_instruction?: string[]
          name_ko?: string
          source_text_ko?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      proposed_sources: {
        Row: {
          candidate_snippet: string | null
          candidate_title: string | null
          id: string
          matched_keywords: string[] | null
          promoted_to_id: string | null
          proposed_at: string
          proposed_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_type: string
          status: string
          url_ko: string
        }
        Insert: {
          candidate_snippet?: string | null
          candidate_title?: string | null
          id?: string
          matched_keywords?: string[] | null
          promoted_to_id?: string | null
          proposed_at?: string
          proposed_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type: string
          status?: string
          url_ko: string
        }
        Update: {
          candidate_snippet?: string | null
          candidate_title?: string | null
          id?: string
          matched_keywords?: string[] | null
          promoted_to_id?: string | null
          proposed_at?: string
          proposed_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type?: string
          status?: string
          url_ko?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposed_sources_promoted_to_id_fkey"
            columns: ["promoted_to_id"]
            isOneToOne: false
            referencedRelation: "announcement_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_sources_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      recruitment_unit_programs: {
        Row: {
          program_id: string
          recruitment_unit_id: string
        }
        Insert: {
          program_id: string
          recruitment_unit_id: string
        }
        Update: {
          program_id?: string
          recruitment_unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_unit_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_unit_programs_recruitment_unit_id_fkey"
            columns: ["recruitment_unit_id"]
            isOneToOne: false
            referencedRelation: "recruitment_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_unit_programs_recruitment_unit_id_fkey"
            columns: ["recruitment_unit_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["recruitment_unit_id"]
          },
        ]
      }
      recruitment_units: {
        Row: {
          campus: string | null
          created_at: string
          department_ko: string | null
          division_ko: string | null
          external_code: string | null
          faculty_group: string | null
          faculty_ko: string | null
          id: string
          institution_id: string
          is_active: boolean
          major_track_ko: string | null
          source_text_ko: string | null
          updated_at: string
        }
        Insert: {
          campus?: string | null
          created_at?: string
          department_ko?: string | null
          division_ko?: string | null
          external_code?: string | null
          faculty_group?: string | null
          faculty_ko?: string | null
          id?: string
          institution_id: string
          is_active?: boolean
          major_track_ko?: string | null
          source_text_ko?: string | null
          updated_at?: string
        }
        Update: {
          campus?: string | null
          created_at?: string
          department_ko?: string | null
          division_ko?: string | null
          external_code?: string | null
          faculty_group?: string | null
          faculty_ko?: string | null
          id?: string
          institution_id?: string
          is_active?: boolean
          major_track_ko?: string | null
          source_text_ko?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_units_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_units_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "recruitment_units_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_units_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "recruitment_units_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "recruitment_units_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      requirements: {
        Row: {
          age_max: number | null
          age_min: number | null
          applicant_category: string
          attention_reason: string | null
          created_at: string
          cycle_id: string
          english_test: Json | null
          extractor_confidence: number | null
          gpa_floor_pct: number | null
          hs_grad_by: string | null
          id: string
          interview_required: boolean
          needs_attention: boolean
          practical_exam_required: boolean
          prose_ko: string | null
          recruitment_unit_id: string | null
          source_text_ko: string | null
          topik_deferred: boolean
          topik_min_level: number | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          applicant_category: string
          attention_reason?: string | null
          created_at?: string
          cycle_id: string
          english_test?: Json | null
          extractor_confidence?: number | null
          gpa_floor_pct?: number | null
          hs_grad_by?: string | null
          id?: string
          interview_required?: boolean
          needs_attention?: boolean
          practical_exam_required?: boolean
          prose_ko?: string | null
          recruitment_unit_id?: string | null
          source_text_ko?: string | null
          topik_deferred?: boolean
          topik_min_level?: number | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          applicant_category?: string
          attention_reason?: string | null
          created_at?: string
          cycle_id?: string
          english_test?: Json | null
          extractor_confidence?: number | null
          gpa_floor_pct?: number | null
          hs_grad_by?: string | null
          id?: string
          interview_required?: boolean
          needs_attention?: boolean
          practical_exam_required?: boolean
          prose_ko?: string | null
          recruitment_unit_id?: string | null
          source_text_ko?: string | null
          topik_deferred?: boolean
          topik_min_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "requirements_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "admission_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirements_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "requirements_recruitment_unit_id_fkey"
            columns: ["recruitment_unit_id"]
            isOneToOne: false
            referencedRelation: "recruitment_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirements_recruitment_unit_id_fkey"
            columns: ["recruitment_unit_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["recruitment_unit_id"]
          },
        ]
      }
      review_decisions: {
        Row: {
          decided_at: string
          decision: string
          field_diffs: Json | null
          id: string
          review_queue_id: string
          reviewer_id: string
          reviewer_notes: string | null
        }
        Insert: {
          decided_at?: string
          decision: string
          field_diffs?: Json | null
          id?: string
          review_queue_id: string
          reviewer_id: string
          reviewer_notes?: string | null
        }
        Update: {
          decided_at?: string
          decision?: string
          field_diffs?: Json | null
          id?: string
          review_queue_id?: string
          reviewer_id?: string
          reviewer_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_decisions_review_queue_id_fkey"
            columns: ["review_queue_id"]
            isOneToOne: false
            referencedRelation: "review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_decisions_review_queue_id_fkey"
            columns: ["review_queue_id"]
            isOneToOne: false
            referencedRelation: "v_review_queue_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_decisions_review_queue_id_fkey"
            columns: ["review_queue_id"]
            isOneToOne: false
            referencedRelation: "v_review_queue_overdue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_decisions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      review_queue: {
        Row: {
          assigned_to: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          needs_attention: boolean
          priority: number
          published_at: string | null
          published_outcome: string | null
          reason: string
          resolved_at: string | null
          reviewer_decision: Json | null
          reviewer_notes: string | null
          status: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          needs_attention?: boolean
          priority?: number
          published_at?: string | null
          published_outcome?: string | null
          reason: string
          resolved_at?: string | null
          reviewer_decision?: Json | null
          reviewer_notes?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          needs_attention?: boolean
          priority?: number
          published_at?: string | null
          published_outcome?: string | null
          reason?: string
          resolved_at?: string | null
          reviewer_decision?: Json | null
          reviewer_notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_queue_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      room_channels: {
        Row: {
          channel_type: string
          created_at: string | null
          id: string
          name_en: string | null
          name_ko: string | null
          name_ru: string | null
          name_uz: string
          room_id: string
        }
        Insert: {
          channel_type: string
          created_at?: string | null
          id?: string
          name_en?: string | null
          name_ko?: string | null
          name_ru?: string | null
          name_uz: string
          room_id: string
        }
        Update: {
          channel_type?: string
          created_at?: string | null
          id?: string
          name_en?: string | null
          name_ko?: string | null
          name_ru?: string | null
          name_uz?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_channels_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "university_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_members: {
        Row: {
          id: string
          joined_at: string | null
          role: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          role?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          role?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "university_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          intake_id: string | null
          linked_payment_id: string | null
          notes: string | null
          payment_type: string
          scheduled_date: string | null
          status: string
          student_id: string
          trigger_application_id: string | null
          trigger_type: string
          triggered_at: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          id?: string
          intake_id?: string | null
          linked_payment_id?: string | null
          notes?: string | null
          payment_type: string
          scheduled_date?: string | null
          status?: string
          student_id: string
          trigger_application_id?: string | null
          trigger_type: string
          triggered_at?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          intake_id?: string | null
          linked_payment_id?: string | null
          notes?: string | null
          payment_type?: string
          scheduled_date?: string | null
          status?: string
          student_id?: string
          trigger_application_id?: string | null
          trigger_type?: string
          triggered_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_payments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_payments_linked_payment_id_fkey"
            columns: ["linked_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "scheduled_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
          {
            foreignKeyName: "scheduled_payments_trigger_application_id_fkey"
            columns: ["trigger_application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarships: {
        Row: {
          applicant_categories: string[] | null
          attention_reason: string | null
          award_type: string
          award_value: number | null
          created_at: string
          eligibility_predicate: Json | null
          extractor_confidence: number | null
          id: string
          ielts_tier_table: Json | null
          institution_id: string | null
          name_en: string | null
          name_ko: string
          needs_attention: boolean
          prose_ko: string | null
          scope: string
          source_blob_hash: string | null
          source_text_ko: string | null
          topik_tier_table: Json | null
        }
        Insert: {
          applicant_categories?: string[] | null
          attention_reason?: string | null
          award_type: string
          award_value?: number | null
          created_at?: string
          eligibility_predicate?: Json | null
          extractor_confidence?: number | null
          id?: string
          ielts_tier_table?: Json | null
          institution_id?: string | null
          name_en?: string | null
          name_ko: string
          needs_attention?: boolean
          prose_ko?: string | null
          scope: string
          source_blob_hash?: string | null
          source_text_ko?: string | null
          topik_tier_table?: Json | null
        }
        Update: {
          applicant_categories?: string[] | null
          attention_reason?: string | null
          award_type?: string
          award_value?: number | null
          created_at?: string
          eligibility_predicate?: Json | null
          extractor_confidence?: number | null
          id?: string
          ielts_tier_table?: Json | null
          institution_id?: string | null
          name_en?: string | null
          name_ko?: string
          needs_attention?: boolean
          prose_ko?: string | null
          scope?: string
          source_blob_hash?: string | null
          source_text_ko?: string | null
          topik_tier_table?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "scholarships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "scholarships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "scholarships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      search_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          progress: Json | null
          request: Json
          result: Json | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          progress?: Json | null
          request?: Json
          result?: Json | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          progress?: Json | null
          request?: Json
          result?: Json | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_bonuses: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          bonus_amount: number
          created_at: string
          currency: string
          id: string
          month_year: string | null
          notes: string | null
          paid_at: string | null
          plan_type: string
          staff_user_id: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          bonus_amount: number
          created_at?: string
          currency?: string
          id?: string
          month_year?: string | null
          notes?: string | null
          paid_at?: string | null
          plan_type: string
          staff_user_id?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          bonus_amount?: number
          created_at?: string
          currency?: string
          id?: string
          month_year?: string | null
          notes?: string | null
          paid_at?: string | null
          plan_type?: string
          staff_user_id?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_password_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_password_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "staff_password_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      staff_presence: {
        Row: {
          id: string
          last_seen: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          last_seen?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          last_seen?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      student_achievements: {
        Row: {
          achievement_data: Json | null
          achievement_type: string
          earned_at: string | null
          id: string
          student_id: string
        }
        Insert: {
          achievement_data?: Json | null
          achievement_type: string
          earned_at?: string | null
          id?: string
          student_id: string
        }
        Update: {
          achievement_data?: Json | null
          achievement_type?: string
          earned_at?: string | null
          id?: string
          student_id?: string
        }
        Relationships: []
      }
      student_budgets: {
        Row: {
          allocated_amount: number | null
          allocated_from_payment_id: string | null
          category: string | null
          created_at: string | null
          currency: string | null
          id: string
          intake_id: string | null
          notes: string | null
          spent_amount: number | null
          status: string | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          allocated_amount?: number | null
          allocated_from_payment_id?: string | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          intake_id?: string | null
          notes?: string | null
          spent_amount?: number | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          allocated_amount?: number | null
          allocated_from_payment_id?: string | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          intake_id?: string | null
          notes?: string | null
          spent_amount?: number | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_budgets_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_budgets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "student_budgets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      student_comments: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          student_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          student_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_comments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "student_comments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      student_intakes: {
        Row: {
          created_at: string
          id: string
          intake_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intake_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intake_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_intakes_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
        ]
      }
      student_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      student_suggestions: {
        Row: {
          created_at: string
          id: string
          institution_id: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_suggestions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_suggestions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_suggestions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_suggestions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_suggestions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_suggestions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_suggestions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "student_suggestions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      student_university_priorities: {
        Row: {
          created_at: string
          custom_university_name: string | null
          id: string
          institution_id: string | null
          is_selected: boolean | null
          search_query: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          custom_university_name?: string | null
          id?: string
          institution_id?: string | null
          is_selected?: boolean | null
          search_query?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          custom_university_name?: string | null
          id?: string
          institution_id?: string | null
          is_selected?: boolean | null
          search_query?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_university_priorities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_university_priorities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_university_priorities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_university_priorities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_university_priorities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_university_priorities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_university_priorities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "student_university_priorities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      student_university_priority_comments: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          priority_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          priority_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          priority_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_university_priority_comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "student_university_priority_comments_priority_id_fkey"
            columns: ["priority_id"]
            isOneToOne: false
            referencedRelation: "student_university_priorities"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plan_analyses: {
        Row: {
          ai_response: string | null
          content_feedback: string | null
          created_at: string
          draft_id: string
          grammar_errors: Json | null
          id: string
          improvements: Json | null
          overall_score: number | null
          session_id: string
          strengths: Json | null
        }
        Insert: {
          ai_response?: string | null
          content_feedback?: string | null
          created_at?: string
          draft_id: string
          grammar_errors?: Json | null
          id?: string
          improvements?: Json | null
          overall_score?: number | null
          session_id: string
          strengths?: Json | null
        }
        Update: {
          ai_response?: string | null
          content_feedback?: string | null
          created_at?: string
          draft_id?: string
          grammar_errors?: Json | null
          id?: string
          improvements?: Json | null
          overall_score?: number | null
          session_id?: string
          strengths?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_analyses_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "study_plan_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plan_analyses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_plan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plan_chat_history: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_chat_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_plan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plan_drafts: {
        Row: {
          content: string
          created_at: string
          file_name: string | null
          id: string
          session_id: string
          source: string
          student_id: string
          version: number
          word_count: number | null
        }
        Insert: {
          content: string
          created_at?: string
          file_name?: string | null
          id?: string
          session_id: string
          source?: string
          student_id: string
          version?: number
          word_count?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          file_name?: string | null
          id?: string
          session_id?: string
          source?: string
          student_id?: string
          version?: number
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_drafts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_plan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plan_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          document_type: string
          id: string
          selected_track: string | null
          started_at: string
          status: string
          student_id: string
          target_institution_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          document_type: string
          id?: string
          selected_track?: string | null
          started_at?: string
          status?: string
          student_id: string
          target_institution_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          document_type?: string
          id?: string
          selected_track?: string | null
          started_at?: string
          status?: string
          student_id?: string
          target_institution_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_sessions_target_institution_id_fkey"
            columns: ["target_institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plan_sessions_target_institution_id_fkey"
            columns: ["target_institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "study_plan_sessions_target_institution_id_fkey"
            columns: ["target_institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plan_sessions_target_institution_id_fkey"
            columns: ["target_institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "study_plan_sessions_target_institution_id_fkey"
            columns: ["target_institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "study_plan_sessions_target_institution_id_fkey"
            columns: ["target_institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      system_map_connections: {
        Row: {
          color: string | null
          created_at: string
          dashed: boolean
          from_node: string
          id: string
          opacity: number
          to_node: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          dashed?: boolean
          from_node: string
          id?: string
          opacity?: number
          to_node: string
        }
        Update: {
          color?: string | null
          created_at?: string
          dashed?: boolean
          from_node?: string
          id?: string
          opacity?: number
          to_node?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_map_connections_from_node_fkey"
            columns: ["from_node"]
            isOneToOne: false
            referencedRelation: "system_map_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_map_connections_to_node_fkey"
            columns: ["to_node"]
            isOneToOne: false
            referencedRelation: "system_map_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      system_map_nodes: {
        Row: {
          color: string
          created_at: string
          id: string
          label: string
          ring: number
          sector: number
          text_color: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id: string
          label: string
          ring: number
          sector?: number
          text_color?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          label?: string
          ring?: number
          sector?: number
          text_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          owner_created: boolean
          signup_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_created?: boolean
          signup_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_created?: boolean
          signup_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          application_id: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          external_task_id: string | null
          id: string
          intake_id: string | null
          priority: string
          source: string
          status: string
          student_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          external_task_id?: string | null
          id?: string
          intake_id?: string | null
          priority?: string
          source?: string
          status?: string
          student_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          external_task_id?: string | null
          id?: string
          intake_id?: string | null
          priority?: string
          source?: string
          status?: string
          student_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
        ]
      }
      term_glossary: {
        Row: {
          authoritative: boolean
          category: string | null
          created_at: string
          id: string
          term_ko: string
          term_lang: string
          term_value: string
        }
        Insert: {
          authoritative?: boolean
          category?: string | null
          created_at?: string
          id?: string
          term_ko: string
          term_lang: string
          term_value: string
        }
        Update: {
          authoritative?: boolean
          category?: string | null
          created_at?: string
          id?: string
          term_ko?: string
          term_lang?: string
          term_value?: string
        }
        Relationships: []
      }
      translation_document_types: {
        Row: {
          code: string
          created_at: string
          description_en: string | null
          description_ru: string | null
          description_uz: string | null
          id: string
          is_active: boolean
          name_en: string | null
          name_ko: string | null
          name_ru: string | null
          name_uz: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description_en?: string | null
          description_ru?: string | null
          description_uz?: string | null
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_ko?: string | null
          name_ru?: string | null
          name_uz: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description_en?: string | null
          description_ru?: string | null
          description_uz?: string | null
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_ko?: string | null
          name_ru?: string | null
          name_uz?: string
          updated_at?: string
        }
        Relationships: []
      }
      translation_jobs: {
        Row: {
          auto_triggered: boolean
          completed_at: string | null
          created_at: string
          document_type_id: string
          error_message: string | null
          id: string
          output_docx_path: string | null
          output_pdf_path: string | null
          requested_by: string | null
          source_document_id: string | null
          source_file_path: string
          status: string
          structured_translation: Json | null
          student_id: string
          supporting_documents: Json | null
          translated_file_path: string | null
          translated_text: string | null
          updated_at: string
          verified_names: Json | null
        }
        Insert: {
          auto_triggered?: boolean
          completed_at?: string | null
          created_at?: string
          document_type_id: string
          error_message?: string | null
          id?: string
          output_docx_path?: string | null
          output_pdf_path?: string | null
          requested_by?: string | null
          source_document_id?: string | null
          source_file_path: string
          status?: string
          structured_translation?: Json | null
          student_id: string
          supporting_documents?: Json | null
          translated_file_path?: string | null
          translated_text?: string | null
          updated_at?: string
          verified_names?: Json | null
        }
        Update: {
          auto_triggered?: boolean
          completed_at?: string | null
          created_at?: string
          document_type_id?: string
          error_message?: string | null
          id?: string
          output_docx_path?: string | null
          output_pdf_path?: string | null
          requested_by?: string | null
          source_document_id?: string | null
          source_file_path?: string
          status?: string
          structured_translation?: Json | null
          student_id?: string
          supporting_documents?: Json | null
          translated_file_path?: string | null
          translated_text?: string | null
          updated_at?: string
          verified_names?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "translation_jobs_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "translation_document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translation_jobs_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_requirements: {
        Row: {
          created_at: string
          document_type_id: string
          id: string
          is_parent_document: boolean
          is_required: boolean
          is_student_document: boolean
          required_document_code: string
          required_document_name_en: string | null
          required_document_name_ru: string | null
          required_document_name_uz: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          document_type_id: string
          id?: string
          is_parent_document?: boolean
          is_required?: boolean
          is_student_document?: boolean
          required_document_code: string
          required_document_name_en?: string | null
          required_document_name_ru?: string | null
          required_document_name_uz: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          document_type_id?: string
          id?: string
          is_parent_document?: boolean
          is_required?: boolean
          is_student_document?: boolean
          required_document_code?: string
          required_document_name_en?: string | null
          required_document_name_ru?: string | null
          required_document_name_uz?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "translation_requirements_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "translation_document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_templates: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          document_type_id: string
          id: string
          is_approved: boolean
          notes: string | null
          original_file_path: string
          original_text: string | null
          translated_file_path: string
          translated_text: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_type_id: string
          id?: string
          is_approved?: boolean
          notes?: string | null
          original_file_path: string
          original_text?: string | null
          translated_file_path: string
          translated_text?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_type_id?: string
          id?: string
          is_approved?: boolean
          notes?: string | null
          original_file_path?: string
          original_text?: string | null
          translated_file_path?: string
          translated_text?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_templates_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "translation_document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      translations: {
        Row: {
          back_trans_distance: number | null
          confidence: number | null
          created_at: string
          entity_id: string
          entity_type: string
          field_name: string
          id: string
          is_machine: boolean
          lang: string
          provider: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_lang: string
          text_value: string
        }
        Insert: {
          back_trans_distance?: number | null
          confidence?: number | null
          created_at?: string
          entity_id: string
          entity_type: string
          field_name: string
          id?: string
          is_machine?: boolean
          lang: string
          provider?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_lang?: string
          text_value: string
        }
        Update: {
          back_trans_distance?: number | null
          confidence?: number | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_name?: string
          id?: string
          is_machine?: boolean
          lang?: string
          provider?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_lang?: string
          text_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "translations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      tuition: {
        Row: {
          academic_year: number
          admission_fee_krw: number | null
          amount_krw: number
          attention_reason: string | null
          created_at: string
          extractor_confidence: number | null
          faculty_group: string
          id: string
          institution_id: string
          is_first_semester: boolean
          needs_attention: boolean
          recruitment_unit_id: string | null
          semester_number: number
          source_blob_hash: string | null
          source_text_ko: string | null
        }
        Insert: {
          academic_year: number
          admission_fee_krw?: number | null
          amount_krw: number
          attention_reason?: string | null
          created_at?: string
          extractor_confidence?: number | null
          faculty_group: string
          id?: string
          institution_id: string
          is_first_semester?: boolean
          needs_attention?: boolean
          recruitment_unit_id?: string | null
          semester_number: number
          source_blob_hash?: string | null
          source_text_ko?: string | null
        }
        Update: {
          academic_year?: number
          admission_fee_krw?: number | null
          amount_krw?: number
          attention_reason?: string | null
          created_at?: string
          extractor_confidence?: number | null
          faculty_group?: string
          id?: string
          institution_id?: string
          is_first_semester?: boolean
          needs_attention?: boolean
          recruitment_unit_id?: string | null
          semester_number?: number
          source_blob_hash?: string | null
          source_text_ko?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tuition_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "tuition_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "tuition_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "tuition_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "tuition_recruitment_unit_id_fkey"
            columns: ["recruitment_unit_id"]
            isOneToOne: false
            referencedRelation: "recruitment_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_recruitment_unit_id_fkey"
            columns: ["recruitment_unit_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["recruitment_unit_id"]
          },
        ]
      }
      uni_db_fn_errors: {
        Row: {
          created_at: string
          detail: string | null
          fn: string
          id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          fn: string
          id?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          fn?: string
          id?: string
        }
        Relationships: []
      }
      university_admission_periods: {
        Row: {
          application_end: string | null
          application_fee_krw: number | null
          application_fee_usd: number | null
          application_form_url: string | null
          application_guide_url: string | null
          application_start: string | null
          attention_reason: string | null
          created_at: string
          document_deadline: string | null
          id: string
          institution_id: string | null
          interview_end: string | null
          interview_start: string | null
          language_track: string | null
          needs_attention: boolean
          offline_application_end: string | null
          offline_application_start: string | null
          online_application_end: string | null
          online_application_start: string | null
          program_level: string
          result_announcement: string | null
          semester: string
          updated_at: string
          year: number
        }
        Insert: {
          application_end?: string | null
          application_fee_krw?: number | null
          application_fee_usd?: number | null
          application_form_url?: string | null
          application_guide_url?: string | null
          application_start?: string | null
          attention_reason?: string | null
          created_at?: string
          document_deadline?: string | null
          id?: string
          institution_id?: string | null
          interview_end?: string | null
          interview_start?: string | null
          language_track?: string | null
          needs_attention?: boolean
          offline_application_end?: string | null
          offline_application_start?: string | null
          online_application_end?: string | null
          online_application_start?: string | null
          program_level: string
          result_announcement?: string | null
          semester: string
          updated_at?: string
          year: number
        }
        Update: {
          application_end?: string | null
          application_fee_krw?: number | null
          application_fee_usd?: number | null
          application_form_url?: string | null
          application_guide_url?: string | null
          application_start?: string | null
          attention_reason?: string | null
          created_at?: string
          document_deadline?: string | null
          id?: string
          institution_id?: string | null
          interview_end?: string | null
          interview_start?: string | null
          language_track?: string | null
          needs_attention?: boolean
          offline_application_end?: string | null
          offline_application_start?: string | null
          online_application_end?: string | null
          online_application_start?: string | null
          program_level?: string
          result_announcement?: string | null
          semester?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "university_admission_periods_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_admission_periods_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_admission_periods_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_admission_periods_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_admission_periods_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_admission_periods_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      university_document_requirements: {
        Row: {
          created_at: string | null
          document_type: string
          formatting_notes: string | null
          id: string
          institution_id: string | null
          language_requirements: string | null
          max_word_count: number | null
          min_word_count: number | null
          required_sections: Json | null
          tips: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          formatting_notes?: string | null
          id?: string
          institution_id?: string | null
          language_requirements?: string | null
          max_word_count?: number | null
          min_word_count?: number | null
          required_sections?: Json | null
          tips?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          formatting_notes?: string | null
          id?: string
          institution_id?: string | null
          language_requirements?: string | null
          max_word_count?: number | null
          min_word_count?: number | null
          required_sections?: Json | null
          tips?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_document_requirements_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_document_requirements_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_document_requirements_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_document_requirements_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_document_requirements_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_document_requirements_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      university_documents: {
        Row: {
          file_name: string
          file_path: string
          id: string
          institution_id: string | null
          processed_by_ai: boolean
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          id?: string
          institution_id?: string | null
          processed_by_ai?: boolean
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          id?: string
          institution_id?: string | null
          processed_by_ai?: boolean
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "university_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      university_programs: {
        Row: {
          created_at: string
          department_name: string | null
          faculty_name: string | null
          id: string
          ielts_requirement: number | null
          institution_id: string | null
          is_available_for_international: boolean
          language_track: string
          notes: string | null
          program_level: string
          program_name: string
          toefl_requirement: number | null
          topik_requirement: number | null
          tuition_per_semester: number | null
          tuition_per_year: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_name?: string | null
          faculty_name?: string | null
          id?: string
          ielts_requirement?: number | null
          institution_id?: string | null
          is_available_for_international?: boolean
          language_track: string
          notes?: string | null
          program_level: string
          program_name: string
          toefl_requirement?: number | null
          topik_requirement?: number | null
          tuition_per_semester?: number | null
          tuition_per_year?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_name?: string | null
          faculty_name?: string | null
          id?: string
          ielts_requirement?: number | null
          institution_id?: string | null
          is_available_for_international?: boolean
          language_track?: string
          notes?: string | null
          program_level?: string
          program_name?: string
          toefl_requirement?: number | null
          topik_requirement?: number | null
          tuition_per_semester?: number | null
          tuition_per_year?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      university_rooms: {
        Row: {
          created_at: string | null
          id: string
          institution_id: string | null
          is_active: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "university_rooms_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_rooms_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_rooms_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_rooms_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_rooms_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_rooms_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      user_alerts: {
        Row: {
          change_event_id: string
          channel: string | null
          delivered_at: string | null
          id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          change_event_id: string
          channel?: string | null
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          change_event_id?: string
          channel?: string | null
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_alerts_change_event_id_fkey"
            columns: ["change_event_id"]
            isOneToOne: false
            referencedRelation: "change_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      user_push_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          device_label: string | null
          enabled: boolean
          id: string
          last_seen_at: string
          platform: string
          preferred_lang: string
          token: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_label?: string | null
          enabled?: boolean
          id?: string
          last_seen_at?: string
          platform: string
          preferred_lang?: string
          token: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_label?: string | null
          enabled?: boolean
          id?: string
          last_seen_at?: string
          platform?: string
          preferred_lang?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      user_secrets: {
        Row: {
          plain_password: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          plain_password: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          plain_password?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_secrets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      user_tracked_universities: {
        Row: {
          applicant_category: string | null
          created_at: string
          institution_id: string
          notify_on_calendar_change: boolean
          notify_on_correction: boolean
          notify_on_requirement_change: boolean
          notify_on_scholarship_change: boolean
          preferred_lang: string
          tracked_recruitment_units: string[]
          user_id: string
        }
        Insert: {
          applicant_category?: string | null
          created_at?: string
          institution_id: string
          notify_on_calendar_change?: boolean
          notify_on_correction?: boolean
          notify_on_requirement_change?: boolean
          notify_on_scholarship_change?: boolean
          preferred_lang?: string
          tracked_recruitment_units?: string[]
          user_id: string
        }
        Update: {
          applicant_category?: string | null
          created_at?: string
          institution_id?: string
          notify_on_calendar_change?: boolean
          notify_on_correction?: boolean
          notify_on_requirement_change?: boolean
          notify_on_scholarship_change?: boolean
          preferred_lang?: string
          tracked_recruitment_units?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tracked_universities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tracked_universities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "user_tracked_universities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tracked_universities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "user_tracked_universities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "user_tracked_universities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "user_tracked_universities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      voip_webhook_captures: {
        Row: {
          content_type: string | null
          headers: Json
          id: string
          method: string
          notes: string | null
          parsed_payload: Json | null
          query: Json
          raw_body: string | null
          received_at: string
          source_ip: string | null
          url: string
        }
        Insert: {
          content_type?: string | null
          headers?: Json
          id?: string
          method: string
          notes?: string | null
          parsed_payload?: Json | null
          query?: Json
          raw_body?: string | null
          received_at?: string
          source_ip?: string | null
          url: string
        }
        Update: {
          content_type?: string | null
          headers?: Json
          id?: string
          method?: string
          notes?: string | null
          parsed_payload?: Json | null
          query?: Json
          raw_body?: string | null
          received_at?: string
          source_ip?: string | null
          url?: string
        }
        Relationships: []
      }
      writing_streaks: {
        Row: {
          current_streak: number | null
          id: string
          last_activity_date: string | null
          longest_streak: number | null
          student_id: string
          total_sessions_completed: number | null
          total_words_written: number | null
          updated_at: string | null
        }
        Insert: {
          current_streak?: number | null
          id?: string
          last_activity_date?: string | null
          longest_streak?: number | null
          student_id: string
          total_sessions_completed?: number | null
          total_words_written?: number | null
          updated_at?: string | null
        }
        Update: {
          current_streak?: number | null
          id?: string
          last_activity_date?: string | null
          longest_streak?: number | null
          student_id?: string
          total_sessions_completed?: number | null
          total_words_written?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      student_code_status: {
        Row: {
          auth_email: string | null
          auth_user_id: string | null
          banned_until: string | null
          deleted_at: string | null
          full_name: string | null
          magic_code: string | null
          profile_id: string | null
          profile_user_id: string | null
          status: string | null
        }
        Relationships: []
      }
      v_extraction_accuracy_by_archetype: {
        Row: {
          approved_as_is: number | null
          approved_as_is_pct: number | null
          approved_with_edits: number | null
          archetype: string | null
          rejected: number | null
          total_decided: number | null
        }
        Relationships: []
      }
      v_finance_monthly_pnl: {
        Row: {
          currency: string | null
          expenses: number | null
          income: number | null
          month: string | null
          net: number | null
        }
        Relationships: []
      }
      v_institution_content_counts: {
        Row: {
          cycles: number | null
          documents: number | null
          institution_id: string | null
          periods: number | null
          requirements: number | null
          scholarships: number | null
          tuition: number | null
        }
        Insert: {
          cycles?: never
          documents?: never
          institution_id?: string | null
          periods?: never
          requirements?: never
          scholarships?: never
          tuition?: never
        }
        Update: {
          cycles?: never
          documents?: never
          institution_id?: string | null
          periods?: never
          requirements?: never
          scholarships?: never
          tuition?: never
        }
        Relationships: []
      }
      v_institutions_for_map: {
        Row: {
          city_ko: string | null
          id: string | null
          ieqas_status: string | null
          is_partner: boolean | null
          is_visible_on_map: boolean | null
          last_verified_at: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name_en: string | null
          name_ko: string | null
          name_ko_short: string | null
          name_uz: string | null
          next_event_at: string | null
          tier: number | null
          virtual_tour: Json | null
          walkaround_url: string | null
        }
        Insert: {
          city_ko?: string | null
          id?: string | null
          ieqas_status?: string | null
          is_partner?: boolean | null
          is_visible_on_map?: boolean | null
          last_verified_at?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name_en?: never
          name_ko?: string | null
          name_ko_short?: string | null
          name_uz?: never
          next_event_at?: never
          tier?: number | null
          virtual_tour?: Json | null
          walkaround_url?: string | null
        }
        Update: {
          city_ko?: string | null
          id?: string | null
          ieqas_status?: string | null
          is_partner?: boolean | null
          is_visible_on_map?: boolean | null
          last_verified_at?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name_en?: never
          name_ko?: string | null
          name_ko_short?: string | null
          name_uz?: never
          next_event_at?: never
          tier?: number | null
          virtual_tour?: Json | null
          walkaround_url?: string | null
        }
        Relationships: []
      }
      v_needs_attention: {
        Row: {
          attention_reason: string | null
          created_at: string | null
          id: string | null
          institution_id: string | null
          name_en: string | null
          name_ko: string | null
          section: string | null
        }
        Relationships: []
      }
      v_proposed_sources_queue: {
        Row: {
          age: string | null
          candidate_snippet: string | null
          candidate_title: string | null
          id: string | null
          matched_keywords: string[] | null
          priority: number | null
          proposed_at: string | null
          proposed_by: string | null
          source_type: string | null
          url_ko: string | null
        }
        Insert: {
          age?: never
          candidate_snippet?: string | null
          candidate_title?: string | null
          id?: string | null
          matched_keywords?: string[] | null
          priority?: never
          proposed_at?: string | null
          proposed_by?: string | null
          source_type?: string | null
          url_ko?: string | null
        }
        Update: {
          age?: never
          candidate_snippet?: string | null
          candidate_title?: string | null
          id?: string | null
          matched_keywords?: string[] | null
          priority?: never
          proposed_at?: string | null
          proposed_by?: string | null
          source_type?: string | null
          url_ko?: string | null
        }
        Relationships: []
      }
      v_recruitment_for_interview: {
        Row: {
          applicant_category: string | null
          cycle_id: string | null
          cycle_track: string | null
          department_ko: string | null
          faculty_group: string | null
          faculty_ko: string | null
          institution_id: string | null
          intake_term: string | null
          intake_year: number | null
          major_track_ko: string | null
          name_en: string | null
          name_ko: string | null
          recruitment_unit_id: string | null
          requirements_summary: Json | null
          top_scholarships: Json | null
          upcoming_events: Json | null
        }
        Relationships: []
      }
      v_review_queue_by_archetype: {
        Row: {
          approved_count: number | null
          archetype: string | null
          avg_open_confidence: number | null
          in_review_count: number | null
          open_count: number | null
          rejected_count: number | null
        }
        Relationships: []
      }
      v_review_queue_by_field_group: {
        Row: {
          avg_open_confidence: number | null
          field_group: string | null
          in_review_count: number | null
          open_count: number | null
        }
        Relationships: []
      }
      v_review_queue_dashboard: {
        Row: {
          accuracy_self_score: number | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          field_group: string | null
          guideline_document_id: string | null
          id: string | null
          min_row_confidence: number | null
          name_en: string | null
          name_ko: string | null
          parsed_output: Json | null
          priority: number | null
          reason: string | null
          source_url_ko: string | null
          storage_path: string | null
        }
        Relationships: []
      }
      v_review_queue_overdue: {
        Row: {
          age: string | null
          budget: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          name_en: string | null
          name_ko: string | null
          priority: number | null
          reason: string | null
        }
        Relationships: []
      }
      v_student_balance: {
        Row: {
          currency: string | null
          next_due: string | null
          outstanding: number | null
          overdue_count: number | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
        ]
      }
      v_uni_db_health: {
        Row: {
          as_of: string | null
          cycles: number | null
          cycles_unverified: number | null
          documents_parsed: number | null
          documents_total: number | null
          extract_success_pct_30d: number | null
          gd_never_checked: number | null
          gd_oldest_check_age_days: number | null
          held_over_7d: number | null
          live_sources: number | null
          promoted_sources: number | null
          proposed_pending: number | null
          pub_documents: number | null
          pub_periods: number | null
          pub_requirements: number | null
          pub_scholarships: number | null
          pub_tuition: number | null
          review_approved: number | null
          review_held: number | null
          review_open: number | null
          review_published: number | null
          review_rejected: number | null
          translations: number | null
        }
        Relationships: []
      }
      v_user_recent_changes: {
        Row: {
          change_event_id: string | null
          detected_at: string | null
          entity_id: string | null
          entity_type: string | null
          field_name: string | null
          institution_id: string | null
          name_en: string | null
          name_ko: string | null
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_tracked_universities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      v_user_upcoming_deadlines: {
        Row: {
          applicant_category: string | null
          cycle_track: string | null
          event_type: string | null
          institution_id: string | null
          name_en: string | null
          name_ko: string | null
          notes_ko: string | null
          starts_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_tracked_universities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      version_distribution: {
        Row: {
          channel: string | null
          device_count: number | null
          latest_ping: string | null
          oldest_ping: string | null
          platform: string | null
          version: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _rls_add_child_policies: {
        Args: { p_child: string; p_parent: string }
        Returns: undefined
      }
      _rls_add_owner_policies_col: {
        Args: { p_owner_col: string; p_table: string }
        Returns: undefined
      }
      _rls_add_reference_read_policy: {
        Args: { p_table: string }
        Returns: undefined
      }
      _rls_enable_if_table_exists: {
        Args: { p_table: string }
        Returns: undefined
      }
      admin_get_auth_user_id_by_email: {
        Args: { p_email: string }
        Returns: string
      }
      current_default_intake_id: { Args: never; Returns: string }
      extract_doc_type_tag: { Args: { doc_name: string }; Returns: string }
      fn_can_review_uni_db: { Args: { p_uid?: string }; Returns: boolean }
      fn_claim_review_queue: {
        Args: { priorities?: number[]; reviewer_id?: string }
        Returns: string
      }
      fn_delete_my_account: { Args: never; Returns: undefined }
      fn_flag_source_wrong: {
        Args: {
          detail?: string
          queue_item_id: string
          reviewer_user_id?: string
        }
        Returns: number
      }
      fn_gc_change_event_outbox: { Args: never; Returns: number }
      fn_gc_pdf_access_log: { Args: never; Returns: number }
      fn_gc_user_push_tokens: { Args: never; Returns: number }
      fn_invoke_notify_tracked_changes: { Args: never; Returns: number }
      fn_is_app_user: { Args: never; Returns: boolean }
      fn_pick_next_reviewer: {
        Args: { include_admins?: boolean }
        Returns: string
      }
      fn_review_accept: {
        Args: { queue_item_id: string; reviewer_user_id?: string }
        Returns: string
      }
      fn_review_edit_accept: {
        Args: {
          corrected_payload: Json
          queue_item_id: string
          reviewer_notes?: string
          reviewer_user_id?: string
        }
        Returns: string
      }
      fn_review_reject: {
        Args: {
          queue_item_id: string
          reason: string
          reason_detail?: string
          reviewer_user_id?: string
        }
        Returns: string
      }
      get_regional_stats: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_thread_unread: {
        Args: { p_sender_id: string; p_sender_name: string; p_source: string }
        Returns: undefined
      }
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      match_communication_embeddings: {
        Args: {
          filter_lead_id?: string
          filter_student_id?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          channel: string
          content: string
          id: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
        }[]
      }
      normalize_phone: { Args: { p: string }; Returns: string }
      pgroonga_command:
        | { Args: { groongacommand: string }; Returns: string }
        | {
            Args: { arguments: string[]; groongacommand: string }
            Returns: string
          }
      pgroonga_command_escape_value: {
        Args: { value: string }
        Returns: string
      }
      pgroonga_condition: {
        Args: {
          column_name?: string
          fuzzy_max_distance_ratio?: number
          index_name?: string
          query?: string
          schema_name?: string
          scorers?: string[]
          weights?: number[]
        }
        Returns: Database["public"]["CompositeTypes"]["pgroonga_condition"]
        SetofOptions: {
          from: "*"
          to: "pgroonga_condition"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pgroonga_equal_query_text_array: {
        Args: { query: string; targets: string[] }
        Returns: boolean
      }
      pgroonga_equal_query_text_array_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              targets: string[]
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              targets: string[]
            }
            Returns: boolean
          }
      pgroonga_equal_query_varchar_array: {
        Args: { query: string; targets: string[] }
        Returns: boolean
      }
      pgroonga_equal_query_varchar_array_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              targets: string[]
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              targets: string[]
            }
            Returns: boolean
          }
      pgroonga_equal_text: {
        Args: { other: string; target: string }
        Returns: boolean
      }
      pgroonga_equal_text_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_equal_varchar: {
        Args: { other: string; target: string }
        Returns: boolean
      }
      pgroonga_equal_varchar_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_escape:
        | {
            Args: { value: number }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: boolean }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: number }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: number }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: number }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: number }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { special_characters: string; value: string }
            Returns: string
          }
        | {
            Args: { value: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      pgroonga_flush: { Args: { indexname: unknown }; Returns: boolean }
      pgroonga_highlight_html:
        | { Args: { keywords: string[]; target: string }; Returns: string }
        | {
            Args: { indexname: unknown; keywords: string[]; target: string }
            Returns: string
          }
        | { Args: { keywords: string[]; targets: string[] }; Returns: string[] }
        | {
            Args: { indexname: unknown; keywords: string[]; targets: string[] }
            Returns: string[]
          }
      pgroonga_index_column_name:
        | { Args: { columnindex: number; indexname: unknown }; Returns: string }
        | { Args: { columnname: string; indexname: unknown }; Returns: string }
      pgroonga_is_writable: { Args: never; Returns: boolean }
      pgroonga_list_broken_indexes: { Args: never; Returns: string[] }
      pgroonga_list_lagged_indexes: { Args: never; Returns: string[] }
      pgroonga_match_positions_byte:
        | { Args: { keywords: string[]; target: string }; Returns: number[] }
        | {
            Args: { indexname: unknown; keywords: string[]; target: string }
            Returns: number[]
          }
      pgroonga_match_positions_character:
        | { Args: { keywords: string[]; target: string }; Returns: number[] }
        | {
            Args: { indexname: unknown; keywords: string[]; target: string }
            Returns: number[]
          }
      pgroonga_match_term:
        | { Args: { target: string; term: string }; Returns: boolean }
        | { Args: { target: string[]; term: string }; Returns: boolean }
        | { Args: { target: string; term: string }; Returns: boolean }
        | { Args: { target: string[]; term: string }; Returns: boolean }
      pgroonga_match_text_array_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string[]
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string[]
            }
            Returns: boolean
          }
      pgroonga_match_text_array_condition_with_scorers: {
        Args: {
          condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition_with_scorers"]
          target: string[]
        }
        Returns: boolean
      }
      pgroonga_match_text_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_match_text_condition_with_scorers: {
        Args: {
          condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition_with_scorers"]
          target: string
        }
        Returns: boolean
      }
      pgroonga_match_varchar_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_match_varchar_condition_with_scorers: {
        Args: {
          condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition_with_scorers"]
          target: string
        }
        Returns: boolean
      }
      pgroonga_normalize:
        | { Args: { target: string }; Returns: string }
        | { Args: { normalizername: string; target: string }; Returns: string }
      pgroonga_prefix_varchar_condition:
        | {
            Args: {
              conditoin: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              conditoin: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_query_escape: { Args: { query: string }; Returns: string }
      pgroonga_query_expand: {
        Args: {
          query: string
          synonymscolumnname: string
          tablename: unknown
          termcolumnname: string
        }
        Returns: string
      }
      pgroonga_query_extract_keywords: {
        Args: { index_name?: string; query: string }
        Returns: string[]
      }
      pgroonga_query_text_array_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              targets: string[]
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              targets: string[]
            }
            Returns: boolean
          }
      pgroonga_query_text_array_condition_with_scorers: {
        Args: {
          condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition_with_scorers"]
          targets: string[]
        }
        Returns: boolean
      }
      pgroonga_query_text_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_query_text_condition_with_scorers: {
        Args: {
          condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition_with_scorers"]
          target: string
        }
        Returns: boolean
      }
      pgroonga_query_varchar_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_query_varchar_condition_with_scorers: {
        Args: {
          condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition_with_scorers"]
          target: string
        }
        Returns: boolean
      }
      pgroonga_regexp_text_array: {
        Args: { pattern: string; targets: string[] }
        Returns: boolean
      }
      pgroonga_regexp_text_array_condition: {
        Args: {
          pattern: Database["public"]["CompositeTypes"]["pgroonga_condition"]
          targets: string[]
        }
        Returns: boolean
      }
      pgroonga_result_to_jsonb_objects: {
        Args: { result: Json }
        Returns: Json
      }
      pgroonga_result_to_recordset: {
        Args: { result: Json }
        Returns: Record<string, unknown>[]
      }
      pgroonga_score:
        | { Args: { row: Record<string, unknown> }; Returns: number }
        | { Args: { ctid: unknown; tableoid: unknown }; Returns: number }
      pgroonga_set_writable: {
        Args: { newwritable: boolean }
        Returns: boolean
      }
      pgroonga_snippet_html: {
        Args: { keywords: string[]; target: string; width?: number }
        Returns: string[]
      }
      pgroonga_table_name: { Args: { indexname: unknown }; Returns: string }
      pgroonga_tokenize: {
        Args: { options: string[]; target: string }
        Returns: Json[]
      }
      pgroonga_vacuum: { Args: never; Returns: boolean }
      pgroonga_wal_apply:
        | { Args: never; Returns: number }
        | { Args: { indexname: unknown }; Returns: number }
      pgroonga_wal_set_applied_position:
        | { Args: never; Returns: boolean }
        | { Args: { block: number; offset: number }; Returns: boolean }
        | { Args: { indexname: unknown }; Returns: boolean }
        | {
            Args: { block: number; indexname: unknown; offset: number }
            Returns: boolean
          }
      pgroonga_wal_status: {
        Args: never
        Returns: {
          current_block: number
          current_offset: number
          current_size: number
          last_block: number
          last_offset: number
          last_size: number
          name: string
          oid: unknown
        }[]
      }
      pgroonga_wal_truncate:
        | { Args: never; Returns: number }
        | { Args: { indexname: unknown }; Returns: number }
      record_staff_bonus: {
        Args: {
          p_bonus_amount: number
          p_currency?: string
          p_month_year?: string
          p_plan_type: string
          p_student_id: string
        }
        Returns: boolean
      }
      resolve_communication_identity: {
        Args: { p_channel: string; p_identifier: string }
        Returns: {
          confidence: string
          display_name: string
          lead_id: string
          student_id: string
        }[]
      }
      search_communications_text: {
        Args: { p_limit?: number; p_query: string; p_student?: string }
        Returns: {
          kind: string
          lead_id: string
          snippet: string
          student_id: string
          when_at: string
        }[]
      }
      staff_bonus_amount: { Args: { p_student_id: string }; Returns: number }
      upsert_message_thread: {
        Args: {
          p_direction: string
          p_last_message_at: string
          p_sender_avatar: string
          p_sender_id: string
          p_sender_name: string
          p_source: string
          p_student_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "call_operator"
        | "document_handler"
        | "university_staff"
      notification_event:
        | "recruitment_changed"
        | "correction_notice"
        | "deadline_within_7d"
        | "deadline_within_24h"
      university_selection_status: "none" | "pending" | "approved"
    }
    CompositeTypes: {
      pgroonga_condition: {
        query: string | null
        weigths: number[] | null
        scorers: string[] | null
        schema_name: string | null
        index_name: string | null
        column_name: string | null
        fuzzy_max_distance_ratio: number | null
      }
      pgroonga_full_text_search_condition: {
        query: string | null
        weigths: number[] | null
        indexname: string | null
      }
      pgroonga_full_text_search_condition_with_scorers: {
        query: string | null
        weigths: number[] | null
        scorers: string[] | null
        indexname: string | null
      }
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
      app_role: [
        "owner",
        "admin",
        "call_operator",
        "document_handler",
        "university_staff",
      ],
      notification_event: [
        "recruitment_changed",
        "correction_notice",
        "deadline_within_7d",
        "deadline_within_24h",
      ],
      university_selection_status: ["none", "pending", "approved"],
    },
  },
} as const
