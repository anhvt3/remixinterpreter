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
      config: {
        Row: {
          content: string | null
          created_at: string
          id: string
          important_notes: string | null
          is_active: boolean | null
          is_deleted: boolean | null
          type: string
          updated_at: string
          version_name: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          important_notes?: string | null
          is_active?: boolean | null
          is_deleted?: boolean | null
          type: string
          updated_at?: string
          version_name: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          important_notes?: string | null
          is_active?: boolean | null
          is_deleted?: boolean | null
          type?: string
          updated_at?: string
          version_name?: string
        }
        Relationships: []
      }
      desc: {
        Row: {
          created_at: string
          id: string
          is_deleted: boolean | null
          lo_id: string | null
          name: string
          type: string
          updated_at: string
          video_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          lo_id?: string | null
          name: string
          type: string
          updated_at?: string
          video_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          lo_id?: string | null
          name?: string
          type?: string
          updated_at?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "desc_lo_id_fkey"
            columns: ["lo_id"]
            isOneToOne: false
            referencedRelation: "lo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desc_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "video"
            referencedColumns: ["id"]
          },
        ]
      }
      desc_version: {
        Row: {
          content: string | null
          created_at: string
          desc_id: string
          id: string
          is_deleted: boolean | null
          updated_at: string
          version_name: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          desc_id: string
          id?: string
          is_deleted?: boolean | null
          updated_at?: string
          version_name: string
        }
        Update: {
          content?: string | null
          created_at?: string
          desc_id?: string
          id?: string
          is_deleted?: boolean | null
          updated_at?: string
          version_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "desc_version_desc_id_fkey"
            columns: ["desc_id"]
            isOneToOne: false
            referencedRelation: "desc"
            referencedColumns: ["id"]
          },
        ]
      }
      dsl_script: {
        Row: {
          code: string
          created_at: string
          desc_id: string
          id: string
          is_deleted: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          desc_id: string
          id?: string
          is_deleted?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          desc_id?: string
          id?: string
          is_deleted?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dsl_script_desc_id_fkey"
            columns: ["desc_id"]
            isOneToOne: false
            referencedRelation: "desc"
            referencedColumns: ["id"]
          },
        ]
      }
      dsl_script_version: {
        Row: {
          content: string | null
          created_at: string
          dsl_script_id: string
          id: string
          is_deleted: boolean | null
          updated_at: string
          version_name: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          dsl_script_id: string
          id?: string
          is_deleted?: boolean | null
          updated_at?: string
          version_name: string
        }
        Update: {
          content?: string | null
          created_at?: string
          dsl_script_id?: string
          id?: string
          is_deleted?: boolean | null
          updated_at?: string
          version_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "dsl_script_version_dsl_script_id_fkey"
            columns: ["dsl_script_id"]
            isOneToOne: false
            referencedRelation: "dsl_script"
            referencedColumns: ["id"]
          },
        ]
      }
      lo: {
        Row: {
          code: string
          created_at: string
          id: string
          is_deleted: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      lo_version: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_deleted: boolean | null
          lo_id: string
          updated_at: string
          version_name: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          lo_id: string
          updated_at?: string
          version_name: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          lo_id?: string
          updated_at?: string
          version_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lo_version_lo_id_fkey"
            columns: ["lo_id"]
            isOneToOne: false
            referencedRelation: "lo"
            referencedColumns: ["id"]
          },
        ]
      }
      video: {
        Row: {
          code: string
          created_at: string
          id: string
          is_deleted: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      video_version: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_deleted: boolean | null
          updated_at: string
          version_name: string
          video_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          updated_at?: string
          version_name: string
          video_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          updated_at?: string
          version_name?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_version_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "video"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
