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
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      candidates: {
        Row: {
          ballot_name: string | null
          created_at: string
          deputy_name: string | null
          deputy_photo_path: string | null
          election_id: string
          full_name: string
          id: string
          is_active: boolean
          number: string
          party_acronym: string | null
          party_name: string | null
          photo_path: string | null
          position_id: string
        }
        Insert: {
          ballot_name?: string | null
          created_at?: string
          deputy_name?: string | null
          deputy_photo_path?: string | null
          election_id: string
          full_name: string
          id?: string
          is_active?: boolean
          number: string
          party_acronym?: string | null
          party_name?: string | null
          photo_path?: string | null
          position_id: string
        }
        Update: {
          ballot_name?: string | null
          created_at?: string
          deputy_name?: string | null
          deputy_photo_path?: string | null
          election_id?: string
          full_name?: string
          id?: string
          is_active?: boolean
          number?: string
          party_acronym?: string | null
          party_name?: string | null
          photo_path?: string | null
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_position_fk"
            columns: ["position_id", "election_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id", "election_id"]
          },
        ]
      }
      election_voters: {
        Row: {
          ballot_box_terminal_id: string | null
          created_at: string
          election_id: string
          id: string
          positions_completed: number
          released_at: string | null
          released_by_terminal_id: string | null
          section_id: string | null
          session_expires_at: string | null
          session_token_hash: string | null
          status: Database["public"]["Enums"]["voter_status"]
          student_id: string
          voted_at: string | null
          voting_started_at: string | null
        }
        Insert: {
          ballot_box_terminal_id?: string | null
          created_at?: string
          election_id: string
          id?: string
          positions_completed?: number
          released_at?: string | null
          released_by_terminal_id?: string | null
          section_id?: string | null
          session_expires_at?: string | null
          session_token_hash?: string | null
          status?: Database["public"]["Enums"]["voter_status"]
          student_id: string
          voted_at?: string | null
          voting_started_at?: string | null
        }
        Update: {
          ballot_box_terminal_id?: string | null
          created_at?: string
          election_id?: string
          id?: string
          positions_completed?: number
          released_at?: string | null
          released_by_terminal_id?: string | null
          section_id?: string | null
          session_expires_at?: string | null
          session_token_hash?: string | null
          status?: Database["public"]["Enums"]["voter_status"]
          student_id?: string
          voted_at?: string | null
          voting_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "election_voters_ballot_box_fk"
            columns: ["ballot_box_terminal_id", "election_id"]
            isOneToOne: false
            referencedRelation: "terminals"
            referencedColumns: ["id", "election_id"]
          },
          {
            foreignKeyName: "election_voters_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_voters_released_by_fk"
            columns: ["released_by_terminal_id", "election_id"]
            isOneToOne: false
            referencedRelation: "terminals"
            referencedColumns: ["id", "election_id"]
          },
          {
            foreignKeyName: "election_voters_section_fk"
            columns: ["section_id", "election_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id", "election_id"]
          },
          {
            foreignKeyName: "election_voters_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      elections: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          opened_at: string | null
          status: Database["public"]["Enums"]["election_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          opened_at?: string | null
          status?: Database["public"]["Enums"]["election_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          opened_at?: string | null
          status?: Database["public"]["Enums"]["election_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "elections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          created_at: string
          digits: number
          display_order: number
          election_id: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          digits: number
          display_order: number
          election_id: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          digits?: number
          display_order?: number
          election_id?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      sections: {
        Row: {
          code: string
          created_at: string
          election_id: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          election_id: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          election_id?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_name: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          photo_path: string | null
          rm: string
          updated_at: string
        }
        Insert: {
          class_name?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          photo_path?: string | null
          rm: string
          updated_at?: string
        }
        Update: {
          class_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          photo_path?: string | null
          rm?: string
          updated_at?: string
        }
        Relationships: []
      }
      terminals: {
        Row: {
          created_at: string
          election_id: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["terminal_kind"]
          label: string
          last_seen_at: string | null
          paired_at: string | null
          pairing_code: string | null
          pairing_code_expires_at: string | null
          section_id: string
          token_hash: string | null
        }
        Insert: {
          created_at?: string
          election_id: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["terminal_kind"]
          label: string
          last_seen_at?: string | null
          paired_at?: string | null
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          section_id: string
          token_hash?: string | null
        }
        Update: {
          created_at?: string
          election_id?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["terminal_kind"]
          label?: string
          last_seen_at?: string | null
          paired_at?: string | null
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          section_id?: string
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terminals_section_fk"
            columns: ["section_id", "election_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id", "election_id"]
          },
        ]
      }
      votes: {
        Row: {
          candidate_id: string | null
          election_id: string
          id: string
          position_id: string
          recorded_hour: string
          vote_type: Database["public"]["Enums"]["vote_type"]
        }
        Insert: {
          candidate_id?: string | null
          election_id: string
          id?: string
          position_id: string
          recorded_hour?: string
          vote_type: Database["public"]["Enums"]["vote_type"]
        }
        Update: {
          candidate_id?: string | null
          election_id?: string
          id?: string
          position_id?: string
          recorded_hour?: string
          vote_type?: Database["public"]["Enums"]["vote_type"]
        }
        Relationships: [
          {
            foreignKeyName: "votes_candidate_fk"
            columns: ["candidate_id", "election_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id", "election_id"]
          },
          {
            foreignKeyName: "votes_position_fk"
            columns: ["position_id", "election_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id", "election_id"]
          },
        ]
      }
    }
    Views: {
      v_results_by_candidate: {
        Row: {
          candidate_id: string | null
          candidate_name: string | null
          display_order: number | null
          election_id: string | null
          number: string | null
          party_name: string | null
          position_id: string | null
          position_name: string | null
          votes: number | null
        }
        Relationships: []
      }
      v_results_totals: {
        Row: {
          blank_votes: number | null
          election_id: string | null
          null_votes: number | null
          position_id: string | null
          total_votes: number | null
          valid_votes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_position_fk"
            columns: ["position_id", "election_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id", "election_id"]
          },
        ]
      }
      v_turnout: {
        Row: {
          absent: number | null
          election_id: string | null
          eligible: number | null
          turnout_pct: number | null
          voted: number | null
        }
        Relationships: [
          {
            foreignKeyName: "election_voters_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cast_vote: {
        Args: {
          p_candidate_number?: string
          p_position_id: string
          p_position_order: number
          p_terminal_id: string
          p_vote_type: Database["public"]["Enums"]["vote_type"]
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operator"
      election_status: "draft" | "open" | "closed"
      terminal_kind: "poll_worker" | "ballot_box"
      vote_type: "candidate" | "blank" | "null"
      voter_status: "waiting" | "released" | "voting" | "voted"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "operator"],
      election_status: ["draft", "open", "closed"],
      terminal_kind: ["poll_worker", "ballot_box"],
      vote_type: ["candidate", "blank", "null"],
      voter_status: ["waiting", "released", "voting", "voted"],
    },
  },
} as const
