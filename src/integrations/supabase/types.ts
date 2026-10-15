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
      account_deletion_requests: {
        Row: {
          contact: string
          created_at: string
          full_name: string | null
          id: string
          reason: string | null
          status: string
        }
        Insert: {
          contact: string
          created_at?: string
          full_name?: string | null
          id?: string
          reason?: string | null
          status?: string
        }
        Update: {
          contact?: string
          created_at?: string
          full_name?: string | null
          id?: string
          reason?: string | null
          status?: string
        }
        Relationships: []
      }
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
      after_hours_reply_queue: {
        Row: {
          arrived_at: string
          claimed_at: string | null
          created_at: string
          last_incoming_at: string | null
          reply_text: string
          sender_id: string
          source: string
        }
        Insert: {
          arrived_at: string
          claimed_at?: string | null
          created_at?: string
          last_incoming_at?: string | null
          reply_text: string
          sender_id: string
          source: string
        }
        Update: {
          arrived_at?: string
          claimed_at?: string | null
          created_at?: string
          last_incoming_at?: string | null
          reply_text?: string
          sender_id?: string
          source?: string
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
      ai_crawl_config: {
        Row: {
          auto_approve_threshold: number
          batch_size: number
          enabled: boolean
          id: string
          interval_hours: number
          last_run_at: string | null
          last_run_status: string | null
          model: string
          next_run_at: string | null
          require_approval: boolean
          updated_at: string
        }
        Insert: {
          auto_approve_threshold?: number
          batch_size?: number
          enabled?: boolean
          id?: string
          interval_hours?: number
          last_run_at?: string | null
          last_run_status?: string | null
          model?: string
          next_run_at?: string | null
          require_approval?: boolean
          updated_at?: string
        }
        Update: {
          auto_approve_threshold?: number
          batch_size?: number
          enabled?: boolean
          id?: string
          interval_hours?: number
          last_run_at?: string | null
          last_run_status?: string | null
          model?: string
          next_run_at?: string | null
          require_approval?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_search_terms: {
        Row: {
          created_at: string
          query_key: string
          terms: string[]
        }
        Insert: {
          created_at?: string
          query_key: string
          terms: string[]
        }
        Update: {
          created_at?: string
          query_key?: string
          terms?: string[]
        }
        Relationships: []
      }
      ai_search_usage: {
        Row: {
          count: number
          day: string
          key: string
        }
        Insert: {
          count?: number
          day: string
          key: string
        }
        Update: {
          count?: number
          day?: string
          key?: string
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
      app_accounts: {
        Row: {
          created_at: string
          failed_attempts: number
          id: string
          last_login_at: string | null
          lead_id: string | null
          locked_until: string | null
          password_hash: string
          phone: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          id?: string
          last_login_at?: string | null
          lead_id?: string | null
          locked_until?: string | null
          password_hash: string
          phone: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          id?: string
          last_login_at?: string | null
          lead_id?: string | null
          locked_until?: string | null
          password_hash?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_accounts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_channel_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "app_accounts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      app_assets: {
        Row: {
          content: string
          key: string
          updated_at: string
        }
        Insert: {
          content: string
          key: string
          updated_at?: string
        }
        Update: {
          content?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_events: {
        Row: {
          event: string
          id: number
          install_id: string
          occurred_at: string
          props: Json
          received_at: string
          screen: string | null
          user_id: string | null
        }
        Insert: {
          event: string
          id?: never
          install_id: string
          occurred_at: string
          props?: Json
          received_at?: string
          screen?: string | null
          user_id?: string | null
        }
        Update: {
          event?: string
          id?: never
          install_id?: string
          occurred_at?: string
          props?: Json
          received_at?: string
          screen?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_events_install_id_fkey"
            columns: ["install_id"]
            isOneToOne: false
            referencedRelation: "app_installs"
            referencedColumns: ["install_id"]
          },
          {
            foreignKeyName: "app_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      app_installs: {
        Row: {
          app_version: string | null
          first_seen_at: string
          install_id: string
          last_seen_at: string
          lead_id: string | null
          platform: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          first_seen_at?: string
          install_id: string
          last_seen_at?: string
          lead_id?: string | null
          platform?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          first_seen_at?: string
          install_id?: string
          last_seen_at?: string
          lead_id?: string | null
          platform?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_installs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_channel_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "app_installs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_installs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      app_text_translations: {
        Row: {
          en: string | null
          ko: string | null
          ru: string | null
          source: string
          translated_at: string
          translated_by: string
        }
        Insert: {
          en?: string | null
          ko?: string | null
          ru?: string | null
          source: string
          translated_at?: string
          translated_by?: string
        }
        Update: {
          en?: string | null
          ko?: string | null
          ru?: string | null
          source?: string
          translated_at?: string
          translated_by?: string
        }
        Relationships: []
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
      application_fee_payments: {
        Row: {
          amount_krw: number
          created_at: string
          created_by: string | null
          expense_krw: number | null
          id: string
          institution_id: string
          intake_id: string | null
          receipt_file_name: string | null
          receipt_url: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          amount_krw: number
          created_at?: string
          created_by?: string | null
          expense_krw?: number | null
          id?: string
          institution_id: string
          intake_id?: string | null
          receipt_file_name?: string | null
          receipt_url?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          amount_krw?: number
          created_at?: string
          created_by?: string | null
          expense_krw?: number | null
          id?: string
          institution_id?: string
          intake_id?: string | null
          receipt_file_name?: string | null
          receipt_url?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_fee_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "application_fee_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
          {
            foreignKeyName: "application_fee_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "application_fee_payments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_fee_payments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "application_fee_payments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_fee_payments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "application_fee_payments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "application_fee_payments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "application_fee_payments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_fee_payments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "application_fee_payments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "application_fee_payments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "application_fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "application_fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
          {
            foreignKeyName: "application_fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          decision: string | null
          decision_at: string | null
          degree_level: string | null
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
          degree_level?: string | null
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
          degree_level?: string | null
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
            foreignKeyName: "applications_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "applications_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "applications_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
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
          {
            foreignKeyName: "applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
        ]
      }
      blocked_link_hosts: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          detail: string | null
          host: string
          institution_name_ko: string
          reason: string
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          detail?: string | null
          host: string
          institution_name_ko: string
          reason: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          detail?: string | null
          host?: string
          institution_name_ko?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_link_hosts_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
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
            referencedRelation: "lead_channel_overview"
            referencedColumns: ["lead_id"]
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
          {
            foreignKeyName: "call_analyses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
        ]
      }
      call_lead_suggestions: {
        Row: {
          call_id: string
          confidence: number | null
          corrected_value: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          evidence: string | null
          field: string
          id: string
          lead_id: string | null
          model: string | null
          status: string
          student_id: string | null
          suggested_value: string | null
        }
        Insert: {
          call_id: string
          confidence?: number | null
          corrected_value?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence?: string | null
          field: string
          id?: string
          lead_id?: string | null
          model?: string | null
          status?: string
          student_id?: string | null
          suggested_value?: string | null
        }
        Update: {
          call_id?: string
          confidence?: number | null
          corrected_value?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence?: string | null
          field?: string
          id?: string
          lead_id?: string | null
          model?: string | null
          status?: string
          student_id?: string | null
          suggested_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_lead_suggestions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_lead_suggestions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "call_lead_suggestions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
          {
            foreignKeyName: "call_lead_suggestions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "call_lead_suggestions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_channel_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "call_lead_suggestions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_lead_suggestions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "call_lead_suggestions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
          {
            foreignKeyName: "call_lead_suggestions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
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
          answered_at: string | null
          created_at: string
          direction: string
          duration: number | null
          ended_at: string | null
          external_call_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          phone_number: string
          recording_path: string | null
          recording_url: string | null
          staff_id: string | null
          started_at: string
          status: string
          student_id: string | null
          updated_at: string
          voip_provider: string | null
        }
        Insert: {
          answered_at?: string | null
          created_at?: string
          direction?: string
          duration?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          phone_number: string
          recording_path?: string | null
          recording_url?: string | null
          staff_id?: string | null
          started_at?: string
          status?: string
          student_id?: string | null
          updated_at?: string
          voip_provider?: string | null
        }
        Update: {
          answered_at?: string | null
          created_at?: string
          direction?: string
          duration?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          phone_number?: string
          recording_path?: string | null
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
            referencedRelation: "lead_channel_overview"
            referencedColumns: ["lead_id"]
          },
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
            foreignKeyName: "calls_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
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
          {
            foreignKeyName: "calls_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
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
      channel_health: {
        Row: {
          enabled: boolean
          last_alert_at: string | null
          last_inbound_at: string | null
          silent_after_hours: number
          source: string
          state: string
          state_since: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          last_alert_at?: string | null
          last_inbound_at?: string | null
          silent_after_hours?: number
          source: string
          state?: string
          state_since?: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          last_alert_at?: string | null
          last_inbound_at?: string | null
          silent_after_hours?: number
          source?: string
          state?: string
          state_since?: string
          updated_at?: string
        }
        Relationships: []
      }
      channel_health_log: {
        Row: {
          created_at: string
          details: Json | null
          from_state: string | null
          id: number
          source: string
          to_state: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          from_state?: string | null
          id?: number
          source: string
          to_state: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          from_state?: string | null
          id?: number
          source?: string
          to_state?: string
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
            referencedRelation: "lead_channel_overview"
            referencedColumns: ["lead_id"]
          },
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
          {
            foreignKeyName: "communication_embeddings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
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
            referencedRelation: "lead_channel_overview"
            referencedColumns: ["lead_id"]
          },
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
          {
            foreignKeyName: "communication_identities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
        ]
      }
      content_embeddings: {
        Row: {
          channel: string | null
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          language: string | null
          lead_id: string | null
          metadata: Json | null
          model: string
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
          language?: string | null
          lead_id?: string | null
          metadata?: Json | null
          model?: string
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
          language?: string | null
          lead_id?: string | null
          metadata?: Json | null
          model?: string
          source_id?: string
          source_type?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_embeddings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_channel_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "content_embeddings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_embeddings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "content_embeddings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
          {
            foreignKeyName: "content_embeddings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
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
            foreignKeyName: "crawl_findings_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "v_institution_announcements"
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
      crawl_page_cache: {
        Row: {
          content_hash: string | null
          etag: string | null
          fetched_at: string | null
          institution_id: string
          last_modified: string | null
          page_size_bytes: number | null
        }
        Insert: {
          content_hash?: string | null
          etag?: string | null
          fetched_at?: string | null
          institution_id: string
          last_modified?: string | null
          page_size_bytes?: number | null
        }
        Update: {
          content_hash?: string | null
          etag?: string | null
          fetched_at?: string | null
          institution_id?: string
          last_modified?: string | null
          page_size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_page_cache_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_page_cache_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "crawl_page_cache_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_page_cache_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "crawl_page_cache_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "crawl_page_cache_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      crawl_runs: {
        Row: {
          content_hash: string | null
          ended_at: string | null
          error_text: string | null
          http_status_code: number | null
          id: string
          institution_id: string | null
          records_changed: number
          records_new: number
          records_seen: number
          skipped_reason: string | null
          source_id: string | null
          started_at: string
          status: string | null
        }
        Insert: {
          content_hash?: string | null
          ended_at?: string | null
          error_text?: string | null
          http_status_code?: number | null
          id?: string
          institution_id?: string | null
          records_changed?: number
          records_new?: number
          records_seen?: number
          skipped_reason?: string | null
          source_id?: string | null
          started_at?: string
          status?: string | null
        }
        Update: {
          content_hash?: string | null
          ended_at?: string | null
          error_text?: string | null
          http_status_code?: number | null
          id?: string
          institution_id?: string | null
          records_changed?: number
          records_new?: number
          records_seen?: number
          skipped_reason?: string | null
          source_id?: string | null
          started_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_runs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_runs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "crawl_runs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_runs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "crawl_runs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "crawl_runs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
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
      document_approvers: {
        Row: {
          granted_at: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_approvers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
          {
            foreignKeyName: "document_extractions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
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
            foreignKeyName: "documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_investor_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "documents_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "documents_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "documents_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
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
          {
            foreignKeyName: "documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
        ]
      }
      documents_file_path_repairs: {
        Row: {
          document_id: string
          new_file_path: string
          old_file_path: string
          repaired_at: string
        }
        Insert: {
          document_id: string
          new_file_path: string
          old_file_path: string
          repaired_at?: string
        }
        Update: {
          document_id?: string
          new_file_path?: string
          old_file_path?: string
          repaired_at?: string
        }
        Relationships: []
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
      eligibility_rules: {
        Row: {
          key: string
          note: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          note?: string | null
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          note?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: []
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
      extraction_jobs_archive: {
        Row: {
          accuracy_self_score: number | null
          archetype: string
          archive_reason: string
          archived_at: string
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
          payload_sample: boolean
          raw_output: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          accuracy_self_score?: number | null
          archetype: string
          archive_reason: string
          archived_at?: string
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
          payload_sample?: boolean
          raw_output?: Json | null
          started_at?: string | null
          status?: string
        }
        Update: {
          accuracy_self_score?: number | null
          archetype?: string
          archive_reason?: string
          archived_at?: string
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
          payload_sample?: boolean
          raw_output?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      finance_access: {
        Row: {
          granted_at: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
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
          academic_year: number | null
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
          semester: string | null
          source_url_ko: string
          storage_path: string
          superseded_by_id: string | null
        }
        Insert: {
          academic_year?: number | null
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
          semester?: string | null
          source_url_ko: string
          storage_path: string
          superseded_by_id?: string | null
        }
        Update: {
          academic_year?: number | null
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
          semester?: string | null
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
      guideline_notifications: {
        Row: {
          channel: string
          guideline_document_id: string
          notified_at: string
        }
        Insert: {
          channel?: string
          guideline_document_id: string
          notified_at?: string
        }
        Update: {
          channel?: string
          guideline_document_id?: string
          notified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guideline_notifications_guideline_document_id_fkey"
            columns: ["guideline_document_id"]
            isOneToOne: true
            referencedRelation: "guideline_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_admins: {
        Row: {
          chat_id: string
          created_at: string
          last_address: Json | null
          name: string | null
          pending_action: Json | null
          telegram_user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          last_address?: Json | null
          name?: string | null
          pending_action?: Json | null
          telegram_user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          last_address?: Json | null
          name?: string | null
          pending_action?: Json | null
          telegram_user_id?: string
        }
        Relationships: []
      }
      hr_candidates: {
        Row: {
          busy_hours: string | null
          chat_id: string
          created_at: string
          district: string | null
          full_name: string | null
          id: string
          interview_at: string | null
          interview_info: string | null
          interview_location: Json | null
          occupation: string | null
          phone: string | null
          status: string
          step: string
          submitted_at: string | null
          telegram_user_id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          busy_hours?: string | null
          chat_id: string
          created_at?: string
          district?: string | null
          full_name?: string | null
          id?: string
          interview_at?: string | null
          interview_info?: string | null
          interview_location?: Json | null
          occupation?: string | null
          phone?: string | null
          status?: string
          step?: string
          submitted_at?: string | null
          telegram_user_id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          busy_hours?: string | null
          chat_id?: string
          created_at?: string
          district?: string | null
          full_name?: string | null
          id?: string
          interview_at?: string | null
          interview_info?: string | null
          interview_location?: Json | null
          occupation?: string | null
          phone?: string | null
          status?: string
          step?: string
          submitted_at?: string | null
          telegram_user_id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      hr_card_messages: {
        Row: {
          candidate_id: string
          chat_id: string
          id: number
          message_id: number
          sent_at: string
        }
        Insert: {
          candidate_id: string
          chat_id: string
          id?: never
          message_id: number
          sent_at?: string
        }
        Update: {
          candidate_id?: string
          chat_id?: string
          id?: never
          message_id?: number
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_card_messages_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "hr_candidates"
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
      infra_health: {
        Row: {
          check: string
          checked_at: string
          detail: string | null
          state: string
          state_since: string
        }
        Insert: {
          check: string
          checked_at?: string
          detail?: string | null
          state: string
          state_since?: string
        }
        Update: {
          check?: string
          checked_at?: string
          detail?: string | null
          state?: string
          state_since?: string
        }
        Relationships: []
      }
      instagram_accounts: {
        Row: {
          access_token: string
          active: boolean
          connected_at: string
          id: string
          ig_user_id: string
          token_expires_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          access_token: string
          active?: boolean
          connected_at?: string
          id?: string
          ig_user_id: string
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          access_token?: string
          active?: boolean
          connected_at?: string
          id?: string
          ig_user_id?: string
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      instagram_app_config: {
        Row: {
          app_id: string | null
          app_secret: string | null
          graph_version: string
          id: string
          updated_at: string
          verify_token: string
        }
        Insert: {
          app_id?: string | null
          app_secret?: string | null
          graph_version?: string
          id?: string
          updated_at?: string
          verify_token?: string
        }
        Update: {
          app_id?: string | null
          app_secret?: string | null
          graph_version?: string
          id?: string
          updated_at?: string
          verify_token?: string
        }
        Relationships: []
      }
      instagram_comments: {
        Row: {
          comment_id: string
          commented_at: string | null
          created_at: string
          from_ig_id: string | null
          from_username: string | null
          id: string
          is_from_me: boolean
          lead_id: string | null
          media_id: string | null
          media_product_type: string | null
          parent_comment_id: string | null
          raw: Json | null
          replied_at: string | null
          replied_by: string | null
          reply_comment_id: string | null
          reply_text: string | null
          status: string
          student_id: string | null
          text: string | null
          updated_at: string
        }
        Insert: {
          comment_id: string
          commented_at?: string | null
          created_at?: string
          from_ig_id?: string | null
          from_username?: string | null
          id?: string
          is_from_me?: boolean
          lead_id?: string | null
          media_id?: string | null
          media_product_type?: string | null
          parent_comment_id?: string | null
          raw?: Json | null
          replied_at?: string | null
          replied_by?: string | null
          reply_comment_id?: string | null
          reply_text?: string | null
          status?: string
          student_id?: string | null
          text?: string | null
          updated_at?: string
        }
        Update: {
          comment_id?: string
          commented_at?: string | null
          created_at?: string
          from_ig_id?: string | null
          from_username?: string | null
          id?: string
          is_from_me?: boolean
          lead_id?: string | null
          media_id?: string | null
          media_product_type?: string | null
          parent_comment_id?: string | null
          raw?: Json | null
          replied_at?: string | null
          replied_by?: string | null
          reply_comment_id?: string | null
          reply_text?: string | null
          status?: string
          student_id?: string | null
          text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_comments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_channel_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "instagram_comments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_comments_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "instagram_comments_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
          {
            foreignKeyName: "instagram_comments_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
        ]
      }
      instagram_send_dedupe: {
        Row: {
          bucket: number
          created_at: string
          igsid: string
          text_hash: string
        }
        Insert: {
          bucket: number
          created_at?: string
          igsid: string
          text_hash: string
        }
        Update: {
          bucket?: number
          created_at?: string
          igsid?: string
          text_hash?: string
        }
        Relationships: []
      }
      instagram_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_kind: string | null
          id: string
          payload: Json
          processed: boolean
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_kind?: string | null
          id?: string
          payload: Json
          processed?: boolean
        }
        Update: {
          created_at?: string
          error?: string | null
          event_kind?: string | null
          id?: string
          payload?: Json
          processed?: boolean
        }
        Relationships: []
      }
      institution_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          institution_id: string
          is_active: boolean
          note_type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id: string
          is_active?: boolean
          note_type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id?: string
          is_active?: boolean
          note_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "institution_notes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_notes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "institution_notes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_notes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "institution_notes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "institution_notes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      institutions: {
        Row: {
          city_ko: string | null
          consecutive_failures: number
          content_hash: string | null
          crawl_cooldown_until: string | null
          created_at: string
          display_names: Json
          hidden_levels: string[]
          id: string
          ieqas_status: string | null
          inactive_reason: string | null
          institution_type: string
          is_active: boolean
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
          visa_restricted: boolean
          walkaround_url: string | null
          wikidata_id: string | null
        }
        Insert: {
          city_ko?: string | null
          consecutive_failures?: number
          content_hash?: string | null
          crawl_cooldown_until?: string | null
          created_at?: string
          display_names?: Json
          hidden_levels?: string[]
          id?: string
          ieqas_status?: string | null
          inactive_reason?: string | null
          institution_type: string
          is_active?: boolean
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
          visa_restricted?: boolean
          walkaround_url?: string | null
          wikidata_id?: string | null
        }
        Update: {
          city_ko?: string | null
          consecutive_failures?: number
          content_hash?: string | null
          crawl_cooldown_until?: string | null
          created_at?: string
          display_names?: Json
          hidden_levels?: string[]
          id?: string
          ieqas_status?: string | null
          inactive_reason?: string | null
          institution_type?: string
          is_active?: boolean
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
          visa_restricted?: boolean
          walkaround_url?: string | null
          wikidata_id?: string | null
        }
        Relationships: []
      }
      intakes: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          is_default: boolean
          is_open: boolean
          season: string
          starts_on: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_default?: boolean
          is_open?: boolean
          season: string
          starts_on?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_default?: boolean
          is_open?: boolean
          season?: string
          starts_on?: string | null
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
      investor_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_user_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_user_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_user_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "investor_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "investor_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_payouts: {
        Row: {
          amount_uzs: number
          created_at: string
          due_date: string | null
          id: string
          investor_id: string
          paid_at: string | null
          period_label: string
          status: string
        }
        Insert: {
          amount_uzs: number
          created_at?: string
          due_date?: string | null
          id?: string
          investor_id: string
          paid_at?: string | null
          period_label: string
          status: string
        }
        Update: {
          amount_uzs?: number
          created_at?: string
          due_date?: string | null
          id?: string
          investor_id?: string
          paid_at?: string | null
          period_label?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_payouts_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_payouts_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "v_investor_position"
            referencedColumns: ["investor_id"]
          },
        ]
      }
      investor_threads: {
        Row: {
          created_at: string
          id: string
          investor_id: string
          last_message_at: string
          staff_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          investor_id: string
          last_message_at?: string
          staff_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          investor_id?: string
          last_message_at?: string
          staff_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_threads_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_threads_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "v_investor_position"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_threads_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      investors: {
        Row: {
          created_at: string
          equity_percent: number
          first_intake_id: string
          full_name: string
          id: string
          invested_amount_usd: number
          invested_at: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equity_percent: number
          first_intake_id: string
          full_name: string
          id?: string
          invested_amount_usd: number
          invested_at: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equity_percent?: number
          first_intake_id?: string
          full_name?: string
          id?: string
          invested_amount_usd?: number
          invested_at?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investors_first_intake_id_fkey"
            columns: ["first_intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investors_first_intake_id_fkey"
            columns: ["first_intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "investors_first_intake_id_fkey"
            columns: ["first_intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "investors_first_intake_id_fkey"
            columns: ["first_intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "investors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      lead_alert_recipients: {
        Row: {
          chat_id: string
          created_at: string
          enabled: boolean
          label: string | null
          watchdog: boolean
        }
        Insert: {
          chat_id: string
          created_at?: string
          enabled?: boolean
          label?: string | null
          watchdog?: boolean
        }
        Update: {
          chat_id?: string
          created_at?: string
          enabled?: boolean
          label?: string | null
          watchdog?: boolean
        }
        Relationships: []
      }
      lead_daily_reports: {
        Row: {
          report_day: string
          sent_at: string
        }
        Insert: {
          report_day: string
          sent_at?: string
        }
        Update: {
          report_day?: string
          sent_at?: string
        }
        Relationships: []
      }
      lead_field_suggestions: {
        Row: {
          confidence: number | null
          corrected_value: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          evidence: string | null
          evidence_channel: string | null
          field: string
          id: string
          lead_id: string
          model: string | null
          sources: Json
          status: string
          suggested_value: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          corrected_value?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence?: string | null
          evidence_channel?: string | null
          field: string
          id?: string
          lead_id: string
          model?: string | null
          sources?: Json
          status?: string
          suggested_value?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          corrected_value?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence?: string | null
          evidence_channel?: string | null
          field?: string
          id?: string
          lead_id?: string
          model?: string | null
          sources?: Json
          status?: string
          suggested_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_field_suggestions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_channel_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_field_suggestions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
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
            referencedRelation: "lead_channel_overview"
            referencedColumns: ["lead_id"]
          },
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
          after_hours_reply_sent_at: string | null
          age: number | null
          ai_summary: string | null
          assigned_to: string | null
          birth_date: string | null
          budget_range: string | null
          call_result: string | null
          cert_level: string | null
          city: string | null
          contact_channel: string | null
          contract_date: string | null
          contract_number: string | null
          converted_to_student_id: string | null
          created_at: string
          created_by: string | null
          current_stage: string | null
          education_level: string | null
          eligibility_band: string | null
          eligibility_result: Json | null
          email: string | null
          english_level: string | null
          enriched_at: string | null
          exam_date: string | null
          exam_type: string | null
          full_name: string
          how_heard: string | null
          id: string
          instagram_handle: string | null
          intake_id: string | null
          interest_level: string | null
          korean_level: string | null
          last_contacted_at: string | null
          learning_center_id: string | null
          link_code: string | null
          login_count: number | null
          login_history: string[] | null
          needs_operator: boolean
          new_chat_at: string | null
          new_lead_at: string | null
          next_follow_up: string | null
          notes: string | null
          password: string | null
          payment_plan: string | null
          phone: string | null
          preferred_program: string | null
          preferred_start_date: string | null
          preferred_university: string | null
          priority_score: number | null
          qualified: boolean
          quick_contact_alerted_at: string | null
          quiz_answers: Json | null
          quiz_submitted_at: string | null
          referred_by_student_id: string | null
          sla_alerted_at: string | null
          sla_start_at: string | null
          source: string
          source_id: string | null
          source_note: string | null
          status: string
          target_intake: string | null
          tariff_interest: string | null
          telegram_handle: string | null
          updated_at: string
        }
        Insert: {
          after_hours_reply_sent_at?: string | null
          age?: number | null
          ai_summary?: string | null
          assigned_to?: string | null
          birth_date?: string | null
          budget_range?: string | null
          call_result?: string | null
          cert_level?: string | null
          city?: string | null
          contact_channel?: string | null
          contract_date?: string | null
          contract_number?: string | null
          converted_to_student_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string | null
          education_level?: string | null
          eligibility_band?: string | null
          eligibility_result?: Json | null
          email?: string | null
          english_level?: string | null
          enriched_at?: string | null
          exam_date?: string | null
          exam_type?: string | null
          full_name: string
          how_heard?: string | null
          id?: string
          instagram_handle?: string | null
          intake_id?: string | null
          interest_level?: string | null
          korean_level?: string | null
          last_contacted_at?: string | null
          learning_center_id?: string | null
          link_code?: string | null
          login_count?: number | null
          login_history?: string[] | null
          needs_operator?: boolean
          new_chat_at?: string | null
          new_lead_at?: string | null
          next_follow_up?: string | null
          notes?: string | null
          password?: string | null
          payment_plan?: string | null
          phone?: string | null
          preferred_program?: string | null
          preferred_start_date?: string | null
          preferred_university?: string | null
          priority_score?: number | null
          qualified?: boolean
          quick_contact_alerted_at?: string | null
          quiz_answers?: Json | null
          quiz_submitted_at?: string | null
          referred_by_student_id?: string | null
          sla_alerted_at?: string | null
          sla_start_at?: string | null
          source?: string
          source_id?: string | null
          source_note?: string | null
          status?: string
          target_intake?: string | null
          tariff_interest?: string | null
          telegram_handle?: string | null
          updated_at?: string
        }
        Update: {
          after_hours_reply_sent_at?: string | null
          age?: number | null
          ai_summary?: string | null
          assigned_to?: string | null
          birth_date?: string | null
          budget_range?: string | null
          call_result?: string | null
          cert_level?: string | null
          city?: string | null
          contact_channel?: string | null
          contract_date?: string | null
          contract_number?: string | null
          converted_to_student_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string | null
          education_level?: string | null
          eligibility_band?: string | null
          eligibility_result?: Json | null
          email?: string | null
          english_level?: string | null
          enriched_at?: string | null
          exam_date?: string | null
          exam_type?: string | null
          full_name?: string
          how_heard?: string | null
          id?: string
          instagram_handle?: string | null
          intake_id?: string | null
          interest_level?: string | null
          korean_level?: string | null
          last_contacted_at?: string | null
          learning_center_id?: string | null
          link_code?: string | null
          login_count?: number | null
          login_history?: string[] | null
          needs_operator?: boolean
          new_chat_at?: string | null
          new_lead_at?: string | null
          next_follow_up?: string | null
          notes?: string | null
          password?: string | null
          payment_plan?: string | null
          phone?: string | null
          preferred_program?: string | null
          preferred_start_date?: string | null
          preferred_university?: string | null
          priority_score?: number | null
          qualified?: boolean
          quick_contact_alerted_at?: string | null
          quiz_answers?: Json | null
          quiz_submitted_at?: string | null
          referred_by_student_id?: string | null
          sla_alerted_at?: string | null
          sla_start_at?: string | null
          source?: string
          source_id?: string | null
          source_note?: string | null
          status?: string
          target_intake?: string | null
          tariff_interest?: string | null
          telegram_handle?: string | null
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
            foreignKeyName: "leads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "leads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "leads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "leads_learning_center_id_fkey"
            columns: ["learning_center_id"]
            isOneToOne: false
            referencedRelation: "learning_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referred_by_student_id_fkey"
            columns: ["referred_by_student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "leads_referred_by_student_id_fkey"
            columns: ["referred_by_student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
          {
            foreignKeyName: "leads_referred_by_student_id_fkey"
            columns: ["referred_by_student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learning_center_students: {
        Row: {
          age: number | null
          already_lead: boolean
          center_id: string
          city: string | null
          created_at: string
          created_by: string | null
          english_level: string | null
          full_name: string
          id: string
          korean_level: string | null
          lead_id: string | null
          notes: string | null
          phone: string
        }
        Insert: {
          age?: number | null
          already_lead?: boolean
          center_id: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          english_level?: string | null
          full_name: string
          id?: string
          korean_level?: string | null
          lead_id?: string | null
          notes?: string | null
          phone: string
        }
        Update: {
          age?: number | null
          already_lead?: boolean
          center_id?: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          english_level?: string | null
          full_name?: string
          id?: string
          korean_level?: string | null
          lead_id?: string | null
          notes?: string | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_center_students_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "learning_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_center_students_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_channel_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "learning_center_students_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_centers: {
        Row: {
          address: string | null
          assigned_to: string | null
          city: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_centers_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "learning_centers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
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
          assigned_at: string | null
          assigned_to: string | null
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
          assigned_at?: string | null
          assigned_to?: string | null
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
          assigned_at?: string | null
          assigned_to?: string | null
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
          {
            foreignKeyName: "message_threads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "message_threads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "message_threads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
          },
        ]
      }
      messages: {
        Row: {
          assigned_to: string | null
          client_msg_id: string | null
          content: string
          created_at: string
          delivery_error: string | null
          delivery_status: string | null
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
          client_msg_id?: string | null
          content: string
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string | null
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
          client_msg_id?: string | null
          content?: string
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string | null
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
      orbit_sync_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
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
          list_amount: number | null
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
          list_amount?: number | null
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
          list_amount?: number | null
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
            foreignKeyName: "payments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_investor_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "payments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "payments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "payments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
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
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
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
      pipeline_watchdog_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: number
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: never
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: never
        }
        Relationships: []
      }
      planned_transactions: {
        Row: {
          amount: number
          category: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          expected_date: string
          id: string
          notes: string | null
          recurrence: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          expected_date: string
          id?: string
          notes?: string | null
          recurrence?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          expected_date?: string
          id?: string
          notes?: string | null
          recurrence?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          additional_phone: string | null
          avatar_url: string | null
          birth_date: string | null
          birth_date_source: string | null
          city: string | null
          contract_date: string | null
          contract_url: string | null
          created_at: string
          dob: string | null
          full_name: string | null
          id: string
          ielts_score: number | null
          is_demo: boolean
          is_gks_applicant: boolean | null
          korean_region_preference: string | null
          language_track: string | null
          language_track_source: string | null
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
          region_source: string | null
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
          birth_date_source?: string | null
          city?: string | null
          contract_date?: string | null
          contract_url?: string | null
          created_at?: string
          dob?: string | null
          full_name?: string | null
          id?: string
          ielts_score?: number | null
          is_demo?: boolean
          is_gks_applicant?: boolean | null
          korean_region_preference?: string | null
          language_track?: string | null
          language_track_source?: string | null
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
          region_source?: string | null
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
          birth_date_source?: string | null
          city?: string | null
          contract_date?: string | null
          contract_url?: string | null
          created_at?: string
          dob?: string | null
          full_name?: string | null
          id?: string
          ielts_score?: number | null
          is_demo?: boolean
          is_gks_applicant?: boolean | null
          korean_region_preference?: string | null
          language_track?: string | null
          language_track_source?: string | null
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
          region_source?: string | null
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
          dismiss_detail: string | null
          dismiss_reason: string | null
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
          dismiss_detail?: string | null
          dismiss_reason?: string | null
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
          dismiss_detail?: string | null
          dismiss_reason?: string | null
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
          korean_hours_min: number | null
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
          korean_hours_min?: number | null
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
          korean_hours_min?: number | null
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
            referencedRelation: "v_rejected_awaiting_requeue"
            referencedColumns: ["queue_id"]
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
          field_group: string | null
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
          field_group?: string | null
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
          field_group?: string | null
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
            foreignKeyName: "scheduled_payments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "scheduled_payments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "scheduled_payments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
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
            foreignKeyName: "scheduled_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "scheduled_payments_trigger_application_id_fkey"
            columns: ["trigger_application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_payments_trigger_application_id_fkey"
            columns: ["trigger_application_id"]
            isOneToOne: false
            referencedRelation: "v_investor_applications"
            referencedColumns: ["application_id"]
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
      staff_extensions: {
        Row: {
          created_at: string
          extension: string
          id: string
          is_active: boolean
          label: string | null
          provider: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extension: string
          id?: string
          is_active?: boolean
          label?: string | null
          provider: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extension?: string
          id?: string
          is_active?: boolean
          label?: string | null
          provider?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_extensions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "staff_extensions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
          {
            foreignKeyName: "staff_extensions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
        ]
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
            foreignKeyName: "student_budgets_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "student_budgets_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "student_budgets_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
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
          {
            foreignKeyName: "student_budgets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
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
          {
            foreignKeyName: "student_comments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
        ]
      }
      student_contacts: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          owner: string
          student_id: string
          type: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          owner?: string
          student_id: string
          type: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          owner?: string
          student_id?: string
          type?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_contacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "student_contacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
          {
            foreignKeyName: "student_contacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
        ]
      }
      student_intakes: {
        Row: {
          created_at: string
          discount_percent: number
          docs_ready: boolean
          id: string
          intake_id: string
          is_free_reapplication: boolean
          student_id: string
        }
        Insert: {
          created_at?: string
          discount_percent?: number
          docs_ready?: boolean
          id?: string
          intake_id: string
          is_free_reapplication?: boolean
          student_id: string
        }
        Update: {
          created_at?: string
          discount_percent?: number
          docs_ready?: boolean
          id?: string
          intake_id?: string
          is_free_reapplication?: boolean
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
          {
            foreignKeyName: "student_intakes_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "student_intakes_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "student_intakes_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "student_intakes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "student_intakes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
          {
            foreignKeyName: "student_intakes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
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
          {
            foreignKeyName: "student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
        ]
      }
      student_phones: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          phone: string
          phone_norm: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          phone: string
          phone_norm?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          phone?: string
          phone_norm?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_phones_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "student_phones_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["profile_user_id"]
          },
          {
            foreignKeyName: "student_phones_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
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
          {
            foreignKeyName: "student_suggestions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
        ]
      }
      student_university_choices: {
        Row: {
          change_note: string | null
          change_reason: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          institution_id: string
          rank: number
          responded_at: string | null
          status: string
          student_id: string
        }
        Insert: {
          change_note?: string | null
          change_reason?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id: string
          rank: number
          responded_at?: string | null
          status?: string
          student_id: string
        }
        Update: {
          change_note?: string | null
          change_reason?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id?: string
          rank?: number
          responded_at?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_university_choices_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_university_choices_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_university_choices_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_university_choices_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_university_choices_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_university_choices_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_university_choices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
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
          {
            foreignKeyName: "student_university_priorities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
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
      student_university_submissions: {
        Row: {
          copies: number | null
          id: string
          institution_id: string
          note: string | null
          offline_sent_at: string | null
          offline_sent_by: string | null
          online_submitted_at: string | null
          online_submitted_by: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          copies?: number | null
          id?: string
          institution_id: string
          note?: string | null
          offline_sent_at?: string | null
          offline_sent_by?: string | null
          online_submitted_at?: string | null
          online_submitted_by?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          copies?: number | null
          id?: string
          institution_id?: string
          note?: string | null
          offline_sent_at?: string | null
          offline_sent_by?: string | null
          online_submitted_at?: string | null
          online_submitted_by?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_university_submissions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_university_submissions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_university_submissions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_university_submissions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_university_submissions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_university_submissions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_university_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
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
      survey_questions: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          options: Json | null
          question_text: string
          question_type: string
          sort_order: number
          survey_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          question_text: string
          question_type?: string
          sort_order?: number
          survey_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          question_text?: string
          question_type?: string
          sort_order?: number
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answer: Json
          created_at: string
          id: string
          question_id: string
          survey_id: string
          user_id: string
        }
        Insert: {
          answer: Json
          created_at?: string
          id?: string
          question_id: string
          survey_id: string
          user_id: string
        }
        Update: {
          answer?: Json
          created_at?: string
          id?: string
          question_id?: string
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      surveys: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          starts_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
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
            foreignKeyName: "tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_investor_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "tasks_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "tasks_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "tasks_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
          },
        ]
      }
      telegram_business_connections: {
        Row: {
          can_reply: boolean
          connected_at: string
          id: string
          is_enabled: boolean
          owner_user_id: string | null
          owner_username: string | null
          raw: Json | null
          updated_at: string
          user_chat_id: string
        }
        Insert: {
          can_reply?: boolean
          connected_at?: string
          id: string
          is_enabled?: boolean
          owner_user_id?: string | null
          owner_username?: string | null
          raw?: Json | null
          updated_at?: string
          user_chat_id: string
        }
        Update: {
          can_reply?: boolean
          connected_at?: string
          id?: string
          is_enabled?: boolean
          owner_user_id?: string | null
          owner_username?: string | null
          raw?: Json | null
          updated_at?: string
          user_chat_id?: string
        }
        Relationships: []
      }
      telegram_outbox: {
        Row: {
          account_label: string | null
          attempts: number
          chat_id: string
          claimed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          media_filename: string | null
          media_mime: string | null
          media_path: string | null
          message_id: string | null
          reply_to_msg_id: number | null
          requested_by: string | null
          sent_at: string | null
          status: string
          text: string | null
          tg_message_id: number | null
        }
        Insert: {
          account_label?: string | null
          attempts?: number
          chat_id: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          media_filename?: string | null
          media_mime?: string | null
          media_path?: string | null
          message_id?: string | null
          reply_to_msg_id?: number | null
          requested_by?: string | null
          sent_at?: string | null
          status?: string
          text?: string | null
          tg_message_id?: number | null
        }
        Update: {
          account_label?: string | null
          attempts?: number
          chat_id?: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          media_filename?: string | null
          media_mime?: string | null
          media_path?: string | null
          message_id?: string | null
          reply_to_msg_id?: number | null
          requested_by?: string | null
          sent_at?: string | null
          status?: string
          text?: string | null
          tg_message_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_outbox_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      telegram_peer_cache: {
        Row: {
          access_hash: string
          account_label: string
          peer_id: string
          updated_at: string
        }
        Insert: {
          access_hash: string
          account_label: string
          peer_id: string
          updated_at?: string
        }
        Update: {
          access_hash?: string
          account_label?: string
          peer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_poll_state: {
        Row: {
          account_label: string
          date: number | null
          last_error: string | null
          last_run_at: string | null
          lease_until: string | null
          pts: number | null
          qts: number | null
          seq: number | null
          updated_at: string
        }
        Insert: {
          account_label: string
          date?: number | null
          last_error?: string | null
          last_run_at?: string | null
          lease_until?: string | null
          pts?: number | null
          qts?: number | null
          seq?: number | null
          updated_at?: string
        }
        Update: {
          account_label?: string
          date?: number | null
          last_error?: string | null
          last_run_at?: string | null
          lease_until?: string | null
          pts?: number | null
          qts?: number | null
          seq?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_userbot_status: {
        Row: {
          account_label: string
          created_at: string
          detail: string | null
          last_seen_at: string
          tg_user_id: string | null
          username: string | null
        }
        Insert: {
          account_label: string
          created_at?: string
          detail?: string | null
          last_seen_at?: string
          tg_user_id?: string | null
          username?: string | null
        }
        Update: {
          account_label?: string
          created_at?: string
          detail?: string | null
          last_seen_at?: string
          tg_user_id?: string | null
          username?: string | null
        }
        Relationships: []
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
          round_number: number
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
          round_number?: number
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
          round_number?: number
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
          {
            foreignKeyName: "university_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
          },
        ]
      }
      university_guideline_docs: {
        Row: {
          apostil: string | null
          etap_raqam: number | null
          guideline_uuid: string
          hujjat_nomi: string | null
          hujjat_nomi_asl: string | null
          id: string
          izoh: string | null
          kimlar_uchun: string | null
          majburiy: string | null
          muddat: string | null
          muddat_turi: string | null
          notarial_tarjima: string | null
          sahifa: string | null
          shakli: string | null
          tartib: number
        }
        Insert: {
          apostil?: string | null
          etap_raqam?: number | null
          guideline_uuid: string
          hujjat_nomi?: string | null
          hujjat_nomi_asl?: string | null
          id?: string
          izoh?: string | null
          kimlar_uchun?: string | null
          majburiy?: string | null
          muddat?: string | null
          muddat_turi?: string | null
          notarial_tarjima?: string | null
          sahifa?: string | null
          shakli?: string | null
          tartib: number
        }
        Update: {
          apostil?: string | null
          etap_raqam?: number | null
          guideline_uuid?: string
          hujjat_nomi?: string | null
          hujjat_nomi_asl?: string | null
          id?: string
          izoh?: string | null
          kimlar_uchun?: string | null
          majburiy?: string | null
          muddat?: string | null
          muddat_turi?: string | null
          notarial_tarjima?: string | null
          sahifa?: string | null
          shakli?: string | null
          tartib?: number
        }
        Relationships: [
          {
            foreignKeyName: "university_guideline_docs_guideline_uuid_fkey"
            columns: ["guideline_uuid"]
            isOneToOne: false
            referencedRelation: "university_guidelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_guideline_docs_guideline_uuid_fkey"
            columns: ["guideline_uuid"]
            isOneToOne: false
            referencedRelation: "v_app_university_catalog"
            referencedColumns: ["guideline_id"]
          },
        ]
      }
      university_guideline_faculties: {
        Row: {
          fakultet_en: string | null
          fakultet_kr: string | null
          guideline_uuid: string
          id: string
          ielts_min: number | null
          izoh: string | null
          kollej_en: string | null
          kollej_kr: string | null
          kontrakt_davri: string | null
          kontrakt_izoh: string | null
          kontrakt_summa: number | null
          sahifa: string | null
          tartib: number
          til_izoh: string | null
          toefl_ibt_min: number | null
          topik_min: number | null
          track: string | null
        }
        Insert: {
          fakultet_en?: string | null
          fakultet_kr?: string | null
          guideline_uuid: string
          id?: string
          ielts_min?: number | null
          izoh?: string | null
          kollej_en?: string | null
          kollej_kr?: string | null
          kontrakt_davri?: string | null
          kontrakt_izoh?: string | null
          kontrakt_summa?: number | null
          sahifa?: string | null
          tartib: number
          til_izoh?: string | null
          toefl_ibt_min?: number | null
          topik_min?: number | null
          track?: string | null
        }
        Update: {
          fakultet_en?: string | null
          fakultet_kr?: string | null
          guideline_uuid?: string
          id?: string
          ielts_min?: number | null
          izoh?: string | null
          kollej_en?: string | null
          kollej_kr?: string | null
          kontrakt_davri?: string | null
          kontrakt_izoh?: string | null
          kontrakt_summa?: number | null
          sahifa?: string | null
          tartib?: number
          til_izoh?: string | null
          toefl_ibt_min?: number | null
          topik_min?: number | null
          track?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_guideline_faculties_guideline_uuid_fkey"
            columns: ["guideline_uuid"]
            isOneToOne: false
            referencedRelation: "university_guidelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_guideline_faculties_guideline_uuid_fkey"
            columns: ["guideline_uuid"]
            isOneToOne: false
            referencedRelation: "v_app_university_catalog"
            referencedColumns: ["guideline_id"]
          },
        ]
      }
      university_guideline_rounds: {
        Row: {
          boshlanish_sana: string | null
          boshlanish_vaqt: string | null
          bosqich: number
          etap_nomi: string
          etap_raqam: number
          guideline_uuid: string
          holat: string | null
          id: string
          izoh: string | null
          sahifa: string | null
          tugash_sana: string | null
          tugash_vaqt: string | null
        }
        Insert: {
          boshlanish_sana?: string | null
          boshlanish_vaqt?: string | null
          bosqich: number
          etap_nomi: string
          etap_raqam: number
          guideline_uuid: string
          holat?: string | null
          id?: string
          izoh?: string | null
          sahifa?: string | null
          tugash_sana?: string | null
          tugash_vaqt?: string | null
        }
        Update: {
          boshlanish_sana?: string | null
          boshlanish_vaqt?: string | null
          bosqich?: number
          etap_nomi?: string
          etap_raqam?: number
          guideline_uuid?: string
          holat?: string | null
          id?: string
          izoh?: string | null
          sahifa?: string | null
          tugash_sana?: string | null
          tugash_vaqt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_guideline_rounds_guideline_uuid_fkey"
            columns: ["guideline_uuid"]
            isOneToOne: false
            referencedRelation: "university_guidelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_guideline_rounds_guideline_uuid_fkey"
            columns: ["guideline_uuid"]
            isOneToOne: false
            referencedRelation: "v_app_university_catalog"
            referencedColumns: ["guideline_id"]
          },
        ]
      }
      university_guidelines: {
        Row: {
          ariza_sayti: string | null
          ariza_tolovi: number | null
          ariza_tolovi_usuli: string | null
          ariza_tolovi_valyuta: string | null
          bank_izoh: string | null
          bank_saqlash_muddati: string | null
          bank_summa: number | null
          bank_turi: string | null
          bank_valyuta: string | null
          bank_vaqti: string | null
          created_at: string
          daraja: string | null
          english_track: boolean | null
          fakultet_soni: number
          fayl_nomi: string | null
          format_versiya: number | null
          guideline_fayl: string | null
          guideline_id: string
          guideline_sarlavha: string | null
          hujjat_yuborish_manzili: string | null
          id: string
          ielts_min: number | null
          institution_id: string
          io_email: string | null
          io_manzil_en: string | null
          io_manzil_kr: string | null
          io_telefon: string | null
          io_zip: string | null
          izoh: string | null
          kampus: string | null
          kirish_tolovi: number | null
          kontrakt_davri: string | null
          kontrakt_max: number | null
          kontrakt_min: number | null
          korean_track: boolean | null
          narx_valyuta: string | null
          qabul_yili: number | null
          sahifalar: string | null
          semestr: string | null
          shahar: string | null
          tahlil_sanasi: string | null
          tavsiyanoma: string | null
          tavsiyanoma_izoh: string | null
          til_izoh: string | null
          toefl_ibt_min: number | null
          topik_min: number | null
          univ_kod: string
          univ_nomi_en: string | null
          univ_nomi_kr: string | null
          updated_at: string
          yuklagan: string | null
        }
        Insert: {
          ariza_sayti?: string | null
          ariza_tolovi?: number | null
          ariza_tolovi_usuli?: string | null
          ariza_tolovi_valyuta?: string | null
          bank_izoh?: string | null
          bank_saqlash_muddati?: string | null
          bank_summa?: number | null
          bank_turi?: string | null
          bank_valyuta?: string | null
          bank_vaqti?: string | null
          created_at?: string
          daraja?: string | null
          english_track?: boolean | null
          fakultet_soni?: number
          fayl_nomi?: string | null
          format_versiya?: number | null
          guideline_fayl?: string | null
          guideline_id: string
          guideline_sarlavha?: string | null
          hujjat_yuborish_manzili?: string | null
          id?: string
          ielts_min?: number | null
          institution_id: string
          io_email?: string | null
          io_manzil_en?: string | null
          io_manzil_kr?: string | null
          io_telefon?: string | null
          io_zip?: string | null
          izoh?: string | null
          kampus?: string | null
          kirish_tolovi?: number | null
          kontrakt_davri?: string | null
          kontrakt_max?: number | null
          kontrakt_min?: number | null
          korean_track?: boolean | null
          narx_valyuta?: string | null
          qabul_yili?: number | null
          sahifalar?: string | null
          semestr?: string | null
          shahar?: string | null
          tahlil_sanasi?: string | null
          tavsiyanoma?: string | null
          tavsiyanoma_izoh?: string | null
          til_izoh?: string | null
          toefl_ibt_min?: number | null
          topik_min?: number | null
          univ_kod: string
          univ_nomi_en?: string | null
          univ_nomi_kr?: string | null
          updated_at?: string
          yuklagan?: string | null
        }
        Update: {
          ariza_sayti?: string | null
          ariza_tolovi?: number | null
          ariza_tolovi_usuli?: string | null
          ariza_tolovi_valyuta?: string | null
          bank_izoh?: string | null
          bank_saqlash_muddati?: string | null
          bank_summa?: number | null
          bank_turi?: string | null
          bank_valyuta?: string | null
          bank_vaqti?: string | null
          created_at?: string
          daraja?: string | null
          english_track?: boolean | null
          fakultet_soni?: number
          fayl_nomi?: string | null
          format_versiya?: number | null
          guideline_fayl?: string | null
          guideline_id?: string
          guideline_sarlavha?: string | null
          hujjat_yuborish_manzili?: string | null
          id?: string
          ielts_min?: number | null
          institution_id?: string
          io_email?: string | null
          io_manzil_en?: string | null
          io_manzil_kr?: string | null
          io_telefon?: string | null
          io_zip?: string | null
          izoh?: string | null
          kampus?: string | null
          kirish_tolovi?: number | null
          kontrakt_davri?: string | null
          kontrakt_max?: number | null
          kontrakt_min?: number | null
          korean_track?: boolean | null
          narx_valyuta?: string | null
          qabul_yili?: number | null
          sahifalar?: string | null
          semestr?: string | null
          shahar?: string | null
          tahlil_sanasi?: string | null
          tavsiyanoma?: string | null
          tavsiyanoma_izoh?: string | null
          til_izoh?: string | null
          toefl_ibt_min?: number | null
          topik_min?: number | null
          univ_kod?: string
          univ_nomi_en?: string | null
          univ_nomi_kr?: string | null
          updated_at?: string
          yuklagan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_guidelines_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_guidelines_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_guidelines_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_guidelines_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_guidelines_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_guidelines_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_guidelines_yuklagan_fkey"
            columns: ["yuklagan"]
            isOneToOne: false
            referencedRelation: "student_code_status"
            referencedColumns: ["auth_user_id"]
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
      uz_backfill_staging: {
        Row: {
          id: number
          ko: string
          uz: string | null
        }
        Insert: {
          id?: number
          ko: string
          uz?: string | null
        }
        Update: {
          id?: number
          ko?: string
          uz?: string | null
        }
        Relationships: []
      }
      voice_bakeoff_results: {
        Row: {
          bytes: number | null
          created_at: string | null
          error: string | null
          id: number
          provider: string | null
          sentence_id: string | null
          url: string | null
          voice: string | null
        }
        Insert: {
          bytes?: number | null
          created_at?: string | null
          error?: string | null
          id?: number
          provider?: string | null
          sentence_id?: string | null
          url?: string | null
          voice?: string | null
        }
        Update: {
          bytes?: number | null
          created_at?: string | null
          error?: string | null
          id?: number
          provider?: string | null
          sentence_id?: string | null
          url?: string | null
          voice?: string | null
        }
        Relationships: []
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
      zz_telegram_backup_20260728: {
        Row: {
          assigned_to: string | null
          content: string | null
          created_at: string | null
          direction: string | null
          external_id: string | null
          id: string | null
          message_type: string | null
          metadata: Json | null
          replied_at: string | null
          replied_by: string | null
          sender_avatar: string | null
          sender_id: string | null
          sender_name: string | null
          source: string | null
          status: string | null
          student_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          content?: string | null
          created_at?: string | null
          direction?: string | null
          external_id?: string | null
          id?: string | null
          message_type?: string | null
          metadata?: Json | null
          replied_at?: string | null
          replied_by?: string | null
          sender_avatar?: string | null
          sender_id?: string | null
          sender_name?: string | null
          source?: string | null
          status?: string | null
          student_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          content?: string | null
          created_at?: string | null
          direction?: string | null
          external_id?: string | null
          id?: string | null
          message_type?: string | null
          metadata?: Json | null
          replied_at?: string | null
          replied_by?: string | null
          sender_avatar?: string | null
          sender_id?: string | null
          sender_name?: string | null
          source?: string | null
          status?: string | null
          student_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      lead_channel_overview: {
        Row: {
          calls: number | null
          channels_used: number | null
          full_name: string | null
          instagram_messages: number | null
          last_analysis_at: string | null
          last_call_at: string | null
          last_contact_at: string | null
          last_instagram_at: string | null
          last_telegram_at: string | null
          lead_id: string | null
          pending_suggestions: number | null
          phone: string | null
          telegram_messages: number | null
        }
        Relationships: []
      }
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
      v_app_university_catalog: {
        Row: {
          ariza_tolovi: number | null
          ariza_tolovi_valyuta: string | null
          bank_summa: number | null
          bank_valyuta: string | null
          city_ko: string | null
          daraja: string | null
          english_track: boolean | null
          fakultet_soni: number | null
          guideline_id: string | null
          ielts_min: number | null
          ieqas_status: string | null
          institution_id: string | null
          institution_type: string | null
          is_active: boolean | null
          is_partner: boolean | null
          kampus: string | null
          kirish_tolovi: number | null
          kontrakt_davri: string | null
          kontrakt_max: number | null
          kontrakt_min: number | null
          korean_track: boolean | null
          name_en: string | null
          name_ko: string | null
          name_ko_short: string | null
          narx_valyuta: string | null
          qabul_yili: number | null
          region_code: string | null
          semestr: string | null
          shahar: string | null
          tavsiyanoma: string | null
          toefl_ibt_min: number | null
          topik_min: number | null
          univ_nomi_en: string | null
          univ_nomi_kr: string | null
          updated_at: string | null
          visa_restricted: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "university_guidelines_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_guidelines_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institution_content_counts"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_guidelines_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_institutions_for_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_guidelines_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_recruitment_for_interview"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_guidelines_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_recent_changes"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "university_guidelines_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_user_upcoming_deadlines"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      v_app_university_docs: {
        Row: {
          apostil: string | null
          guideline_id: string | null
          hujjat_nomi: string | null
          hujjat_nomi_en: string | null
          hujjat_nomi_ko: string | null
          hujjat_nomi_ru: string | null
          kimlar_uchun: string | null
          majburiy: string | null
          tartib: number | null
        }
        Relationships: [
          {
            foreignKeyName: "university_guideline_docs_guideline_uuid_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "university_guidelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_guideline_docs_guideline_uuid_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "v_app_university_catalog"
            referencedColumns: ["guideline_id"]
          },
        ]
      }
      v_app_university_faculties: {
        Row: {
          fakultet_en: string | null
          fakultet_kr: string | null
          guideline_id: string | null
          ielts_min: number | null
          kollej_en: string | null
          kollej_kr: string | null
          kontrakt_davri: string | null
          kontrakt_summa: number | null
          tartib: number | null
          toefl_ibt_min: number | null
          topik_min: number | null
          track: string | null
        }
        Insert: {
          fakultet_en?: string | null
          fakultet_kr?: string | null
          guideline_id?: string | null
          ielts_min?: number | null
          kollej_en?: string | null
          kollej_kr?: string | null
          kontrakt_davri?: string | null
          kontrakt_summa?: number | null
          tartib?: number | null
          toefl_ibt_min?: number | null
          topik_min?: number | null
          track?: string | null
        }
        Update: {
          fakultet_en?: string | null
          fakultet_kr?: string | null
          guideline_id?: string | null
          ielts_min?: number | null
          kollej_en?: string | null
          kollej_kr?: string | null
          kontrakt_davri?: string | null
          kontrakt_summa?: number | null
          tartib?: number | null
          toefl_ibt_min?: number | null
          topik_min?: number | null
          track?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_guideline_faculties_guideline_uuid_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "university_guidelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_guideline_faculties_guideline_uuid_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "v_app_university_catalog"
            referencedColumns: ["guideline_id"]
          },
        ]
      }
      v_app_university_rounds: {
        Row: {
          boshlanish_sana: string | null
          boshlanish_vaqt: string | null
          bosqich: number | null
          etap_nomi: string | null
          etap_raqam: number | null
          guideline_id: string | null
          holat: string | null
          tugash_sana: string | null
          tugash_vaqt: string | null
        }
        Insert: {
          boshlanish_sana?: string | null
          boshlanish_vaqt?: string | null
          bosqich?: number | null
          etap_nomi?: string | null
          etap_raqam?: number | null
          guideline_id?: string | null
          holat?: string | null
          tugash_sana?: string | null
          tugash_vaqt?: string | null
        }
        Update: {
          boshlanish_sana?: string | null
          boshlanish_vaqt?: string | null
          bosqich?: number | null
          etap_nomi?: string | null
          etap_raqam?: number | null
          guideline_id?: string | null
          holat?: string | null
          tugash_sana?: string | null
          tugash_vaqt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_guideline_rounds_guideline_uuid_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "university_guidelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_guideline_rounds_guideline_uuid_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "v_app_university_catalog"
            referencedColumns: ["guideline_id"]
          },
        ]
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
      v_guest_approved_admissions: {
        Row: {
          admission_fee_krw: number | null
          apostille_required: boolean | null
          application_end: string | null
          application_start: string | null
          city_ko: string | null
          document_deadline: string | null
          english_accepted: boolean | null
          ieqas_status: string | null
          institution_id: string | null
          intake_term: string | null
          intake_year: number | null
          interview_required: boolean | null
          is_partner: boolean | null
          logo_url: string | null
          name_en: string | null
          name_ko: string | null
          name_ko_short: string | null
          name_uz: string | null
          primary_domain: string | null
          required_document_count: number | null
          tier: number | null
          topik_min_level: number | null
          tuition_academic_year: number | null
          tuition_max_krw: number | null
          tuition_min_krw: number | null
        }
        Relationships: [
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
        ]
      }
      v_institution_announcements: {
        Row: {
          classifier_label: string | null
          detected_at: string | null
          id: string | null
          institution_id: string | null
          posted_at: string | null
          title_ko: string | null
          url_ko: string | null
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
          has_intake_data: boolean | null
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
          primary_domain: string | null
          tier: number | null
          virtual_tour: Json | null
          walkaround_url: string | null
        }
        Insert: {
          city_ko?: string | null
          has_intake_data?: never
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
          primary_domain?: string | null
          tier?: number | null
          virtual_tour?: Json | null
          walkaround_url?: string | null
        }
        Update: {
          city_ko?: string | null
          has_intake_data?: never
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
          primary_domain?: string | null
          tier?: number | null
          virtual_tour?: Json | null
          walkaround_url?: string | null
        }
        Relationships: []
      }
      v_investor_applications: {
        Row: {
          application_id: string | null
          days_since_movement: number | null
          intake_id: string | null
          plan: string | null
          program: string | null
          status: string | null
          student_name: string | null
          submitted_at: string | null
          university: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "applications_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "applications_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
          },
        ]
      }
      v_investor_intakes: {
        Row: {
          ends_on: string | null
          intake_id: string | null
          is_default: boolean | null
          is_open: boolean | null
          label: string | null
          season: string | null
          sort_key: number | null
          starts_on: string | null
          year: number | null
        }
        Insert: {
          ends_on?: string | null
          intake_id?: string | null
          is_default?: boolean | null
          is_open?: boolean | null
          label?: never
          season?: string | null
          sort_key?: never
          starts_on?: string | null
          year?: number | null
        }
        Update: {
          ends_on?: string | null
          intake_id?: string | null
          is_default?: boolean | null
          is_open?: boolean | null
          label?: never
          season?: string | null
          sort_key?: never
          starts_on?: string | null
          year?: number | null
        }
        Relationships: []
      }
      v_investor_lead_monthly: {
        Row: {
          converted_count: number | null
          intake_id: string | null
          lead_count: number | null
          month: string | null
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
            foreignKeyName: "leads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "leads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "leads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
          },
        ]
      }
      v_investor_lead_sources: {
        Row: {
          converted_count: number | null
          converted_pct: number | null
          intake_id: string | null
          lead_count: number | null
          source: string | null
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
            foreignKeyName: "leads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_intakes"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "leads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_funnel"
            referencedColumns: ["intake_id"]
          },
          {
            foreignKeyName: "leads_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "v_investor_season_leads"
            referencedColumns: ["intake_id"]
          },
        ]
      }
      v_investor_position: {
        Row: {
          currency: string | null
          equity_percent: number | null
          full_name: string | null
          intake_id: string | null
          invested_amount_usd: number | null
          invested_at: string | null
          investor_id: string | null
          profit_share: number | null
          season_discounts_given: number | null
          season_expenses: number | null
          season_net_profit: number | null
          season_revenue: number | null
        }
        Relationships: []
      }
      v_investor_season_funnel: {
        Row: {
          intake_id: string | null
          stage: string | null
          stage_order: number | null
          student_count: number | null
        }
        Relationships: []
      }
      v_investor_season_leads: {
        Row: {
          contacted_leads: number | null
          conversion_pct: number | null
          converted_leads: number | null
          intake_id: string | null
          leads_last_30_days: number | null
          lost_leads: number | null
          new_leads: number | null
          qualified_leads: number | null
          total_leads: number | null
        }
        Relationships: []
      }
      v_investor_season_monthly: {
        Row: {
          currency: string | null
          discounts_given: number | null
          expenses: number | null
          intake_id: string | null
          margin_pct: number | null
          month: string | null
          net: number | null
          revenue: number | null
        }
        Relationships: []
      }
      v_investor_season_pnl: {
        Row: {
          amount: number | null
          currency: string | null
          intake_id: string | null
          line_item: string | null
          pct_of_revenue: number | null
          side: string | null
        }
        Relationships: []
      }
      v_investor_staff_directory: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          presence_status: string | null
          role: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_learning_center_students: {
        Row: {
          age: number | null
          already_lead: boolean | null
          center_id: string | null
          city: string | null
          created_at: string | null
          english_level: string | null
          full_name: string | null
          id: string | null
          korean_level: string | null
          lead_status: string | null
          notes: string | null
          phone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_center_students_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "learning_centers"
            referencedColumns: ["id"]
          },
        ]
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
      v_pipeline_health: {
        Row: {
          crawl_fails_24h: number | null
          crawler_enabled: boolean | null
          crawls_24h: number | null
          dispatcher_last_run_at: string | null
          dispatcher_last_status: string | null
          extraction_fails_7d: number | null
          inst_in_cooldown: number | null
          inst_never_crawled: number | null
          inst_with_url: number | null
          last_crawl_at: string | null
          last_extraction_at: string | null
          reviews_open: number | null
          sources_overdue: number | null
          sources_pending_review: number | null
          zombie_runs: number | null
        }
        Relationships: []
      }
      v_proposed_links_dashboard: {
        Row: {
          candidate_snippet: string | null
          candidate_title: string | null
          closed_by_person: boolean | null
          dismiss_detail: string | null
          dismiss_reason: string | null
          id: string | null
          proposed_at: string | null
          proposed_by: string | null
          review_notes: string | null
          reviewed_at: string | null
          source_type: string | null
          status: string | null
          url_ko: string | null
          was_closed: boolean | null
        }
        Insert: {
          candidate_snippet?: string | null
          candidate_title?: string | null
          closed_by_person?: never
          dismiss_detail?: string | null
          dismiss_reason?: string | null
          id?: string | null
          proposed_at?: string | null
          proposed_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          source_type?: string | null
          status?: string | null
          url_ko?: string | null
          was_closed?: never
        }
        Update: {
          candidate_snippet?: string | null
          candidate_title?: string | null
          closed_by_person?: never
          dismiss_detail?: string | null
          dismiss_reason?: string | null
          id?: string | null
          proposed_at?: string | null
          proposed_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          source_type?: string | null
          status?: string | null
          url_ko?: string | null
          was_closed?: never
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
      v_rejected_awaiting_requeue: {
        Row: {
          field_group: string | null
          file_hash_sha256: string | null
          guideline_document_id: string | null
          institution_id: string | null
          queue_id: string | null
          reason: string | null
          reject_count: number | null
          resolved_at: string | null
          storage_path: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extraction_jobs_guideline_document_id_fkey"
            columns: ["guideline_document_id"]
            isOneToOne: false
            referencedRelation: "guideline_documents"
            referencedColumns: ["id"]
          },
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
        ]
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
          doc_academic_year: number | null
          doc_semester: string | null
          entity_id: string | null
          entity_type: string | null
          field_group: string | null
          guideline_document_id: string | null
          id: string | null
          institution_id: string | null
          min_row_confidence: number | null
          name_en: string | null
          name_ko: string | null
          needs_attention: boolean | null
          parsed_output: Json | null
          priority: number | null
          reason: string | null
          reviewer_decision: Json | null
          reviewer_notes: string | null
          source_url_ko: string | null
          status: string | null
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
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_investor_staff_directory"
            referencedColumns: ["user_id"]
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
      _attach_student_conversations: {
        Args: { p_student_id: string }
        Returns: Json
      }
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
      accept_lead_suggestion: {
        Args: { p_suggestion_id: string; p_value?: string }
        Returns: {
          confidence: number | null
          corrected_value: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          evidence: string | null
          evidence_channel: string | null
          field: string
          id: string
          lead_id: string
          model: string | null
          sources: Json
          status: string
          suggested_value: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lead_field_suggestions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_get_auth_user_id_by_email: {
        Args: { p_email: string }
        Returns: string
      }
      ai_is_staff: { Args: { p_uid: string }; Returns: boolean }
      ai_list_documents: {
        Args: {
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
          p_student_id?: string
          p_to?: string
        }
        Returns: Json
      }
      ai_list_leads: {
        Args: {
          p_city?: string
          p_exam_type?: string
          p_from_exam_date?: string
          p_interest_level?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_source?: string
          p_status?: string
          p_to_exam_date?: string
        }
        Returns: Json
      }
      ai_list_payments: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_overdue_only?: boolean
          p_status?: string
          p_student_id?: string
        }
        Returns: Json
      }
      ai_list_students: {
        Args: {
          p_city?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
        }
        Returns: Json
      }
      ai_list_tasks: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_priority?: string
          p_status?: string
        }
        Returns: Json
      }
      ai_search_by_field: {
        Args: { p_terms: string[] }
        Returns: {
          guideline_id: string
          institution_id: string
          match_count: number
          matched: string[]
        }[]
      }
      ai_search_take: {
        Args: { p_global_limit: number; p_key: string; p_limit: number }
        Returns: boolean
      }
      ai_stats: { Args: never; Returns: Json }
      app_events_log: {
        Args: {
          p_app_version: string
          p_events: Json
          p_install_id: string
          p_platform: string
        }
        Returns: number
      }
      app_events_staff_can_read: { Args: never; Returns: boolean }
      app_events_summary: { Args: { p_days?: number }; Returns: Json }
      app_install_link_lead: {
        Args: { p_install_id: string; p_link_code: string }
        Returns: boolean
      }
      app_login: {
        Args: { p_password: string; p_phone: string }
        Returns: Json
      }
      app_quiz_submit: {
        Args: {
          p_answers: Json
          p_name: string
          p_phone: string
          p_result: Json
        }
        Returns: Json
      }
      app_register: {
        Args: { p_password: string; p_phone: string }
        Returns: Json
      }
      attach_student_conversations: {
        Args: { p_student_id: string }
        Returns: Json
      }
      can_approve_documents: { Args: { p_uid?: string }; Returns: boolean }
      can_edit_application_fees: { Args: never; Returns: boolean }
      can_edit_university_catalog: { Args: never; Returns: boolean }
      can_manage_learning_centers: { Args: never; Returns: boolean }
      claim_lead_link: {
        Args: {
          p_channel: string
          p_code: string
          p_identifier: string
          p_label?: string
        }
        Returns: Json
      }
      claim_telegram_outbox: {
        Args: { p_account_label?: string; p_limit?: number }
        Returns: {
          account_label: string | null
          attempts: number
          chat_id: string
          claimed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          media_filename: string | null
          media_mime: string | null
          media_path: string | null
          message_id: string | null
          reply_to_msg_id: number | null
          requested_by: string | null
          sent_at: string | null
          status: string
          text: string | null
          tg_message_id: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "telegram_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_telegram_outbox: {
        Args: {
          p_error?: string
          p_id: string
          p_ok: boolean
          p_tg_message_id?: number
        }
        Returns: undefined
      }
      current_chat_intake_id: { Args: never; Returns: string }
      current_default_intake_id: { Args: never; Returns: string }
      current_investor_id: { Args: never; Returns: string }
      enqueue_student_track_infer: {
        Args: { p_student: string }
        Returns: undefined
      }
      extract_doc_type_tag: { Args: { doc_name: string }; Returns: string }
      extract_uz_phone: { Args: { txt: string }; Returns: string }
      fn_after_hours_reply_claim: {
        Args: { p_dry?: boolean }
        Returns: {
          id: string
          reply_text: string
          source: string
          source_id: string
        }[]
      }
      fn_after_hours_reply_text: { Args: { p_at: string }; Returns: string }
      fn_after_hours_reply_texts: { Args: never; Returns: string[] }
      fn_app_texts_untranslated: {
        Args: { p_limit?: number }
        Returns: {
          source: string
        }[]
      }
      fn_can_review_uni_db: { Args: { p_uid?: string }; Returns: boolean }
      fn_channel_health_scan: { Args: never; Returns: Json }
      fn_claim_review_queue: {
        Args: { priorities?: number[]; reviewer_id?: string }
        Returns: string
      }
      fn_delete_my_account: { Args: never; Returns: undefined }
      fn_extract_phone: { Args: { p_text: string }; Returns: string }
      fn_flag_source_wrong: {
        Args: {
          detail?: string
          queue_item_id: string
          reviewer_user_id?: string
        }
        Returns: number
      }
      fn_gc_change_event_outbox: { Args: never; Returns: number }
      fn_gc_cron_job_run_details: { Args: never; Returns: number }
      fn_gc_pdf_access_log: { Args: never; Returns: number }
      fn_gc_user_push_tokens: { Args: never; Returns: number }
      fn_invoke_crawl_dispatcher: { Args: never; Returns: number }
      fn_invoke_notify_tracked_changes: { Args: never; Returns: number }
      fn_is_app_user: { Args: never; Returns: boolean }
      fn_is_automatic_outgoing: {
        Args: { p_content: string; p_metadata: Json }
        Returns: boolean
      }
      fn_is_correction_payload: { Args: { payload: Json }; Returns: boolean }
      fn_is_student_phone: { Args: { p_national: string }; Returns: boolean }
      fn_lead_alerts_open: {
        Args: { p_now: string; p_start: string }
        Returns: boolean
      }
      fn_lead_daily_report_claim: {
        Args: { p_dry?: boolean }
        Returns: {
          answered: number
          new_leads: number
          report_day: string
          unanswered: number
        }[]
      }
      fn_lead_quick_contact_scan: {
        Args: { p_dry?: boolean }
        Returns: {
          closed_by: string
          full_name: string
          id: string
          seconds: number
          source: string
        }[]
      }
      fn_lead_sla_scan: {
        Args: { p_dry?: boolean; p_minutes?: number }
        Returns: {
          arrived_at: string
          full_name: string
          how_heard: string
          id: string
          minutes_waiting: number
          phone: string
          source: string
        }[]
      }
      fn_lead_sla_start: { Args: { p_at: string }; Returns: string }
      fn_phone_keys: { Args: { p_text: string }; Returns: string[] }
      fn_pick_next_reviewer: {
        Args: { include_admins?: boolean }
        Returns: string
      }
      fn_pipeline_watchdog: { Args: never; Returns: undefined }
      fn_reject_reason_lane: { Args: { reason: string }; Returns: string }
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
      fn_review_save_edit: {
        Args: {
          corrected_payload: Json
          queue_item_id: string
          reviewer_notes?: string
          reviewer_user_id?: string
        }
        Returns: string
      }
      fn_routine_supervisor: { Args: never; Returns: undefined }
      fn_split_guideline_document_by_degree: {
        Args: {
          p_document_id: string
          p_grad_track?: string
          p_intake_term?: string
          p_intake_year?: number
          p_undergrad_track?: string
        }
        Returns: {
          grad_cycle_id: string
          undergrad_cycle_id: string
        }[]
      }
      fn_uz_national_phone: { Args: { p_phone: string }; Returns: string }
      get_regional_stats: { Args: never; Returns: Json }
      get_thread_messages: {
        Args: {
          p_before?: string
          p_before_id?: string
          p_limit?: number
          p_sender_id: string
          p_source: string
        }
        Returns: {
          assigned_to: string | null
          client_msg_id: string | null
          content: string
          created_at: string
          delivery_error: string | null
          delivery_status: string | null
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
        }[]
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_thread_preview: {
        Args: { p_id: string }
        Returns: {
          assigned_to: string
          id: string
          intake_id: string
          last_content: string
          last_created_at: string
          last_delivery_status: string
          last_direction: string
          last_message_at: string
          last_message_type: string
          last_metadata: Json
          sender_avatar: string
          sender_id: string
          sender_name: string
          source: string
          status: string
          student_id: string
          unread_count: number
        }[]
      }
      get_thread_previews: {
        Args: never
        Returns: {
          assigned_to: string
          id: string
          intake_id: string
          last_content: string
          last_created_at: string
          last_delivery_status: string
          last_direction: string
          last_message_at: string
          last_message_type: string
          last_metadata: Json
          sender_avatar: string
          sender_id: string
          sender_name: string
          source: string
          status: string
          student_id: string
          unread_count: number
        }[]
      }
      hanguk_normalize_name: { Args: { p: string }; Returns: string }
      has_finance_access: { Args: { p_uid?: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hybrid_search_content: {
        Args: {
          filter_lead_id?: string
          filter_source_type?: string
          filter_student_id?: string
          full_text_weight?: number
          match_count?: number
          query_embedding: string
          query_text: string
          rrf_k?: number
          semantic_weight?: number
        }
        Returns: {
          channel: string
          content: string
          created_at: string
          id: string
          lead_id: string
          score: number
          source_id: string
          source_type: string
          student_id: string
        }[]
      }
      import_university_guideline: { Args: { payload: Json }; Returns: Json }
      increment_thread_unread: {
        Args: { p_sender_id: string; p_sender_name: string; p_source: string }
        Returns: undefined
      }
      intake_sort_key: {
        Args: { p_season: string; p_year: number }
        Returns: number
      }
      investor_can_view_intake: {
        Args: { p_intake_id: string }
        Returns: boolean
      }
      is_blocked_link: { Args: { url: string }; Returns: boolean }
      is_investor: { Args: { p_uid?: string }; Returns: boolean }
      is_non_investor_staff: { Args: never; Returns: boolean }
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff_user: { Args: { p_uid: string }; Returns: boolean }
      lead_timeline: {
        Args: { p_lead_id: string; p_limit?: number }
        Returns: {
          at: string
          author: string
          body: string
          channel: string
          direction: string
          id: string
          seconds: number
          status: string
        }[]
      }
      link_chat_identities_by_phone: {
        Args: never
        Returns: {
          out_channel: string
          out_inserted: number
          out_relinked: number
        }[]
      }
      link_dedup_key: { Args: { url: string }; Returns: string }
      link_host: { Args: { url: string }; Returns: string }
      link_lead_channel: {
        Args: {
          p_channel: string
          p_force?: boolean
          p_lead_id: string
          p_value: string
        }
        Returns: Json
      }
      link_student_channel: {
        Args: {
          p_channel: string
          p_force?: boolean
          p_student_id: string
          p_value: string
        }
        Returns: Json
      }
      mark_thread_read: {
        Args: { p_sender_id: string; p_source: string }
        Returns: number
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
          lead_id: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
          student_id: string
        }[]
      }
      my_learning_center_id: { Args: never; Returns: string }
      my_university_choices: {
        Args: never
        Returns: {
          change_note: string
          change_reason: string
          city: string
          confirmed_at: string
          id: string
          ielts_min: number
          institution_id: string
          is_partner: boolean
          kontrakt_davri: string
          kontrakt_min: number
          name_en: string
          name_ko: string
          narx_valyuta: string
          online_deadline: string
          rank: number
          responded_at: string
          status: string
          student_ielts: number
          student_topik: number
          topik_min: number
        }[]
      }
      normalize_handle: { Args: { txt: string }; Returns: string }
      normalize_phone: { Args: { p: string }; Returns: string }
      orbit_pull_finance: { Args: { p_from: string }; Returns: Json }
      orbit_pull_tasks: { Args: { p_since: string }; Returns: Json }
      orbit_staff: { Args: never; Returns: Json }
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
      phone_key: { Args: { txt: string }; Returns: string }
      push_recipients: {
        Args: never
        Returns: {
          devices: number
          full_name: string
          last_seen_at: string
          phone: string
          user_id: string
        }[]
      }
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
      reject_lead_suggestion: {
        Args: { p_suggestion_id: string }
        Returns: {
          confidence: number | null
          corrected_value: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          evidence: string | null
          evidence_channel: string | null
          field: string
          id: string
          lead_id: string
          model: string | null
          sources: Json
          status: string
          suggested_value: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lead_field_suggestions"
          isOneToOne: true
          isSetofReturn: false
        }
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
      respond_university_choice: {
        Args: {
          p_accept: boolean
          p_choice_id: string
          p_note?: string
          p_reason?: string
        }
        Returns: undefined
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
      search_students: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          full_name: string
          phone: string
          score: number
          user_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      staff_bonus_amount: { Args: { p_student_id: string }; Returns: number }
      student_phone_keys: {
        Args: { p_student_id: string }
        Returns: {
          k: string
        }[]
      }
      student_timeline: {
        Args: { p_limit?: number; p_student_id: string }
        Returns: {
          at: string
          author: string
          body: string
          channel: string
          direction: string
          id: string
          seconds: number
          status: string
        }[]
      }
      telegram_poll_acquire: {
        Args: { p_label: string; p_lease_seconds: number }
        Returns: {
          date: number
          pts: number
          qts: number
          seq: number
        }[]
      }
      telegram_poll_release: {
        Args: { p_error: string; p_label: string }
        Returns: undefined
      }
      telegram_poll_save: {
        Args: {
          p_date: number
          p_label: string
          p_pts: number
          p_qts: number
          p_seq: number
        }
        Returns: undefined
      }
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
        | "investor"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
        "investor",
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
