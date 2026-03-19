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
      admin_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      calendar_sync_configs: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          external_calendar_id: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          provider: string
          refresh_token_encrypted: string | null
          sync_direction: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          external_calendar_id?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          provider?: string
          refresh_token_encrypted?: string | null
          sync_direction?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          external_calendar_id?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          provider?: string
          refresh_token_encrypted?: string | null
          sync_direction?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_stage_log: {
        Row: {
          changed_by: string
          conversation_id: string
          created_at: string
          id: string
          new_stage: string
          previous_stage: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          changed_by?: string
          conversation_id: string
          created_at?: string
          id?: string
          new_stage: string
          previous_stage?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          changed_by?: string
          conversation_id?: string
          created_at?: string
          id?: string
          new_stage?: string
          previous_stage?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_stage_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sales_assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_balances: {
        Row: {
          balance: number
          created_at: string
          id: string
          last_reset_at: string | null
          lifetime_used: number
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          last_reset_at?: string | null
          lifetime_used?: number
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          last_reset_at?: string | null
          lifetime_used?: number
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          action_type: Database["public"]["Enums"]["credit_action_type"]
          amount: number
          created_at: string
          description: string | null
          id: string
          model_used: string | null
          reference_id: string | null
          user_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["credit_action_type"]
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          model_used?: string | null
          reference_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["credit_action_type"]
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          model_used?: string | null
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      crm_manual_notes: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          metadata: Json | null
          note_type: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          note_type?: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          note_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_manual_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sales_assistant_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_manual_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_journey_templates: {
        Row: {
          buyer_intent_signals: string[] | null
          created_at: string
          default_prompt_block: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_global: boolean | null
          journey_stage: string
          name: string
          recommended_assets: string[] | null
          recommended_cta: string | null
          recommended_goal: string | null
          recommended_objections: string[] | null
          sort_order: number | null
          updated_at: string
          user_id: string | null
          vehicle_category: string | null
        }
        Insert: {
          buyer_intent_signals?: string[] | null
          created_at?: string
          default_prompt_block?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          journey_stage: string
          name: string
          recommended_assets?: string[] | null
          recommended_cta?: string | null
          recommended_goal?: string | null
          recommended_objections?: string[] | null
          sort_order?: number | null
          updated_at?: string
          user_id?: string | null
          vehicle_category?: string | null
        }
        Update: {
          buyer_intent_signals?: string[] | null
          created_at?: string
          default_prompt_block?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          journey_stage?: string
          name?: string
          recommended_assets?: string[] | null
          recommended_cta?: string | null
          recommended_goal?: string | null
          recommended_objections?: string[] | null
          sort_order?: number | null
          updated_at?: string
          user_id?: string | null
          vehicle_category?: string | null
        }
        Relationships: []
      }
      dealer_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean
          max_parallel_bookings: number
          slot_duration_minutes: number
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time?: string
          id?: string
          is_available?: boolean
          max_parallel_bookings?: number
          slot_duration_minutes?: number
          start_time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean
          max_parallel_bookings?: number
          slot_duration_minutes?: number
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dealer_blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_date: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_date?: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ftp_configs: {
        Row: {
          created_at: string
          directory: string
          host: string
          id: string
          is_sftp: boolean
          password: string
          port: number
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          directory?: string
          host?: string
          id?: string
          is_sftp?: boolean
          password?: string
          port?: number
          updated_at?: string
          user_id: string
          username?: string
        }
        Update: {
          created_at?: string
          directory?: string
          host?: string
          id?: string
          is_sftp?: boolean
          password?: string
          port?: number
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      image_generation_jobs: {
        Row: {
          completed_tasks: number
          config: Json
          created_at: string
          failed_tasks: number
          id: string
          input_image_urls: string[]
          job_type: string
          model_tier: string
          original_image_urls: string[] | null
          project_id: string | null
          status: string
          tasks: Json
          total_tasks: number
          updated_at: string
          user_id: string
          vehicle_description: string | null
        }
        Insert: {
          completed_tasks?: number
          config?: Json
          created_at?: string
          failed_tasks?: number
          id?: string
          input_image_urls?: string[]
          job_type?: string
          model_tier?: string
          original_image_urls?: string[] | null
          project_id?: string | null
          status?: string
          tasks?: Json
          total_tasks?: number
          updated_at?: string
          user_id: string
          vehicle_description?: string | null
        }
        Update: {
          completed_tasks?: number
          config?: Json
          created_at?: string
          failed_tasks?: number
          id?: string
          input_image_urls?: string[]
          job_type?: string
          model_tier?: string
          original_image_urls?: string[] | null
          project_id?: string | null
          status?: string
          tasks?: Json
          total_tasks?: number
          updated_at?: string
          user_id?: string
          vehicle_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "image_generation_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          dealer_user_id: string
          email: string
          id: string
          interested_financing: boolean
          interested_leasing: boolean
          interested_purchase: boolean
          interested_test_drive: boolean
          interested_trade_in: boolean
          message: string | null
          name: string
          phone: string | null
          project_id: string | null
          vehicle_title: string | null
        }
        Insert: {
          created_at?: string
          dealer_user_id: string
          email: string
          id?: string
          interested_financing?: boolean
          interested_leasing?: boolean
          interested_purchase?: boolean
          interested_test_drive?: boolean
          interested_trade_in?: boolean
          message?: string | null
          name: string
          phone?: string | null
          project_id?: string | null
          vehicle_title?: string | null
        }
        Update: {
          created_at?: string
          dealer_user_id?: string
          email?: string
          id?: string
          interested_financing?: boolean
          interested_leasing?: boolean
          interested_purchase?: boolean
          interested_test_drive?: boolean
          interested_trade_in?: boolean
          message?: string | null
          name?: string
          phone?: string | null
          project_id?: string | null
          vehicle_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          api_key: string | null
          city: string | null
          company_name: string | null
          contact_name: string | null
          created_at: string
          custom_showroom_url: string | null
          default_legal_text: string | null
          email: string | null
          facebook_url: string | null
          financing_bank: string | null
          financing_legal_text: string | null
          id: string
          instagram_url: string | null
          leasing_bank: string | null
          leasing_legal_text: string | null
          logo_url: string | null
          phone: string | null
          postal_code: string | null
          tax_id: string | null
          tiktok_url: string | null
          updated_at: string
          website: string | null
          whatsapp_number: string | null
          x_url: string | null
          youtube_url: string | null
        }
        Insert: {
          address?: string | null
          api_key?: string | null
          city?: string | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          custom_showroom_url?: string | null
          default_legal_text?: string | null
          email?: string | null
          facebook_url?: string | null
          financing_bank?: string | null
          financing_legal_text?: string | null
          id: string
          instagram_url?: string | null
          leasing_bank?: string | null
          leasing_legal_text?: string | null
          logo_url?: string | null
          phone?: string | null
          postal_code?: string | null
          tax_id?: string | null
          tiktok_url?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_number?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          address?: string | null
          api_key?: string | null
          city?: string | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          custom_showroom_url?: string | null
          default_legal_text?: string | null
          email?: string | null
          facebook_url?: string | null
          financing_bank?: string | null
          financing_legal_text?: string | null
          id?: string
          instagram_url?: string | null
          leasing_bank?: string | null
          leasing_legal_text?: string | null
          logo_url?: string | null
          phone?: string | null
          postal_code?: string | null
          tax_id?: string | null
          tiktok_url?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_number?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      project_images: {
        Row: {
          created_at: string
          gallery_folder: string | null
          id: string
          image_base64: string
          image_url: string | null
          perspective: string | null
          project_id: string | null
          sort_order: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          gallery_folder?: string | null
          id?: string
          image_base64: string
          image_url?: string | null
          perspective?: string | null
          project_id?: string | null
          sort_order?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          gallery_folder?: string | null
          id?: string
          image_base64?: string
          image_url?: string | null
          perspective?: string | null
          project_id?: string | null
          sort_order?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_images_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          html_content: string | null
          id: string
          main_image_base64: string | null
          main_image_url: string | null
          template_id: string
          title: string
          updated_at: string
          user_id: string
          vehicle_data: Json
        }
        Insert: {
          created_at?: string
          html_content?: string | null
          id?: string
          main_image_base64?: string | null
          main_image_url?: string | null
          template_id?: string
          title?: string
          updated_at?: string
          user_id: string
          vehicle_data: Json
        }
        Update: {
          created_at?: string
          html_content?: string | null
          id?: string
          main_image_base64?: string | null
          main_image_url?: string | null
          template_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          vehicle_data?: Json
        }
        Relationships: []
      }
      sales_assistant_conversations: {
        Row: {
          conversation_title: string | null
          created_at: string
          customer_context: Json | null
          id: string
          journey_stage: string | null
          last_generated_output: string | null
          last_prompt_snapshot: Json | null
          lead_id: string | null
          next_action: string | null
          next_action_due_at: string | null
          project_id: string | null
          source_channel: string | null
          status: string | null
          summary: string | null
          updated_at: string
          user_id: string
          vehicle_context: Json | null
        }
        Insert: {
          conversation_title?: string | null
          created_at?: string
          customer_context?: Json | null
          id?: string
          journey_stage?: string | null
          last_generated_output?: string | null
          last_prompt_snapshot?: Json | null
          lead_id?: string | null
          next_action?: string | null
          next_action_due_at?: string | null
          project_id?: string | null
          source_channel?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
          vehicle_context?: Json | null
        }
        Update: {
          conversation_title?: string | null
          created_at?: string
          customer_context?: Json | null
          id?: string
          journey_stage?: string | null
          last_generated_output?: string | null
          last_prompt_snapshot?: Json | null
          lead_id?: string | null
          next_action?: string | null
          next_action_due_at?: string | null
          project_id?: string | null
          source_channel?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string
          vehicle_context?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_assistant_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_assistant_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_assistant_messages: {
        Row: {
          approval_status: string | null
          channel: string | null
          conversation_id: string
          created_at: string
          generation_mode: string | null
          id: string
          input_text: string | null
          message_type: string
          metadata: Json | null
          output_text: string | null
          role: string
          user_id: string
        }
        Insert: {
          approval_status?: string | null
          channel?: string | null
          conversation_id: string
          created_at?: string
          generation_mode?: string | null
          id?: string
          input_text?: string | null
          message_type?: string
          metadata?: Json | null
          output_text?: string | null
          role?: string
          user_id: string
        }
        Update: {
          approval_status?: string | null
          channel?: string | null
          conversation_id?: string
          created_at?: string
          generation_mode?: string | null
          id?: string
          input_text?: string | null
          message_type?: string
          metadata?: Json | null
          output_text?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sales_assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_assistant_profiles: {
        Row: {
          active: boolean | null
          assistant_name: string | null
          auto_follow_up_delay_hours: number | null
          auto_follow_up_enabled: boolean | null
          auto_reply_stages: string[] | null
          autopilot_mode: string
          brand_voice: string | null
          closing_style: string | null
          compliance_notes: string | null
          created_at: string
          daily_summary_enabled: boolean | null
          default_tone: string | null
          email_style: string | null
          forbidden_phrases: string[] | null
          id: string
          max_response_length: string | null
          must_use_phrases: string[] | null
          objection_style: string | null
          preferred_cta: string | null
          response_language: string | null
          sales_goal: string | null
          should_offer_callback: boolean | null
          should_push_financing: boolean | null
          should_push_test_drive: boolean | null
          should_push_trade_in: boolean | null
          signature_email: string | null
          signature_name: string | null
          signature_phone: string | null
          signature_role: string | null
          updated_at: string
          user_id: string
          weekly_summary_enabled: boolean | null
          whatsapp_style: string | null
        }
        Insert: {
          active?: boolean | null
          assistant_name?: string | null
          auto_follow_up_delay_hours?: number | null
          auto_follow_up_enabled?: boolean | null
          auto_reply_stages?: string[] | null
          autopilot_mode?: string
          brand_voice?: string | null
          closing_style?: string | null
          compliance_notes?: string | null
          created_at?: string
          daily_summary_enabled?: boolean | null
          default_tone?: string | null
          email_style?: string | null
          forbidden_phrases?: string[] | null
          id?: string
          max_response_length?: string | null
          must_use_phrases?: string[] | null
          objection_style?: string | null
          preferred_cta?: string | null
          response_language?: string | null
          sales_goal?: string | null
          should_offer_callback?: boolean | null
          should_push_financing?: boolean | null
          should_push_test_drive?: boolean | null
          should_push_trade_in?: boolean | null
          signature_email?: string | null
          signature_name?: string | null
          signature_phone?: string | null
          signature_role?: string | null
          updated_at?: string
          user_id: string
          weekly_summary_enabled?: boolean | null
          whatsapp_style?: string | null
        }
        Update: {
          active?: boolean | null
          assistant_name?: string | null
          auto_follow_up_delay_hours?: number | null
          auto_follow_up_enabled?: boolean | null
          auto_reply_stages?: string[] | null
          autopilot_mode?: string
          brand_voice?: string | null
          closing_style?: string | null
          compliance_notes?: string | null
          created_at?: string
          daily_summary_enabled?: boolean | null
          default_tone?: string | null
          email_style?: string | null
          forbidden_phrases?: string[] | null
          id?: string
          max_response_length?: string | null
          must_use_phrases?: string[] | null
          objection_style?: string | null
          preferred_cta?: string | null
          response_language?: string | null
          sales_goal?: string | null
          should_offer_callback?: boolean | null
          should_push_financing?: boolean | null
          should_push_test_drive?: boolean | null
          should_push_trade_in?: boolean | null
          signature_email?: string | null
          signature_name?: string | null
          signature_phone?: string | null
          signature_role?: string | null
          updated_at?: string
          user_id?: string
          weekly_summary_enabled?: boolean | null
          whatsapp_style?: string | null
        }
        Relationships: []
      }
      sales_assistant_tasks: {
        Row: {
          conversation_id: string
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          priority: string | null
          status: string | null
          task_type: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          task_type?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          task_type?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_assistant_tasks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sales_assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      sales_email_outbox: {
        Row: {
          body_html: string
          body_text: string | null
          conversation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          lead_id: string | null
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          to_name: string | null
          user_id: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
          to_name?: string | null
          user_id: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          to_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_email_outbox_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sales_assistant_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_email_outbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_knowledge_chunks: {
        Row: {
          chunk_index: number | null
          chunk_text: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          token_count: number | null
          user_id: string
        }
        Insert: {
          chunk_index?: number | null
          chunk_text: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          token_count?: number | null
          user_id: string
        }
        Update: {
          chunk_index?: number | null
          chunk_text?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          token_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "sales_knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_knowledge_documents: {
        Row: {
          chunk_count: number | null
          content_text: string | null
          created_at: string
          document_type: string
          embedding_status: string | null
          id: string
          is_active: boolean | null
          mime_type: string | null
          public_url: string | null
          source_type: string
          storage_path: string | null
          title: string
          updated_at: string
          user_id: string
          version_label: string | null
        }
        Insert: {
          chunk_count?: number | null
          content_text?: string | null
          created_at?: string
          document_type?: string
          embedding_status?: string | null
          id?: string
          is_active?: boolean | null
          mime_type?: string | null
          public_url?: string | null
          source_type?: string
          storage_path?: string | null
          title: string
          updated_at?: string
          user_id: string
          version_label?: string | null
        }
        Update: {
          chunk_count?: number | null
          content_text?: string | null
          created_at?: string
          document_type?: string
          embedding_status?: string | null
          id?: string
          is_active?: boolean | null
          mime_type?: string | null
          public_url?: string | null
          source_type?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          version_label?: string | null
        }
        Relationships: []
      }
      sales_notifications: {
        Row: {
          action_payload: Json | null
          action_type: string | null
          approval_status: string | null
          body: string | null
          created_at: string
          id: string
          is_read: boolean | null
          notification_type: string
          related_conversation_id: string | null
          related_lead_id: string | null
          requires_approval: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          action_payload?: Json | null
          action_type?: string | null
          approval_status?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          notification_type?: string
          related_conversation_id?: string | null
          related_lead_id?: string | null
          requires_approval?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          action_payload?: Json | null
          action_type?: string | null
          approval_status?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          notification_type?: string
          related_conversation_id?: string | null
          related_lead_id?: string | null
          requires_approval?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_notifications_related_conversation_id_fkey"
            columns: ["related_conversation_id"]
            isOneToOne: false
            referencedRelation: "sales_assistant_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_notifications_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quotes: {
        Row: {
          base_price: number | null
          conversation_id: string | null
          created_at: string
          discount_amount: number | null
          discount_reason: string | null
          final_price: number | null
          financing_down_payment: number | null
          financing_monthly_rate: number | null
          financing_term_months: number | null
          id: string
          lead_id: string | null
          leasing_mileage_per_year: number | null
          leasing_monthly_rate: number | null
          leasing_term_months: number | null
          notes: string | null
          project_id: string | null
          sent_at: string | null
          status: string
          trade_in_value: number | null
          updated_at: string
          user_id: string
          valid_until: string | null
          vehicle_title: string | null
        }
        Insert: {
          base_price?: number | null
          conversation_id?: string | null
          created_at?: string
          discount_amount?: number | null
          discount_reason?: string | null
          final_price?: number | null
          financing_down_payment?: number | null
          financing_monthly_rate?: number | null
          financing_term_months?: number | null
          id?: string
          lead_id?: string | null
          leasing_mileage_per_year?: number | null
          leasing_monthly_rate?: number | null
          leasing_term_months?: number | null
          notes?: string | null
          project_id?: string | null
          sent_at?: string | null
          status?: string
          trade_in_value?: number | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
          vehicle_title?: string | null
        }
        Update: {
          base_price?: number | null
          conversation_id?: string | null
          created_at?: string
          discount_amount?: number | null
          discount_reason?: string | null
          final_price?: number | null
          financing_down_payment?: number | null
          financing_monthly_rate?: number | null
          financing_term_months?: number | null
          id?: string
          lead_id?: string | null
          leasing_mileage_per_year?: number | null
          leasing_monthly_rate?: number | null
          leasing_term_months?: number | null
          notes?: string | null
          project_id?: string | null
          sent_at?: string | null
          status?: string
          trade_in_value?: number | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
          vehicle_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_quotes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sales_assistant_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_pdfs: {
        Row: {
          active: boolean
          brand: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          model: string | null
          pdf_url: string
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          model?: string | null
          pdf_url: string
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          model?: string | null
          pdf_url?: string
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          extra_credit_price_cents: number
          features: Json
          id: string
          monthly_credits: number
          name: string
          price_monthly_cents: number
          price_yearly_cents: number
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          extra_credit_price_cents?: number
          features?: Json
          id?: string
          monthly_credits?: number
          name: string
          price_monthly_cents?: number
          price_yearly_cents?: number
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          extra_credit_price_cents?: number
          features?: Json
          id?: string
          monthly_credits?: number
          name?: string
          price_monthly_cents?: number
          price_yearly_cents?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      test_drive_bookings: {
        Row: {
          booking_date: string
          booking_time: string
          conversation_id: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          duration_minutes: number
          id: string
          lead_id: string | null
          notes: string | null
          project_id: string | null
          reminder_sent: boolean
          status: string
          updated_at: string
          user_id: string
          vehicle_title: string | null
        }
        Insert: {
          booking_date: string
          booking_time: string
          conversation_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          duration_minutes?: number
          id?: string
          lead_id?: string | null
          notes?: string | null
          project_id?: string | null
          reminder_sent?: boolean
          status?: string
          updated_at?: string
          user_id: string
          vehicle_title?: string | null
        }
        Update: {
          booking_date?: string
          booking_time?: string
          conversation_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          duration_minutes?: number
          id?: string
          lead_id?: string | null
          notes?: string | null
          project_id?: string | null
          reminder_sent?: boolean
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_drive_bookings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sales_assistant_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_drive_bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_drive_bookings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_in_valuations: {
        Row: {
          condition: string | null
          conversation_id: string | null
          created_at: string
          equipment: Json | null
          estimated_value_max: number | null
          estimated_value_min: number | null
          id: string
          lead_id: string | null
          mileage_km: number | null
          notes: string | null
          status: string
          updated_at: string
          user_id: string
          variant: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_year: number | null
          vin: string | null
        }
        Insert: {
          condition?: string | null
          conversation_id?: string | null
          created_at?: string
          equipment?: Json | null
          estimated_value_max?: number | null
          estimated_value_min?: number | null
          id?: string
          lead_id?: string | null
          mileage_km?: number | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
          variant?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: number | null
          vin?: string | null
        }
        Update: {
          condition?: string | null
          conversation_id?: string | null
          created_at?: string
          equipment?: Json | null
          estimated_value_max?: number | null
          estimated_value_min?: number | null
          id?: string
          lead_id?: string | null
          mileage_km?: number | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          variant?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: number | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_in_valuations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sales_assistant_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_in_valuations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_credits: {
        Args: {
          _action_type: Database["public"]["Enums"]["credit_action_type"]
          _amount: number
          _description?: string
          _user_id: string
        }
        Returns: Json
      }
      deduct_credits: {
        Args: {
          _action_type: Database["public"]["Enums"]["credit_action_type"]
          _amount: number
          _description?: string
          _model?: string
          _user_id: string
        }
        Returns: Json
      }
      generate_api_key: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      billing_cycle: "monthly" | "yearly"
      credit_action_type:
        | "pdf_analysis"
        | "image_generate"
        | "image_remaster"
        | "vin_ocr"
        | "credit_purchase"
        | "subscription_reset"
        | "admin_adjustment"
        | "landing_page_export"
      subscription_status: "active" | "cancelled" | "past_due" | "trialing"
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
      app_role: ["admin", "moderator", "user"],
      billing_cycle: ["monthly", "yearly"],
      credit_action_type: [
        "pdf_analysis",
        "image_generate",
        "image_remaster",
        "vin_ocr",
        "credit_purchase",
        "subscription_reset",
        "admin_adjustment",
        "landing_page_export",
      ],
      subscription_status: ["active", "cancelled", "past_due", "trialing"],
    },
  },
} as const
