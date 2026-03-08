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
      leads: {
        Row: {
          created_at: string
          dealer_user_id: string
          email: string
          id: string
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
          city: string | null
          company_name: string | null
          contact_name: string | null
          created_at: string
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
          city?: string | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
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
          city?: string | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
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
          id: string
          image_base64: string
          image_url: string | null
          perspective: string | null
          project_id: string
          sort_order: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_base64: string
          image_url?: string | null
          perspective?: string | null
          project_id: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_base64?: string
          image_url?: string | null
          perspective?: string | null
          project_id?: string
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
