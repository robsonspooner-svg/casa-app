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
      add_on_purchases: {
        Row: {
          add_on_type: string
          amount: number
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          notes: string | null
          owner_id: string
          property_id: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          tenancy_id: string | null
          updated_at: string
        }
        Insert: {
          add_on_type: string
          amount: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          owner_id: string
          property_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          tenancy_id?: string | null
          updated_at?: string
        }
        Update: {
          add_on_type?: string
          amount?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          owner_id?: string
          property_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          tenancy_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "add_on_purchases_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "add_on_purchases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "add_on_purchases_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_background_tasks: {
        Row: {
          created_at: string
          error: string | null
          id: string
          last_run_at: string | null
          next_run_at: string | null
          property_id: string | null
          result_data: Json | null
          schedule: string | null
          status: string
          task_type: string
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          property_id?: string | null
          result_data?: Json | null
          schedule?: string | null
          status?: string
          task_type: string
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          property_id?: string | null
          result_data?: Json | null
          schedule?: string | null
          status?: string
          task_type?: string
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_background_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_background_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_conversations: {
        Row: {
          context_summary: string | null
          created_at: string
          id: string
          property_id: string | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context_summary?: string | null
          created_at?: string
          id?: string
          property_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context_summary?: string | null
          created_at?: string
          id?: string
          property_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_corrections: {
        Row: {
          context_snapshot: Json
          correction: string
          created_at: string
          decision_id: string | null
          id: string
          original_action: string
          pattern_matched: boolean | null
          user_id: string
        }
        Insert: {
          context_snapshot: Json
          correction: string
          created_at?: string
          decision_id?: string | null
          id?: string
          original_action: string
          pattern_matched?: boolean | null
          user_id: string
        }
        Update: {
          context_snapshot?: Json
          correction?: string
          created_at?: string
          decision_id?: string | null
          id?: string
          original_action?: string
          pattern_matched?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_corrections_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "agent_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_corrections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_decisions: {
        Row: {
          autonomy_level: number
          confidence: number | null
          conversation_id: string | null
          created_at: string
          decision_type: string
          embedding: string | null
          id: string
          input_data: Json
          output_data: Json | null
          owner_correction: string | null
          owner_feedback: string | null
          property_id: string | null
          reasoning: string | null
          tool_name: string
          user_id: string
        }
        Insert: {
          autonomy_level?: number
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          decision_type: string
          embedding?: string | null
          id?: string
          input_data: Json
          output_data?: Json | null
          owner_correction?: string | null
          owner_feedback?: string | null
          property_id?: string | null
          reasoning?: string | null
          tool_name: string
          user_id: string
        }
        Update: {
          autonomy_level?: number
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          decision_type?: string
          embedding?: string | null
          id?: string
          input_data?: Json
          output_data?: Json | null
          owner_correction?: string | null
          owner_feedback?: string | null
          property_id?: string | null
          reasoning?: string | null
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_decisions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_decisions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_decisions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          feedback: string | null
          id: string
          role: string
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          role: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          role?: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_pending_actions: {
        Row: {
          action_type: string
          autonomy_level: number
          conversation_id: string | null
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          preview_data: Json | null
          property_id: string | null
          resolved_at: string | null
          status: string
          title: string
          tool_name: string
          tool_params: Json
          user_id: string
        }
        Insert: {
          action_type: string
          autonomy_level: number
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          preview_data?: Json | null
          property_id?: string | null
          resolved_at?: string | null
          status?: string
          title: string
          tool_name: string
          tool_params: Json
          user_id: string
        }
        Update: {
          action_type?: string
          autonomy_level?: number
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          preview_data?: Json | null
          property_id?: string | null
          resolved_at?: string | null
          status?: string
          title?: string
          tool_name?: string
          tool_params?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_pending_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_pending_actions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_pending_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_preferences: {
        Row: {
          category: string
          confidence: number | null
          created_at: string
          id: string
          preference_key: string
          preference_value: Json
          property_id: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          confidence?: number | null
          created_at?: string
          id?: string
          preference_key: string
          preference_value: Json
          property_id?: string | null
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          confidence?: number | null
          created_at?: string
          id?: string
          preference_key?: string
          preference_value?: Json
          property_id?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_preferences_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_rules: {
        Row: {
          active: boolean
          category: string
          confidence: number
          correction_ids: string[] | null
          created_at: string
          id: string
          property_id: string | null
          rule_text: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category: string
          confidence?: number
          correction_ids?: string[] | null
          created_at?: string
          id?: string
          property_id?: string | null
          rule_text: string
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string
          confidence?: number
          correction_ids?: string[] | null
          created_at?: string
          id?: string
          property_id?: string | null
          rule_text?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_trajectories: {
        Row: {
          conversation_id: string | null
          created_at: string
          efficiency_score: number | null
          id: string
          success: boolean
          tool_sequence: Json
          total_duration_ms: number | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          efficiency_score?: number | null
          id?: string
          success?: boolean
          tool_sequence: Json
          total_duration_ms?: number | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          efficiency_score?: number | null
          id?: string
          success?: boolean
          tool_sequence?: Json
          total_duration_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_trajectories_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_trajectories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_documents: {
        Row: {
          application_id: string
          created_at: string
          document_type: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          storage_path: string
          url: string
        }
        Insert: {
          application_id: string
          created_at?: string
          document_type: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          storage_path: string
          url: string
        }
        Update: {
          application_id?: string
          created_at?: string
          document_type?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          storage_path?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_references: {
        Row: {
          application_id: string
          contacted_at: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          reference_type: string
          relationship: string
        }
        Insert: {
          application_id: string
          contacted_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          reference_type: string
          relationship: string
        }
        Update: {
          application_id?: string
          contacted_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          reference_type?: string
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_references_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          additional_notes: string | null
          additional_occupants: number
          annual_income: number | null
          created_at: string
          current_address: string
          current_landlord_email: string | null
          current_landlord_name: string | null
          current_landlord_phone: string | null
          current_rent: number | null
          date_of_birth: string | null
          email: string
          employer_name: string | null
          employment_start_date: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          has_pets: boolean
          id: string
          job_title: string | null
          lease_term_preference:
            | Database["public"]["Enums"]["lease_term"]
            | null
          listing_id: string
          move_in_date: string
          occupant_details: string | null
          pet_description: string | null
          phone: string
          reason_for_moving: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          tenancy_start_date: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          additional_notes?: string | null
          additional_occupants?: number
          annual_income?: number | null
          created_at?: string
          current_address: string
          current_landlord_email?: string | null
          current_landlord_name?: string | null
          current_landlord_phone?: string | null
          current_rent?: number | null
          date_of_birth?: string | null
          email: string
          employer_name?: string | null
          employment_start_date?: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          has_pets?: boolean
          id?: string
          job_title?: string | null
          lease_term_preference?:
            | Database["public"]["Enums"]["lease_term"]
            | null
          listing_id: string
          move_in_date: string
          occupant_details?: string | null
          pet_description?: string | null
          phone: string
          reason_for_moving?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          tenancy_start_date?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          additional_notes?: string | null
          additional_occupants?: number
          annual_income?: number | null
          created_at?: string
          current_address?: string
          current_landlord_email?: string | null
          current_landlord_name?: string | null
          current_landlord_phone?: string | null
          current_rent?: number | null
          date_of_birth?: string | null
          email?: string
          employer_name?: string | null
          employment_start_date?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name?: string
          has_pets?: boolean
          id?: string
          job_title?: string | null
          lease_term_preference?:
            | Database["public"]["Enums"]["lease_term"]
            | null
          listing_id?: string
          move_in_date?: string
          occupant_details?: string | null
          pet_description?: string | null
          phone?: string
          reason_for_moving?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          tenancy_start_date?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      arrears_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["arrears_action_type"]
          arrears_record_id: string
          created_at: string
          delivered: boolean | null
          description: string
          id: string
          is_automated: boolean
          metadata: Json | null
          opened: boolean | null
          performed_by: string | null
          sent_at: string | null
          sent_to: string | null
          template_used: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["arrears_action_type"]
          arrears_record_id: string
          created_at?: string
          delivered?: boolean | null
          description: string
          id?: string
          is_automated?: boolean
          metadata?: Json | null
          opened?: boolean | null
          performed_by?: string | null
          sent_at?: string | null
          sent_to?: string | null
          template_used?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["arrears_action_type"]
          arrears_record_id?: string
          created_at?: string
          delivered?: boolean | null
          description?: string
          id?: string
          is_automated?: boolean
          metadata?: Json | null
          opened?: boolean | null
          performed_by?: string | null
          sent_at?: string | null
          sent_to?: string | null
          template_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arrears_actions_arrears_record_id_fkey"
            columns: ["arrears_record_id"]
            isOneToOne: false
            referencedRelation: "arrears_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrears_actions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      arrears_records: {
        Row: {
          created_at: string
          days_overdue: number
          first_overdue_date: string
          has_payment_plan: boolean
          id: string
          is_resolved: boolean
          payment_plan_id: string | null
          resolved_at: string | null
          resolved_reason: string | null
          severity: Database["public"]["Enums"]["arrears_severity"]
          tenancy_id: string
          tenant_id: string
          total_overdue: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_overdue: number
          first_overdue_date: string
          has_payment_plan?: boolean
          id?: string
          is_resolved?: boolean
          payment_plan_id?: string | null
          resolved_at?: string | null
          resolved_reason?: string | null
          severity?: Database["public"]["Enums"]["arrears_severity"]
          tenancy_id: string
          tenant_id: string
          total_overdue: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_overdue?: number
          first_overdue_date?: string
          has_payment_plan?: boolean
          id?: string
          is_resolved?: boolean
          payment_plan_id?: string | null
          resolved_at?: string | null
          resolved_reason?: string | null
          severity?: Database["public"]["Enums"]["arrears_severity"]
          tenancy_id?: string
          tenant_id?: string
          total_overdue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arrears_records_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: true
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrears_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_arrears_payment_plan"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      autopay_settings: {
        Row: {
          created_at: string
          days_before_due: number
          id: string
          is_enabled: boolean
          max_amount: number | null
          payment_method_id: string
          tenancy_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_before_due?: number
          id?: string
          is_enabled?: boolean
          max_amount?: number | null
          payment_method_id: string
          tenancy_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_before_due?: number
          id?: string
          is_enabled?: boolean
          max_amount?: number | null
          payment_method_id?: string
          tenancy_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopay_settings_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopay_settings_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: true
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopay_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      background_check_consents: {
        Row: {
          application_id: string
          consent_text_version: string
          consented_at: string
          equifax_consent: boolean
          id: string
          ip_address: unknown
          signature_data: string | null
          tenant_id: string
          tica_consent: boolean
          user_agent: string
        }
        Insert: {
          application_id: string
          consent_text_version: string
          consented_at?: string
          equifax_consent?: boolean
          id?: string
          ip_address: unknown
          signature_data?: string | null
          tenant_id: string
          tica_consent?: boolean
          user_agent: string
        }
        Update: {
          application_id?: string
          consent_text_version?: string
          consented_at?: string
          equifax_consent?: boolean
          id?: string
          ip_address?: unknown
          signature_data?: string | null
          tenant_id?: string
          tica_consent?: boolean
          user_agent?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_check_consents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_check_consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      background_checks: {
        Row: {
          application_id: string
          check_type: string
          completed_at: string | null
          consent_given_at: string
          consent_token: string
          error_message: string | null
          expires_at: string | null
          id: string
          provider: string
          report_url: string | null
          requested_at: string
          result_encrypted: string | null
          status: string
          summary_risk_level: string | null
          summary_score: number | null
        }
        Insert: {
          application_id: string
          check_type: string
          completed_at?: string | null
          consent_given_at: string
          consent_token: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          provider: string
          report_url?: string | null
          requested_at?: string
          result_encrypted?: string | null
          status?: string
          summary_risk_level?: string | null
          summary_score?: number | null
        }
        Update: {
          application_id?: string
          check_type?: string
          completed_at?: string | null
          consent_given_at?: string
          consent_token?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          provider?: string
          report_url?: string | null
          requested_at?: string
          result_encrypted?: string | null
          status?: string
          summary_risk_level?: string | null
          summary_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "background_checks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      bond_claims: {
        Row: {
          bond_lodgement_id: string
          claim_type: string
          created_at: string
          dispute_lodged_at: string | null
          dispute_reference: string | null
          id: string
          landlord_amount: number
          landlord_consent_at: string | null
          payment_date: string | null
          payment_reference: string | null
          reason: string | null
          status: string
          tenancy_id: string
          tenant_amount: number
          tenant_consent_at: string | null
          tribunal_date: string | null
          updated_at: string
        }
        Insert: {
          bond_lodgement_id: string
          claim_type: string
          created_at?: string
          dispute_lodged_at?: string | null
          dispute_reference?: string | null
          id?: string
          landlord_amount?: number
          landlord_consent_at?: string | null
          payment_date?: string | null
          payment_reference?: string | null
          reason?: string | null
          status?: string
          tenancy_id: string
          tenant_amount?: number
          tenant_consent_at?: string | null
          tribunal_date?: string | null
          updated_at?: string
        }
        Update: {
          bond_lodgement_id?: string
          claim_type?: string
          created_at?: string
          dispute_lodged_at?: string | null
          dispute_reference?: string | null
          id?: string
          landlord_amount?: number
          landlord_consent_at?: string | null
          payment_date?: string | null
          payment_reference?: string | null
          reason?: string | null
          status?: string
          tenancy_id?: string
          tenant_amount?: number
          tenant_consent_at?: string | null
          tribunal_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bond_claims_bond_lodgement_id_fkey"
            columns: ["bond_lodgement_id"]
            isOneToOne: false
            referencedRelation: "bond_lodgements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bond_claims_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      bond_lodgements: {
        Row: {
          amount: number
          bond_number: string | null
          created_at: string
          id: string
          lodged_at: string | null
          lodgement_fee: number | null
          lodgement_reference: string | null
          payment_date: string | null
          payment_method: string | null
          payment_reference: string | null
          receipt_number: string | null
          receipt_url: string | null
          state: string
          status: string
          tenancy_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          bond_number?: string | null
          created_at?: string
          id?: string
          lodged_at?: string | null
          lodgement_fee?: number | null
          lodgement_reference?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          state: string
          status?: string
          tenancy_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bond_number?: string | null
          created_at?: string
          id?: string
          lodged_at?: string | null
          lodgement_fee?: number | null
          lodgement_reference?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          state?: string
          status?: string
          tenancy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bond_lodgements_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_attempts: {
        Row: {
          code_id: string | null
          code_text: string
          created_at: string
          created_tenancy_tenant_id: string | null
          failure_reason: string | null
          id: string
          processed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          code_id?: string | null
          code_text: string
          created_at?: string
          created_tenancy_tenant_id?: string | null
          failure_reason?: string | null
          id?: string
          processed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          code_id?: string | null
          code_text?: string
          created_at?: string
          created_tenancy_tenant_id?: string | null
          failure_reason?: string | null
          id?: string
          processed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_attempts_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "connection_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_attempts_created_tenancy_tenant_id_fkey"
            columns: ["created_tenancy_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenancy_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_codes: {
        Row: {
          code: string
          connection_type: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          label: string | null
          max_uses: number | null
          owner_id: string
          property_id: string | null
          tenancy_id: string | null
          use_count: number
        }
        Insert: {
          code: string
          connection_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          max_uses?: number | null
          owner_id: string
          property_id?: string | null
          tenancy_id?: string | null
          use_count?: number
        }
        Update: {
          code?: string
          connection_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          max_uses?: number | null
          owner_id?: string
          property_id?: string | null
          tenancy_id?: string | null
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "connection_codes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_codes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_codes_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notifications: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          notification_type: string
          recipient_email: string
          recipient_name: string | null
          retry_count: number
          sent_at: string | null
          status: string
          template_data: Json
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          notification_type: string
          recipient_email: string
          recipient_name?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          template_data?: Json
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          notification_type?: string
          recipient_email?: string
          recipient_name?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          template_data?: Json
        }
        Relationships: []
      }
      feature_options: {
        Row: {
          category: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          category: string
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      lease_signing_events: {
        Row: {
          envelope_id: string
          event_time: string
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          signer_email: string | null
          signer_name: string | null
          signer_role: string | null
          tenancy_id: string
        }
        Insert: {
          envelope_id: string
          event_time?: string
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          signer_email?: string | null
          signer_name?: string | null
          signer_role?: string | null
          tenancy_id: string
        }
        Update: {
          envelope_id?: string
          event_time?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          signer_email?: string | null
          signer_name?: string | null
          signer_role?: string | null
          tenancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_signing_events_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_features: {
        Row: {
          feature: string
          id: string
          listing_id: string
        }
        Insert: {
          feature: string
          id?: string
          listing_id: string
        }
        Update: {
          feature?: string
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_features_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          application_count: number
          available_date: string
          bond_weeks: number
          close_reason: string | null
          closed_at: string | null
          created_at: string
          description: string | null
          domain_last_synced_at: string | null
          domain_listing_id: string | null
          domain_sync_status: string | null
          furnished: boolean
          id: string
          lease_term: Database["public"]["Enums"]["lease_term"]
          owner_id: string
          pets_allowed: boolean
          pets_description: string | null
          property_id: string
          published_at: string | null
          rea_last_synced_at: string | null
          rea_listing_id: string | null
          rea_sync_status: string | null
          rent_amount: number
          rent_frequency: Database["public"]["Enums"]["payment_frequency"]
          smoking_allowed: boolean
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          application_count?: number
          available_date: string
          bond_weeks?: number
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          domain_last_synced_at?: string | null
          domain_listing_id?: string | null
          domain_sync_status?: string | null
          furnished?: boolean
          id?: string
          lease_term?: Database["public"]["Enums"]["lease_term"]
          owner_id: string
          pets_allowed?: boolean
          pets_description?: string | null
          property_id: string
          published_at?: string | null
          rea_last_synced_at?: string | null
          rea_listing_id?: string | null
          rea_sync_status?: string | null
          rent_amount: number
          rent_frequency?: Database["public"]["Enums"]["payment_frequency"]
          smoking_allowed?: boolean
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          application_count?: number
          available_date?: string
          bond_weeks?: number
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          domain_last_synced_at?: string | null
          domain_listing_id?: string | null
          domain_sync_status?: string | null
          furnished?: boolean
          id?: string
          lease_term?: Database["public"]["Enums"]["lease_term"]
          owner_id?: string
          pets_allowed?: boolean
          pets_description?: string | null
          property_id?: string
          published_at?: string | null
          rea_last_synced_at?: string | null
          rea_listing_id?: string | null
          rea_sync_status?: string | null
          rent_amount?: number
          rent_frequency?: Database["public"]["Enums"]["payment_frequency"]
          smoking_allowed?: boolean
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      match_suggestions: {
        Row: {
          actioned_at: string | null
          created_at: string
          expires_at: string
          id: string
          listing_id: string | null
          match_reasons: Json | null
          match_score: number
          property_id: string
          status: string
          tenant_availability_id: string | null
          tenant_id: string
          viewed_at: string | null
        }
        Insert: {
          actioned_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          listing_id?: string | null
          match_reasons?: Json | null
          match_score: number
          property_id: string
          status?: string
          tenant_availability_id?: string | null
          tenant_id: string
          viewed_at?: string | null
        }
        Update: {
          actioned_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          listing_id?: string | null
          match_reasons?: Json | null
          match_score?: number
          property_id?: string
          status?: string
          tenant_availability_id?: string | null
          tenant_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_suggestions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_suggestions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_suggestions_tenant_availability_id_fkey"
            columns: ["tenant_availability_id"]
            isOneToOne: false
            referencedRelation: "tenant_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_stripe_accounts: {
        Row: {
          account_type: string
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          id: string
          owner_id: string
          payout_schedule: string | null
          payouts_enabled: boolean
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          id?: string
          owner_id: string
          payout_schedule?: string | null
          payouts_enabled?: boolean
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          id?: string
          owner_id?: string
          payout_schedule?: string | null
          payouts_enabled?: boolean
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_stripe_accounts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_disputes: {
        Row: {
          amount: number
          created_at: string
          evidence_due_by: string | null
          id: string
          outcome: string | null
          payment_id: string
          reason: string
          resolved_at: string | null
          status: string
          stripe_dispute_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          evidence_due_by?: string | null
          id?: string
          outcome?: string | null
          payment_id: string
          reason: string
          resolved_at?: string | null
          status?: string
          stripe_dispute_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          evidence_due_by?: string | null
          id?: string
          outcome?: string | null
          payment_id?: string
          reason?: string
          resolved_at?: string | null
          status?: string
          stripe_dispute_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_disputes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          autopay_days_before: number | null
          bank_name: string | null
          becs_mandate_id: string | null
          becs_mandate_status: string | null
          brand: string | null
          created_at: string
          id: string
          is_active: boolean
          is_autopay: boolean
          is_default: boolean
          last_four: string
          stripe_customer_id: string
          stripe_payment_method_id: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          autopay_days_before?: number | null
          bank_name?: string | null
          becs_mandate_id?: string | null
          becs_mandate_status?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_autopay?: boolean
          is_default?: boolean
          last_four: string
          stripe_customer_id: string
          stripe_payment_method_id: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          autopay_days_before?: number | null
          bank_name?: string | null
          becs_mandate_id?: string | null
          becs_mandate_status?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_autopay?: boolean
          is_default?: boolean
          last_four?: string
          stripe_customer_id?: string
          stripe_payment_method_id?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plan_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          is_paid: boolean
          paid_at: string | null
          payment_id: string | null
          payment_plan_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          is_paid?: boolean
          paid_at?: string | null
          payment_id?: string | null
          payment_plan_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          is_paid?: boolean
          paid_at?: string | null
          payment_id?: string | null
          payment_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plan_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plan_installments_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          amount_paid: number
          arrears_record_id: string
          created_at: string
          expected_end_date: string
          id: string
          installment_amount: number
          installment_frequency: Database["public"]["Enums"]["payment_frequency"]
          installments_paid: number
          next_due_date: string | null
          notes: string | null
          start_date: string
          status: string
          tenancy_id: string
          total_arrears: number
          total_installments: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          arrears_record_id: string
          created_at?: string
          expected_end_date: string
          id?: string
          installment_amount: number
          installment_frequency: Database["public"]["Enums"]["payment_frequency"]
          installments_paid?: number
          next_due_date?: string | null
          notes?: string | null
          start_date: string
          status?: string
          tenancy_id: string
          total_arrears: number
          total_installments: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          arrears_record_id?: string
          created_at?: string
          expected_end_date?: string
          id?: string
          installment_amount?: number
          installment_frequency?: Database["public"]["Enums"]["payment_frequency"]
          installments_paid?: number
          next_due_date?: string | null
          notes?: string | null
          start_date?: string
          status?: string
          tenancy_id?: string
          total_arrears?: number
          total_installments?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_arrears_record_id_fkey"
            columns: ["arrears_record_id"]
            isOneToOne: false
            referencedRelation: "arrears_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          due_date: string | null
          failed_at: string | null
          id: string
          metadata: Json | null
          net_amount: number | null
          paid_at: string | null
          payment_method_id: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          platform_fee: number | null
          receipt_number: string | null
          receipt_url: string | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          status_reason: string | null
          stripe_charge_id: string | null
          stripe_fee: number | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          tenancy_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          failed_at?: string | null
          id?: string
          metadata?: Json | null
          net_amount?: number | null
          paid_at?: string | null
          payment_method_id?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          platform_fee?: number | null
          receipt_number?: string | null
          receipt_url?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          status_reason?: string | null
          stripe_charge_id?: string | null
          stripe_fee?: number | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          tenancy_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          failed_at?: string | null
          id?: string
          metadata?: Json | null
          net_amount?: number | null
          paid_at?: string | null
          payment_method_id?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          platform_fee?: number | null
          receipt_number?: string | null
          receipt_url?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          status_reason?: string | null
          stripe_charge_id?: string | null
          stripe_fee?: number | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          tenancy_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          phone: string | null
          preferences: Json | null
          role: Database["public"]["Enums"]["user_role"]
          stripe_customer_id: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          phone?: string | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          stripe_customer_id?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          phone?: string | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          stripe_customer_id?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          bathrooms: number
          bedrooms: number
          bond_amount: number | null
          country: string
          created_at: string
          deleted_at: string | null
          floor_size_sqm: number | null
          id: string
          land_size_sqm: number | null
          notes: string | null
          owner_id: string
          parking_spaces: number
          postcode: string
          property_type: Database["public"]["Enums"]["property_type"]
          rent_amount: number
          rent_frequency: Database["public"]["Enums"]["payment_frequency"]
          state: string
          status: string
          suburb: string
          total_vacancy_days: number | null
          updated_at: string
          vacant_since: string | null
          year_built: number | null
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          bathrooms?: number
          bedrooms?: number
          bond_amount?: number | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          floor_size_sqm?: number | null
          id?: string
          land_size_sqm?: number | null
          notes?: string | null
          owner_id: string
          parking_spaces?: number
          postcode: string
          property_type: Database["public"]["Enums"]["property_type"]
          rent_amount: number
          rent_frequency?: Database["public"]["Enums"]["payment_frequency"]
          state: string
          status?: string
          suburb: string
          total_vacancy_days?: number | null
          updated_at?: string
          vacant_since?: string | null
          year_built?: number | null
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          bathrooms?: number
          bedrooms?: number
          bond_amount?: number | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          floor_size_sqm?: number | null
          id?: string
          land_size_sqm?: number | null
          notes?: string | null
          owner_id?: string
          parking_spaces?: number
          postcode?: string
          property_type?: Database["public"]["Enums"]["property_type"]
          rent_amount?: number
          rent_frequency?: Database["public"]["Enums"]["payment_frequency"]
          state?: string
          status?: string
          suburb?: string
          total_vacancy_days?: number | null
          updated_at?: string
          vacant_since?: string | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_primary: boolean
          property_id: string
          storage_path: string
          url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          property_id: string
          storage_path: string
          url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          property_id?: string
          storage_path?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_templates: {
        Row: {
          applicable_states: string[] | null
          body: string
          channel: string
          created_at: string
          days_overdue: number
          id: string
          is_active: boolean
          is_breach_notice: boolean
          name: string
          owner_id: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          applicable_states?: string[] | null
          body: string
          channel: string
          created_at?: string
          days_overdue: number
          id?: string
          is_active?: boolean
          is_breach_notice?: boolean
          name: string
          owner_id?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          applicable_states?: string[] | null
          body?: string
          channel?: string
          created_at?: string
          days_overdue?: number
          id?: string
          is_active?: boolean
          is_breach_notice?: boolean
          name?: string
          owner_id?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_increases: {
        Row: {
          comparable_rents: Json | null
          cpi_rate: number | null
          created_at: string
          current_amount: number
          effective_date: string
          id: string
          increase_percentage: number | null
          justification: string | null
          minimum_notice_days: number
          new_amount: number
          notice_date: string
          notice_document_url: string | null
          notice_method: string | null
          notice_sent_at: string | null
          status: string
          tenancy_id: string
          tenant_acknowledged_at: string | null
          tenant_dispute_reason: string | null
          tenant_disputed: boolean | null
          updated_at: string
        }
        Insert: {
          comparable_rents?: Json | null
          cpi_rate?: number | null
          created_at?: string
          current_amount: number
          effective_date: string
          id?: string
          increase_percentage?: number | null
          justification?: string | null
          minimum_notice_days: number
          new_amount: number
          notice_date: string
          notice_document_url?: string | null
          notice_method?: string | null
          notice_sent_at?: string | null
          status?: string
          tenancy_id: string
          tenant_acknowledged_at?: string | null
          tenant_dispute_reason?: string | null
          tenant_disputed?: boolean | null
          updated_at?: string
        }
        Update: {
          comparable_rents?: Json | null
          cpi_rate?: number | null
          created_at?: string
          current_amount?: number
          effective_date?: string
          id?: string
          increase_percentage?: number | null
          justification?: string | null
          minimum_notice_days?: number
          new_amount?: number
          notice_date?: string
          notice_document_url?: string | null
          notice_method?: string | null
          notice_sent_at?: string | null
          status?: string
          tenancy_id?: string
          tenant_acknowledged_at?: string | null
          tenant_dispute_reason?: string | null
          tenant_disputed?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_increases_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_schedules: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          due_date: string
          id: string
          is_paid: boolean
          is_prorata: boolean
          paid_at: string | null
          payment_id: string | null
          tenancy_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          is_paid?: boolean
          is_prorata?: boolean
          paid_at?: string | null
          payment_id?: string | null
          tenancy_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          is_paid?: boolean
          is_prorata?: boolean
          paid_at?: string | null
          payment_id?: string | null
          tenancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_schedules_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_schedules_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancies: {
        Row: {
          actual_end_date: string | null
          all_signed_at: string | null
          application_id: string | null
          bond_amount: number
          bond_lodged_date: string | null
          bond_lodgement_number: string | null
          bond_status: Database["public"]["Enums"]["bond_status"]
          created_at: string
          docusign_envelope_id: string | null
          docusign_status: string | null
          end_reason: string | null
          id: string
          is_periodic: boolean
          lease_document_url: string | null
          lease_end_date: string
          lease_sent_at: string | null
          lease_signed_at: string | null
          lease_start_date: string
          lease_type: Database["public"]["Enums"]["lease_term"]
          listing_id: string | null
          notes: string | null
          notice_given_date: string | null
          notice_period_days: number | null
          property_id: string
          rent_amount: number
          rent_due_day: number
          rent_frequency: Database["public"]["Enums"]["payment_frequency"]
          status: Database["public"]["Enums"]["tenancy_status"]
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          all_signed_at?: string | null
          application_id?: string | null
          bond_amount: number
          bond_lodged_date?: string | null
          bond_lodgement_number?: string | null
          bond_status?: Database["public"]["Enums"]["bond_status"]
          created_at?: string
          docusign_envelope_id?: string | null
          docusign_status?: string | null
          end_reason?: string | null
          id?: string
          is_periodic?: boolean
          lease_document_url?: string | null
          lease_end_date: string
          lease_sent_at?: string | null
          lease_signed_at?: string | null
          lease_start_date: string
          lease_type: Database["public"]["Enums"]["lease_term"]
          listing_id?: string | null
          notes?: string | null
          notice_given_date?: string | null
          notice_period_days?: number | null
          property_id: string
          rent_amount: number
          rent_due_day?: number
          rent_frequency: Database["public"]["Enums"]["payment_frequency"]
          status?: Database["public"]["Enums"]["tenancy_status"]
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          all_signed_at?: string | null
          application_id?: string | null
          bond_amount?: number
          bond_lodged_date?: string | null
          bond_lodgement_number?: string | null
          bond_status?: Database["public"]["Enums"]["bond_status"]
          created_at?: string
          docusign_envelope_id?: string | null
          docusign_status?: string | null
          end_reason?: string | null
          id?: string
          is_periodic?: boolean
          lease_document_url?: string | null
          lease_end_date?: string
          lease_sent_at?: string | null
          lease_signed_at?: string | null
          lease_start_date?: string
          lease_type?: Database["public"]["Enums"]["lease_term"]
          listing_id?: string | null
          notes?: string | null
          notice_given_date?: string | null
          notice_period_days?: number | null
          property_id?: string
          rent_amount?: number
          rent_due_day?: number
          rent_frequency?: Database["public"]["Enums"]["payment_frequency"]
          status?: Database["public"]["Enums"]["tenancy_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancies_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          id: string
          storage_path: string
          tenancy_id: string
          title: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          id?: string
          storage_path: string
          tenancy_id: string
          title: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          id?: string
          storage_path?: string
          tenancy_id?: string
          title?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_documents_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_tenants: {
        Row: {
          created_at: string
          id: string
          is_leaseholder: boolean
          is_primary: boolean
          moved_in_date: string | null
          moved_out_date: string | null
          tenancy_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_leaseholder?: boolean
          is_primary?: boolean
          moved_in_date?: string | null
          moved_out_date?: string | null
          tenancy_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_leaseholder?: boolean
          is_primary?: boolean
          moved_in_date?: string | null
          moved_out_date?: string | null
          tenancy_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_tenants_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_availability: {
        Row: {
          created_at: string
          employment_status: string | null
          has_pets: boolean | null
          has_references: boolean | null
          id: string
          is_active: boolean
          matched_at: string | null
          max_rent_weekly: number | null
          min_bedrooms: number | null
          move_in_date: string | null
          notes: string | null
          pet_details: string | null
          preferred_suburbs: string[] | null
          rental_history_years: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employment_status?: string | null
          has_pets?: boolean | null
          has_references?: boolean | null
          id?: string
          is_active?: boolean
          matched_at?: string | null
          max_rent_weekly?: number | null
          min_bedrooms?: number | null
          move_in_date?: string | null
          notes?: string | null
          pet_details?: string | null
          preferred_suburbs?: string[] | null
          rental_history_years?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employment_status?: string | null
          has_pets?: boolean | null
          has_references?: boolean | null
          id?: string
          is_active?: boolean
          matched_at?: string | null
          max_rent_weekly?: number | null
          min_bedrooms?: number | null
          move_in_date?: string | null
          notes?: string | null
          pet_details?: string | null
          preferred_suburbs?: string[] | null
          rental_history_years?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_availability_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_stripe_customers: {
        Row: {
          created_at: string
          id: string
          stripe_customer_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stripe_customer_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stripe_customer_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_stripe_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_arrears_severity: {
        Args: { p_days_overdue: number }
        Returns: Database["public"]["Enums"]["arrears_severity"]
      }
      connect_tenant_to_property: {
        Args: { p_code: string; p_property_id: string; p_tenant_id: string }
        Returns: {
          message: string
          success: boolean
          tenancy_id: string
          tenancy_tenant_id: string
        }[]
      }
      generate_connection_code: { Args: never; Returns: string }
      generate_payment_plan_installments: {
        Args: {
          p_frequency: Database["public"]["Enums"]["payment_frequency"]
          p_installment_amount: number
          p_plan_id: string
          p_start_date: string
          p_total_amount: number
        }
        Returns: undefined
      }
      generate_rent_schedule: {
        Args: {
          p_amount: number
          p_end_date: string
          p_frequency: Database["public"]["Enums"]["payment_frequency"]
          p_start_date: string
          p_tenancy_id: string
        }
        Returns: undefined
      }
      increment_listing_views: {
        Args: { listing_uuid: string }
        Returns: undefined
      }
      mark_rent_paid: {
        Args: { p_payment_id: string; p_schedule_id: string }
        Returns: undefined
      }
      process_arrears_payment: {
        Args: { p_amount: number; p_arrears_id: string; p_payment_id?: string }
        Returns: undefined
      }
      use_connection_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: {
          connection_type: string
          message: string
          owner_id: string
          property_id: string
          success: boolean
          tenancy_id: string
        }[]
      }
    }
    Enums: {
      application_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "shortlisted"
        | "approved"
        | "rejected"
        | "withdrawn"
      arrears_action_type:
        | "reminder_email"
        | "reminder_sms"
        | "phone_call"
        | "letter_sent"
        | "breach_notice"
        | "payment_plan_created"
        | "payment_plan_updated"
        | "payment_received"
        | "tribunal_application"
        | "note"
      arrears_severity: "minor" | "moderate" | "serious" | "critical"
      bond_status: "pending" | "lodged" | "claimed" | "returned" | "partial"
      employment_type:
        | "full_time"
        | "part_time"
        | "casual"
        | "self_employed"
        | "unemployed"
        | "retired"
        | "student"
      lease_term: "6_months" | "12_months" | "24_months" | "flexible"
      listing_status: "draft" | "active" | "paused" | "closed"
      payment_frequency: "weekly" | "fortnightly" | "monthly"
      payment_status:
        | "scheduled"
        | "pending"
        | "completed"
        | "failed"
        | "cancelled"
        | "refunded"
      payment_type:
        | "rent"
        | "bond"
        | "utility"
        | "maintenance"
        | "fee"
        | "other"
      property_type:
        | "house"
        | "apartment"
        | "townhouse"
        | "unit"
        | "studio"
        | "other"
      subscription_status: "trialing" | "active" | "past_due" | "cancelled"
      subscription_tier: "starter" | "pro" | "hands_off"
      tenancy_status: "pending" | "active" | "ending" | "ended" | "terminated"
      user_role: "owner" | "tenant" | "admin"
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
      application_status: [
        "draft",
        "submitted",
        "under_review",
        "shortlisted",
        "approved",
        "rejected",
        "withdrawn",
      ],
      arrears_action_type: [
        "reminder_email",
        "reminder_sms",
        "phone_call",
        "letter_sent",
        "breach_notice",
        "payment_plan_created",
        "payment_plan_updated",
        "payment_received",
        "tribunal_application",
        "note",
      ],
      arrears_severity: ["minor", "moderate", "serious", "critical"],
      bond_status: ["pending", "lodged", "claimed", "returned", "partial"],
      employment_type: [
        "full_time",
        "part_time",
        "casual",
        "self_employed",
        "unemployed",
        "retired",
        "student",
      ],
      lease_term: ["6_months", "12_months", "24_months", "flexible"],
      listing_status: ["draft", "active", "paused", "closed"],
      payment_frequency: ["weekly", "fortnightly", "monthly"],
      payment_status: [
        "scheduled",
        "pending",
        "completed",
        "failed",
        "cancelled",
        "refunded",
      ],
      payment_type: ["rent", "bond", "utility", "maintenance", "fee", "other"],
      property_type: [
        "house",
        "apartment",
        "townhouse",
        "unit",
        "studio",
        "other",
      ],
      subscription_status: ["trialing", "active", "past_due", "cancelled"],
      subscription_tier: ["starter", "pro", "hands_off"],
      tenancy_status: ["pending", "active", "ending", "ended", "terminated"],
      user_role: ["owner", "tenant", "admin"],
    },
  },
} as const
