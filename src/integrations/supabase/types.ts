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
      brain_dumps: {
        Row: {
          created_at: string | null
          id: string
          notion_id: string | null
          processed: boolean | null
          raw_text: string
          source: string | null
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notion_id?: string | null
          processed?: boolean | null
          raw_text: string
          source?: string | null
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notion_id?: string | null
          processed?: boolean | null
          raw_text?: string
          source?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brain_dumps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_plans: {
        Row: {
          ai_notes: string | null
          completion_rate: number | null
          confirmed_at: string | null
          created_at: string | null
          id: string
          plan_data: Json
          plan_date: string
          reviewed_at: string | null
          status: string | null
          tasks_completed: number | null
          tasks_planned: number | null
          total_actual_minutes: number | null
          total_planned_minutes: number | null
        }
        Insert: {
          ai_notes?: string | null
          completion_rate?: number | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          plan_data?: Json
          plan_date: string
          reviewed_at?: string | null
          status?: string | null
          tasks_completed?: number | null
          tasks_planned?: number | null
          total_actual_minutes?: number | null
          total_planned_minutes?: number | null
        }
        Update: {
          ai_notes?: string | null
          completion_rate?: number | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          plan_data?: Json
          plan_date?: string
          reviewed_at?: string | null
          status?: string | null
          tasks_completed?: number | null
          tasks_planned?: number | null
          total_actual_minutes?: number | null
          total_planned_minutes?: number | null
        }
        Relationships: []
      }
      grocery_items: {
        Row: {
          checked: boolean | null
          created_at: string | null
          id: string
          item: string
          quantity: number
          section: string | null
          store_id: string | null
        }
        Insert: {
          checked?: boolean | null
          created_at?: string | null
          id?: string
          item: string
          quantity?: number
          section?: string | null
          store_id?: string | null
        }
        Update: {
          checked?: boolean | null
          created_at?: string | null
          id?: string
          item?: string
          quantity?: number
          section?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grocery_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      life_context: {
        Row: {
          context_text: string
          created_at: string | null
          id: string
        }
        Insert: {
          context_text: string
          created_at?: string | null
          id?: string
        }
        Update: {
          context_text?: string
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          ai_summary: string | null
          content: string
          created_at: string | null
          id: string
          image_url: string | null
          note_type: string | null
          reminder_date: string | null
          tags: string[] | null
          title: string | null
        }
        Insert: {
          ai_summary?: string | null
          content: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          note_type?: string | null
          reminder_date?: string | null
          tags?: string[] | null
          title?: string | null
        }
        Update: {
          ai_summary?: string | null
          content?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          note_type?: string | null
          reminder_date?: string | null
          tags?: string[] | null
          title?: string | null
        }
        Relationships: []
      }
      plan_items: {
        Row: {
          actual_minutes: number | null
          calendar_event_id: string | null
          category: string | null
          color: string | null
          created_at: string | null
          end_time: string
          est_minutes: number | null
          id: string
          is_calendar_event: boolean | null
          is_external: boolean
          local_only: boolean
          plan_id: string | null
          skip_reason: string | null
          sort_order: number | null
          start_time: string
          status: string | null
          task_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_minutes?: number | null
          calendar_event_id?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          end_time: string
          est_minutes?: number | null
          id?: string
          is_calendar_event?: boolean | null
          is_external?: boolean
          local_only?: boolean
          plan_id?: string | null
          skip_reason?: string | null
          sort_order?: number | null
          start_time: string
          status?: string | null
          task_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_minutes?: number | null
          calendar_event_id?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          end_time?: string
          est_minutes?: number | null
          id?: string
          is_calendar_event?: boolean | null
          is_external?: boolean
          local_only?: boolean
          plan_id?: string | null
          skip_reason?: string | null
          sort_order?: number | null
          start_time?: string
          status?: string | null
          task_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "daily_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          preference_text: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          preference_text: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          preference_text?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      recurring_tasks: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          day_of_month: number | null
          day_of_week: number | null
          est_minutes: number | null
          frequency: string
          id: string
          importance: string | null
          last_generated: string | null
          name: string
          urgency: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          est_minutes?: number | null
          frequency: string
          id?: string
          importance?: string | null
          last_generated?: string | null
          name: string
          urgency?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          est_minutes?: number | null
          frequency?: string
          id?: string
          importance?: string | null
          last_generated?: string | null
          name?: string
          urgency?: string | null
        }
        Relationships: []
      }
      stores: {
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
          sort_order?: number
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
      tasks: {
        Row: {
          actual_minutes: number | null
          ai_categorized: boolean | null
          ai_confidence: number | null
          category: string | null
          completed_at: string | null
          created_at: string | null
          deferred_until: string | null
          due_date: string | null
          est_minutes: number | null
          id: string
          importance: string | null
          name: string
          needs_triage: boolean | null
          notes: string | null
          notion_id: string | null
          priority_order: number | null
          quadrant: string | null
          skip_reason: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          urgency: string | null
        }
        Insert: {
          actual_minutes?: number | null
          ai_categorized?: boolean | null
          ai_confidence?: number | null
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          deferred_until?: string | null
          due_date?: string | null
          est_minutes?: number | null
          id?: string
          importance?: string | null
          name: string
          needs_triage?: boolean | null
          notes?: string | null
          notion_id?: string | null
          priority_order?: number | null
          quadrant?: string | null
          skip_reason?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          urgency?: string | null
        }
        Update: {
          actual_minutes?: number | null
          ai_categorized?: boolean | null
          ai_confidence?: number | null
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          deferred_until?: string | null
          due_date?: string | null
          est_minutes?: number | null
          id?: string
          importance?: string | null
          name?: string
          needs_triage?: boolean | null
          notes?: string | null
          notion_id?: string | null
          priority_order?: number | null
          quadrant?: string | null
          skip_reason?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          urgency?: string | null
        }
        Relationships: []
      }
      triage_queue: {
        Row: {
          ai_reasoning: string | null
          created_at: string | null
          id: string
          resolved_at: string | null
          status: string | null
          suggested_category: string | null
          suggested_est_minutes: number | null
          suggested_quadrant: string | null
          task_id: string | null
        }
        Insert: {
          ai_reasoning?: string | null
          created_at?: string | null
          id?: string
          resolved_at?: string | null
          status?: string | null
          suggested_category?: string | null
          suggested_est_minutes?: number | null
          suggested_quadrant?: string | null
          task_id?: string | null
        }
        Update: {
          ai_reasoning?: string | null
          created_at?: string | null
          id?: string
          resolved_at?: string | null
          status?: string | null
          suggested_category?: string | null
          suggested_est_minutes?: number | null
          suggested_quadrant?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "triage_queue_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
