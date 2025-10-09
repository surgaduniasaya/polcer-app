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
      dosen_details: {
        Row: {
          nidn: string | null
          prodi_id: string
          profile_id: string
        }
        Insert: {
          nidn?: string | null
          prodi_id: string
          profile_id: string
        }
        Update: {
          nidn?: string | null
          prodi_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dosen_details_prodi_id_fkey"
            columns: ["prodi_id"]
            isOneToOne: false
            referencedRelation: "program_studi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dosen_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dosen_mata_kuliah: {
        Row: {
          dosen_profile_id: string
          mata_kuliah_id: string
        }
        Insert: {
          dosen_profile_id: string
          mata_kuliah_id: string
        }
        Update: {
          dosen_profile_id?: string
          mata_kuliah_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dosen_mata_kuliah_dosen_profile_id_fkey"
            columns: ["dosen_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dosen_mata_kuliah_mata_kuliah_id_fkey"
            columns: ["mata_kuliah_id"]
            isOneToOne: false
            referencedRelation: "mata_kuliah"
            referencedColumns: ["id"]
          },
        ]
      }
      jurusan: {
        Row: {
          id: string
          kode_jurusan: string | null
          name: string
        }
        Insert: {
          id?: string
          kode_jurusan?: string | null
          name: string
        }
        Update: {
          id?: string
          kode_jurusan?: string | null
          name?: string
        }
        Relationships: []
      }
      mahasiswa_details: {
        Row: {
          angkatan: number
          nim: string
          prodi_id: string
          profile_id: string
        }
        Insert: {
          angkatan: number
          nim: string
          prodi_id: string
          profile_id: string
        }
        Update: {
          angkatan?: number
          nim?: string
          prodi_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mahasiswa_details_prodi_id_fkey"
            columns: ["prodi_id"]
            isOneToOne: false
            referencedRelation: "program_studi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mahasiswa_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mata_kuliah: {
        Row: {
          id: string
          kode_mk: string | null
          name: string
          prodi_id: string
          semester: number
        }
        Insert: {
          id?: string
          kode_mk?: string | null
          name: string
          prodi_id: string
          semester: number
        }
        Update: {
          id?: string
          kode_mk?: string | null
          name?: string
          prodi_id?: string
          semester?: number
        }
        Relationships: [
          {
            foreignKeyName: "mata_kuliah_prodi_id_fkey"
            columns: ["prodi_id"]
            isOneToOne: false
            referencedRelation: "program_studi"
            referencedColumns: ["id"]
          },
        ]
      }
      modul_ajar: {
        Row: {
          angkatan: number
          dosen_id: string
          file_url: string
          id: string
          mata_kuliah_id: string
          title: string
          uploaded_at: string
        }
        Insert: {
          angkatan: number
          dosen_id: string
          file_url: string
          id?: string
          mata_kuliah_id: string
          title: string
          uploaded_at?: string
        }
        Update: {
          angkatan?: number
          dosen_id?: string
          file_url?: string
          id?: string
          mata_kuliah_id?: string
          title?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modul_ajar_dosen_id_fkey"
            columns: ["dosen_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modul_ajar_mata_kuliah_id_fkey"
            columns: ["mata_kuliah_id"]
            isOneToOne: false
            referencedRelation: "mata_kuliah"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone_number: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone_number?: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      program_studi: {
        Row: {
          admin_id: string | null
          id: string
          jenjang: string
          jurusan_id: string
          kode_prodi_internal: string | null
          name: string
        }
        Insert: {
          admin_id?: string | null
          id?: string
          jenjang: string
          jurusan_id: string
          kode_prodi_internal?: string | null
          name: string
        }
        Update: {
          admin_id?: string | null
          id?: string
          jenjang?: string
          jurusan_id?: string
          kode_prodi_internal?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_studi_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_studi_jurusan_id_fkey"
            columns: ["jurusan_id"]
            isOneToOne: false
            referencedRelation: "jurusan"
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
      user_role: "super-admin" | "admin-prodi" | "dosen" | "mahasiswa"
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
      user_role: ["super-admin", "admin-prodi", "dosen", "mahasiswa"],
    },
  },
} as const
