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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      breadcrumb_recipients: {
        Row: {
          breadcrumb_id: string
          created_at: string
          id: string
          recipient_id: string
        }
        Insert: {
          breadcrumb_id: string
          created_at?: string
          id?: string
          recipient_id: string
        }
        Update: {
          breadcrumb_id?: string
          created_at?: string
          id?: string
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breadcrumb_recipients_breadcrumb_id_fkey"
            columns: ["breadcrumb_id"]
            isOneToOne: false
            referencedRelation: "breadcrumbs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breadcrumb_recipients_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      breadcrumb_scriptures: {
        Row: {
          breadcrumb_id: string
          created_at: string
          id: string
          scripture_reference: string
          scripture_text: string | null
          sort_order: number
        }
        Insert: {
          breadcrumb_id: string
          created_at?: string
          id?: string
          scripture_reference: string
          scripture_text?: string | null
          sort_order?: number
        }
        Update: {
          breadcrumb_id?: string
          created_at?: string
          id?: string
          scripture_reference?: string
          scripture_text?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "breadcrumb_scriptures_breadcrumb_id_fkey"
            columns: ["breadcrumb_id"]
            isOneToOne: false
            referencedRelation: "breadcrumbs"
            referencedColumns: ["id"]
          },
        ]
      }
      breadcrumbs: {
        Row: {
          audio_url: string | null
          commentary_text: string | null
          content_type: string
          created_at: string
          creator_id: string
          family_id: string | null
          file_url: string | null
          id: string
          include_commentary: boolean | null
          is_scripture: boolean | null
          media_url: string | null
          recipient_id: string
          scripture_reference: string | null
          scripture_text: string | null
          tags: string[] | null
          text_body: string | null
          title: string
          topic_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          audio_url?: string | null
          commentary_text?: string | null
          content_type?: string
          created_at?: string
          creator_id: string
          family_id?: string | null
          file_url?: string | null
          id?: string
          include_commentary?: boolean | null
          is_scripture?: boolean | null
          media_url?: string | null
          recipient_id: string
          scripture_reference?: string | null
          scripture_text?: string | null
          tags?: string[] | null
          text_body?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          audio_url?: string | null
          commentary_text?: string | null
          content_type?: string
          created_at?: string
          creator_id?: string
          family_id?: string | null
          file_url?: string | null
          id?: string
          include_commentary?: boolean | null
          is_scripture?: boolean | null
          media_url?: string | null
          recipient_id?: string
          scripture_reference?: string | null
          scripture_text?: string | null
          tags?: string[] | null
          text_body?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "breadcrumbs_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breadcrumbs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breadcrumbs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breadcrumbs_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      creator_achievements: {
        Row: {
          achievement_name: string
          achievement_type: string
          description: string | null
          earned_at: string
          id: string
          metadata: Json | null
          profile_id: string
        }
        Insert: {
          achievement_name: string
          achievement_type: string
          description?: string | null
          earned_at?: string
          id?: string
          metadata?: Json | null
          profile_id: string
        }
        Update: {
          achievement_name?: string
          achievement_type?: string
          description?: string | null
          earned_at?: string
          id?: string
          metadata?: Json | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_achievements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_streaks: {
        Row: {
          current_streak: number
          id: string
          last_activity_date: string | null
          longest_streak: number
          profile_id: string
          updated_at: string
          week_start_count: number
        }
        Insert: {
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          profile_id: string
          updated_at?: string
          week_start_count?: number
        }
        Update: {
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          profile_id?: string
          updated_at?: string
          week_start_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_streaks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      family_members: {
        Row: {
          created_at: string
          family_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email: string
          id?: string
          name: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          ai_answer_text: string | null
          created_at: string
          id: string
          question_text: string
          recipient_id: string
        }
        Insert: {
          ai_answer_text?: string | null
          created_at?: string
          id?: string
          question_text: string
          recipient_id: string
        }
        Update: {
          ai_answer_text?: string | null
          created_at?: string
          id?: string
          question_text?: string
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      recipients: {
        Row: {
          created_at: string
          creator_id: string
          date_of_birth: string | null
          display_name: string
          email: string | null
          id: string
          relationship: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          date_of_birth?: string | null
          display_name: string
          email?: string | null
          id?: string
          relationship?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          date_of_birth?: string | null
          display_name?: string
          email?: string | null
          id?: string
          relationship?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipients_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order: number
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "topics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_challenges: {
        Row: {
          challenge_description: string
          challenge_type: string
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          profile_id: string
          target_recipient_id: string | null
          target_topic_id: string | null
          week_start: string
        }
        Insert: {
          challenge_description: string
          challenge_type: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          profile_id: string
          target_recipient_id?: string | null
          target_topic_id?: string | null
          week_start: string
        }
        Update: {
          challenge_description?: string
          challenge_type?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          profile_id?: string
          target_recipient_id?: string | null
          target_topic_id?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_challenges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_challenges_target_recipient_id_fkey"
            columns: ["target_recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_challenges_target_topic_id_fkey"
            columns: ["target_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_family_id: { Args: { _user_id: string }; Returns: string }
      is_family_owner: {
        Args: { _family_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "creator" | "recipient"
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
      app_role: ["creator", "recipient"],
    },
  },
} as const
