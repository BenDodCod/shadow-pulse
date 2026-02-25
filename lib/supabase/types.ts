export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      game_sessions: {
        Row: {
          death_cause: string | null
          duration_seconds: number | null
          id: string
          level_reached: number
          mutators_selected: Json | null
          played_at: string | null
          score: number
          user_id: string | null
          wave_reached: number
        }
        Insert: {
          death_cause?: string | null
          duration_seconds?: number | null
          id?: string
          level_reached: number
          mutators_selected?: Json | null
          played_at?: string | null
          score: number
          user_id?: string | null
          wave_reached: number
        }
        Update: {
          death_cause?: string | null
          duration_seconds?: number | null
          id?: string
          level_reached?: number
          mutators_selected?: Json | null
          played_at?: string | null
          score?: number
          user_id?: string | null
          wave_reached?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_challenge_scores: {
        Row: {
          id: string
          challenge_date: string
          player_id: string
          player_name: string
          score: number
          wave_reached: number
          seed: string
          submitted_at: string | null
        }
        Insert: {
          id?: string
          challenge_date: string
          player_id: string
          player_name: string
          score: number
          wave_reached: number
          seed: string
          submitted_at?: string | null
        }
        Update: {
          id?: string
          challenge_date?: string
          player_id?: string
          player_name?: string
          score?: number
          wave_reached?: number
          seed?: string
          submitted_at?: string | null
        }
        Relationships: []
      }
      leaderboard: {
        Row: {
          id: string
          level_reached: number
          played_at: string | null
          score: number
          user_id: string | null
          wave_reached: number
        }
        Insert: {
          id?: string
          level_reached: number
          played_at?: string | null
          score: number
          user_id?: string | null
          wave_reached: number
        }
        Update: {
          id?: string
          level_reached?: number
          played_at?: string | null
          score?: number
          user_id?: string | null
          wave_reached?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          display_name: string
          level_reached: number
          played_at: string
          rank: number
          score: number
          username: string
          wave_reached: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  TableName extends keyof Database["public"]["Tables"]
> = Database["public"]["Tables"][TableName]["Row"]

export type TablesInsert<
  TableName extends keyof Database["public"]["Tables"]
> = Database["public"]["Tables"][TableName]["Insert"]

export type TablesUpdate<
  TableName extends keyof Database["public"]["Tables"]
> = Database["public"]["Tables"][TableName]["Update"]
