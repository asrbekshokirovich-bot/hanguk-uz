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
      application_form_cache: {
        Row: {
          analyzed_data: Json | null
          created_at: string
          field_confidence: Json | null
          form_url: string | null
          id: string
          is_valid: boolean
          last_validated_at: string | null
          program_level: string
          scraped_at: string
          scraped_content: string | null
          semester: string
          source: string | null
          university_id: string
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
          is_valid?: boolean
          last_validated_at?: string | null
          program_level: string
          scraped_at?: string
          scraped_content?: string | null
          semester: string
          source?: string | null
          university_id: string
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
          is_valid?: boolean
          last_validated_at?: string | null
          program_level?: string
          scraped_at?: string
          scraped_content?: string | null
          semester?: string
          source?: string | null
          university_id?: string
          updated_at?: string
          validation_status?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "application_form_cache_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
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
          new_value: string | null
          notes: string | null
          old_value: string | null
          severity: string
          university_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          cache_id: string
          change_type: string
          detected_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          severity?: string
          university_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          cache_id?: string
          change_type?: string
          detected_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          severity?: string
          university_id?: string
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
            foreignKeyName: "application_form_changes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      application_form_validations: {
        Row: {
          cache_id: string
          discrepancies: Json | null
          field_confidence_scores: Json | null
          id: string
          overall_confidence: number
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          university_id: string
          validated_at: string
          validation_type: string
        }
        Insert: {
          cache_id: string
          discrepancies?: Json | null
          field_confidence_scores?: Json | null
          id?: string
          overall_confidence?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          university_id: string
          validated_at?: string
          validation_type: string
        }
        Update: {
          cache_id?: string
          discrepancies?: Json | null
          field_confidence_scores?: Json | null
          id?: string
          overall_confidence?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          university_id?: string
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
            foreignKeyName: "application_form_validations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          decision: string | null
          decision_at: string | null
          id: string
          notes: string | null
          status: string
          status_history: Json | null
          student_id: string
          submitted_at: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision?: string | null
          decision_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          status_history?: Json | null
          student_id: string
          submitted_at?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: string | null
          decision_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          status_history?: Json | null
          student_id?: string
          submitted_at?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "applications_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
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
        ]
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
        Relationships: []
      }
      documents: {
        Row: {
          application_id: string | null
          created_at: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
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
            foreignKeyName: "documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
            foreignKeyName: "expenses_linked_transaction_id_fkey"
            columns: ["linked_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      gks_designated_universities: {
        Row: {
          created_at: string
          gks_program_info_id: string
          id: string
          is_global_network: boolean | null
          is_rd: boolean | null
          is_uic: boolean | null
          slot_allocation: number | null
          university_id: string
          university_type: string | null
        }
        Insert: {
          created_at?: string
          gks_program_info_id: string
          id?: string
          is_global_network?: boolean | null
          is_rd?: boolean | null
          is_uic?: boolean | null
          slot_allocation?: number | null
          university_id: string
          university_type?: string | null
        }
        Update: {
          created_at?: string
          gks_program_info_id?: string
          id?: string
          is_global_network?: boolean | null
          is_rd?: boolean | null
          is_uic?: boolean | null
          slot_allocation?: number | null
          university_id?: string
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
            foreignKeyName: "gks_designated_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
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
          is_active: boolean
          question_en: string | null
          question_ko: string
          question_ru: string | null
          question_uz: string | null
          sample_answer: string | null
          tips: string | null
          university_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          difficulty?: string
          id?: string
          is_active?: boolean
          question_en?: string | null
          question_ko: string
          question_ru?: string | null
          question_uz?: string | null
          sample_answer?: string | null
          tips?: string | null
          university_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          difficulty?: string
          id?: string
          is_active?: boolean
          question_en?: string | null
          question_ko?: string
          question_ru?: string | null
          question_uz?: string | null
          sample_answer?: string | null
          tips?: string | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_questions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
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
          target_university_id: string | null
          time_limit_seconds: number | null
          timed_mode: boolean | null
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
          target_university_id?: string | null
          time_limit_seconds?: number | null
          timed_mode?: boolean | null
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
          target_university_id?: string | null
          time_limit_seconds?: number | null
          timed_mode?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "universities"
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
          full_name: string
          how_heard: string | null
          id: string
          interest_level: string | null
          korean_level: string | null
          last_contacted_at: string | null
          next_follow_up: string | null
          notes: string | null
          payment_plan: string | null
          phone: string | null
          preferred_program: string | null
          preferred_start_date: string | null
          preferred_university: string | null
          priority_score: number | null
          source: string
          source_id: string | null
          status: string
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
          full_name: string
          how_heard?: string | null
          id?: string
          interest_level?: string | null
          korean_level?: string | null
          last_contacted_at?: string | null
          next_follow_up?: string | null
          notes?: string | null
          payment_plan?: string | null
          phone?: string | null
          preferred_program?: string | null
          preferred_start_date?: string | null
          preferred_university?: string | null
          priority_score?: number | null
          source?: string
          source_id?: string | null
          status?: string
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
          full_name?: string
          how_heard?: string | null
          id?: string
          interest_level?: string | null
          korean_level?: string | null
          last_contacted_at?: string | null
          next_follow_up?: string | null
          notes?: string | null
          payment_plan?: string | null
          phone?: string | null
          preferred_program?: string | null
          preferred_start_date?: string | null
          preferred_university?: string | null
          priority_score?: number | null
          source?: string
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
          last_message_at?: string
          sender_avatar?: string | null
          sender_id?: string
          sender_name?: string | null
          source?: string
          status?: string
          student_id?: string | null
          unread_count?: number
        }
        Relationships: []
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
      notifications: {
        Row: {
          body: string
          data: Json | null
          id: string
          notification_type: string | null
          read_at: string | null
          sent_at: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          data?: Json | null
          id?: string
          notification_type?: string | null
          read_at?: string | null
          sent_at?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          data?: Json | null
          id?: string
          notification_type?: string | null
          read_at?: string | null
          sent_at?: string
          title?: string
          user_id?: string
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
          invoice_number: string | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          payment_type: string
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
          invoice_number?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_type: string
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
          invoice_number?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_type?: string
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
        ]
      }
      peer_review_queue: {
        Row: {
          document_type: string
          draft_id: string | null
          id: string
          is_matched: boolean | null
          language: string | null
          submitted_at: string | null
          university_id: string | null
        }
        Insert: {
          document_type: string
          draft_id?: string | null
          id?: string
          is_matched?: boolean | null
          language?: string | null
          submitted_at?: string | null
          university_id?: string | null
        }
        Update: {
          document_type?: string
          draft_id?: string | null
          id?: string
          is_matched?: boolean | null
          language?: string | null
          submitted_at?: string | null
          university_id?: string | null
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
            foreignKeyName: "peer_review_queue_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
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
          avatar_url: string | null
          birth_date: string | null
          city: string | null
          contract_date: string | null
          contract_url: string | null
          created_at: string
          full_name: string | null
          id: string
          ielts_score: number | null
          is_gks_applicant: boolean | null
          korean_region_preference: string | null
          language_track: string | null
          magic_code: string | null
          notes: string | null
          office_location: string | null
          payment_mode: string | null
          payment_plan: string | null
          phone: string | null
          preferred_language: string | null
          study_work_priority: string | null
          topik_level: number | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          contract_date?: string | null
          contract_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          ielts_score?: number | null
          is_gks_applicant?: boolean | null
          korean_region_preference?: string | null
          language_track?: string | null
          magic_code?: string | null
          notes?: string | null
          office_location?: string | null
          payment_mode?: string | null
          payment_plan?: string | null
          phone?: string | null
          preferred_language?: string | null
          study_work_priority?: string | null
          topik_level?: number | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          contract_date?: string | null
          contract_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          ielts_score?: number | null
          is_gks_applicant?: boolean | null
          korean_region_preference?: string | null
          language_track?: string | null
          magic_code?: string | null
          notes?: string | null
          office_location?: string | null
          payment_mode?: string | null
          payment_plan?: string | null
          phone?: string | null
          preferred_language?: string | null
          study_work_priority?: string | null
          topik_level?: number | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
            foreignKeyName: "scheduled_payments_linked_payment_id_fkey"
            columns: ["linked_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
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
          university_id: string | null
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
          university_id?: string | null
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
          university_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
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
          allocated_amount: number
          allocated_from_payment_id: string | null
          category: string
          created_at: string | null
          currency: string
          id: string
          notes: string | null
          spent_amount: number | null
          status: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          allocated_amount: number
          allocated_from_payment_id?: string | null
          category: string
          created_at?: string | null
          currency?: string
          id?: string
          notes?: string | null
          spent_amount?: number | null
          status?: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          allocated_amount?: number
          allocated_from_payment_id?: string | null
          category?: string
          created_at?: string | null
          currency?: string
          id?: string
          notes?: string | null
          spent_amount?: number | null
          status?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_budgets_allocated_from_payment_id_fkey"
            columns: ["allocated_from_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
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
        Relationships: []
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
        Relationships: []
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
          started_at: string
          status: string
          student_id: string
          target_university_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          document_type: string
          id?: string
          started_at?: string
          status?: string
          student_id: string
          target_university_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          document_type?: string
          id?: string
          started_at?: string
          status?: string
          student_id?: string
          target_university_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_sessions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
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
        ]
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
          requested_by: string | null
          source_document_id: string | null
          source_file_path: string
          status: string
          student_id: string
          supporting_documents: Json | null
          translated_file_path: string | null
          translated_text: string | null
          updated_at: string
        }
        Insert: {
          auto_triggered?: boolean
          completed_at?: string | null
          created_at?: string
          document_type_id: string
          error_message?: string | null
          id?: string
          requested_by?: string | null
          source_document_id?: string | null
          source_file_path: string
          status?: string
          student_id: string
          supporting_documents?: Json | null
          translated_file_path?: string | null
          translated_text?: string | null
          updated_at?: string
        }
        Update: {
          auto_triggered?: boolean
          completed_at?: string | null
          created_at?: string
          document_type_id?: string
          error_message?: string | null
          id?: string
          requested_by?: string | null
          source_document_id?: string | null
          source_file_path?: string
          status?: string
          student_id?: string
          supporting_documents?: Json | null
          translated_file_path?: string | null
          translated_text?: string | null
          updated_at?: string
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
      universities: {
        Row: {
          acceptance_rate: number | null
          city_en: string | null
          city_ko: string | null
          city_ru: string | null
          city_uz: string | null
          created_at: string
          description_en: string | null
          description_ko: string | null
          description_ru: string | null
          description_uz: string | null
          id: string
          institution_type: string | null
          is_partner: boolean | null
          is_visible_on_map: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name_en: string | null
          name_ko: string | null
          name_ru: string | null
          name_uz: string
          programs: string[] | null
          ranking: number | null
          requirements_en: string | null
          requirements_ko: string | null
          requirements_ru: string | null
          requirements_uz: string | null
          tuition_max: number | null
          tuition_min: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          acceptance_rate?: number | null
          city_en?: string | null
          city_ko?: string | null
          city_ru?: string | null
          city_uz?: string | null
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          description_ru?: string | null
          description_uz?: string | null
          id?: string
          institution_type?: string | null
          is_partner?: boolean | null
          is_visible_on_map?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name_en?: string | null
          name_ko?: string | null
          name_ru?: string | null
          name_uz: string
          programs?: string[] | null
          ranking?: number | null
          requirements_en?: string | null
          requirements_ko?: string | null
          requirements_ru?: string | null
          requirements_uz?: string | null
          tuition_max?: number | null
          tuition_min?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          acceptance_rate?: number | null
          city_en?: string | null
          city_ko?: string | null
          city_ru?: string | null
          city_uz?: string | null
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          description_ru?: string | null
          description_uz?: string | null
          id?: string
          institution_type?: string | null
          is_partner?: boolean | null
          is_visible_on_map?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name_en?: string | null
          name_ko?: string | null
          name_ru?: string | null
          name_uz?: string
          programs?: string[] | null
          ranking?: number | null
          requirements_en?: string | null
          requirements_ko?: string | null
          requirements_ru?: string | null
          requirements_uz?: string | null
          tuition_max?: number | null
          tuition_min?: number | null
          updated_at?: string
          website?: string | null
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
          created_at: string
          document_deadline: string | null
          id: string
          language_track: string | null
          program_level: string
          result_announcement: string | null
          semester: string
          university_id: string
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
          created_at?: string
          document_deadline?: string | null
          id?: string
          language_track?: string | null
          program_level: string
          result_announcement?: string | null
          semester: string
          university_id: string
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
          created_at?: string
          document_deadline?: string | null
          id?: string
          language_track?: string | null
          program_level?: string
          result_announcement?: string | null
          semester?: string
          university_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "university_admission_periods_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      university_announcements: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          posted_by: string
          priority: string
          room_id: string
          title: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          posted_by: string
          priority?: string
          room_id: string
          title: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          posted_by?: string
          priority?: string
          room_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_announcements_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "university_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      university_document_requirements: {
        Row: {
          created_at: string | null
          document_type: string
          formatting_notes: string | null
          id: string
          language_requirements: string | null
          max_word_count: number | null
          min_word_count: number | null
          required_sections: Json | null
          tips: string | null
          university_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          formatting_notes?: string | null
          id?: string
          language_requirements?: string | null
          max_word_count?: number | null
          min_word_count?: number | null
          required_sections?: Json | null
          tips?: string | null
          university_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          formatting_notes?: string | null
          id?: string
          language_requirements?: string | null
          max_word_count?: number | null
          min_word_count?: number | null
          required_sections?: Json | null
          tips?: string | null
          university_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_document_requirements_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      university_events: {
        Row: {
          created_at: string | null
          created_by: string
          description_en: string | null
          description_ko: string | null
          description_ru: string | null
          description_uz: string | null
          end_date: string | null
          event_date: string
          event_type: string
          id: string
          is_all_day: boolean | null
          room_id: string
          title_en: string | null
          title_ko: string | null
          title_ru: string | null
          title_uz: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description_en?: string | null
          description_ko?: string | null
          description_ru?: string | null
          description_uz?: string | null
          end_date?: string | null
          event_date: string
          event_type: string
          id?: string
          is_all_day?: boolean | null
          room_id: string
          title_en?: string | null
          title_ko?: string | null
          title_ru?: string | null
          title_uz: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description_en?: string | null
          description_ko?: string | null
          description_ru?: string | null
          description_uz?: string | null
          end_date?: string | null
          event_date?: string
          event_type?: string
          id?: string
          is_all_day?: boolean | null
          room_id?: string
          title_en?: string | null
          title_ko?: string | null
          title_ru?: string | null
          title_uz?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "university_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      university_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          note_type: string
          university_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          note_type?: string
          university_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          note_type?: string
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_notes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
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
          is_available_for_international: boolean
          language_track: string
          notes: string | null
          program_level: string
          program_name: string
          toefl_requirement: number | null
          topik_requirement: number | null
          tuition_per_semester: number | null
          tuition_per_year: number | null
          university_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_name?: string | null
          faculty_name?: string | null
          id?: string
          ielts_requirement?: number | null
          is_available_for_international?: boolean
          language_track: string
          notes?: string | null
          program_level: string
          program_name: string
          toefl_requirement?: number | null
          topik_requirement?: number | null
          tuition_per_semester?: number | null
          tuition_per_year?: number | null
          university_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_name?: string | null
          faculty_name?: string | null
          id?: string
          ielts_requirement?: number | null
          is_available_for_international?: boolean
          language_track?: string
          notes?: string | null
          program_level?: string
          program_name?: string
          toefl_requirement?: number | null
          topik_requirement?: number | null
          tuition_per_semester?: number | null
          tuition_per_year?: number | null
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      university_requirements: {
        Row: {
          created_at: string
          eligibility_criteria: string | null
          id: string
          language_track: string | null
          program_level: string
          required_documents: Json
          semester: string
          special_notes: string | null
          university_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          eligibility_criteria?: string | null
          id?: string
          language_track?: string | null
          program_level: string
          required_documents?: Json
          semester: string
          special_notes?: string | null
          university_id: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          eligibility_criteria?: string | null
          id?: string
          language_track?: string | null
          program_level?: string
          required_documents?: Json
          semester?: string
          special_notes?: string | null
          university_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "university_requirements_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      university_rooms: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          university_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          university_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_rooms_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      university_staff_assignments: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          title: string | null
          university_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string | null
          university_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string | null
          university_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_staff_assignments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
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
      [_ in never]: never
    }
    Functions: {
      extract_doc_type_tag: { Args: { doc_name: string }; Returns: string }
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
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "call_operator"
        | "document_handler"
        | "university_staff"
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
      app_role: [
        "owner",
        "admin",
        "call_operator",
        "document_handler",
        "university_staff",
      ],
    },
  },
} as const
