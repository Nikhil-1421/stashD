/**
 * Database types for the `public` schema.
 *
 * Hand-written to match supabase/migrations. Regenerate from a running local database with
 * `npm run db:types` whenever the schema changes; the generated file replaces this one.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Timestamps = { created_at: string; updated_at: string }
type TimestampsInsert = { created_at?: string; updated_at?: string }

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; avatar_url: string | null; preferences: Json } & Timestamps
        Insert: { id: string; display_name?: string | null; avatar_url?: string | null; preferences?: Json } & TimestampsInsert
        Update: { id?: string; display_name?: string | null; avatar_url?: string | null; preferences?: Json } & TimestampsInsert
        Relationships: []
      }
      games: {
        Row: { id: string; slug: string; name: string; metadata: Json } & Timestamps
        Insert: { id?: string; slug: string; name: string; metadata?: Json } & TimestampsInsert
        Update: { id?: string; slug?: string; name?: string; metadata?: Json } & TimestampsInsert
        Relationships: []
      }
      catalog_providers: {
        Row: {
          id: string
          slug: string
          name: string
          website_url: string | null
          terms_url: string | null
          attribution: string | null
          status: 'planned' | 'active' | 'deprecated' | 'disabled'
          metadata: Json
        } & Timestamps
        Insert: {
          id?: string
          slug: string
          name: string
          website_url?: string | null
          terms_url?: string | null
          attribution?: string | null
          status?: 'planned' | 'active' | 'deprecated' | 'disabled'
          metadata?: Json
        } & TimestampsInsert
        Update: {
          id?: string
          slug?: string
          name?: string
          website_url?: string | null
          terms_url?: string | null
          attribution?: string | null
          status?: 'planned' | 'active' | 'deprecated' | 'disabled'
          metadata?: Json
        } & TimestampsInsert
        Relationships: []
      }
      catalog_sets: {
        Row: {
          id: string
          game_id: string | null
          provider_id: string | null
          provider_set_id: string | null
          owner_id: string | null
          name: string
          set_code: string | null
          series: string | null
          release_date: string | null
          language: string
          description: string | null
          image_url: string | null
          metadata: Json
        } & Timestamps
        Insert: {
          id?: string
          game_id?: string | null
          provider_id?: string | null
          provider_set_id?: string | null
          owner_id?: string | null
          name: string
          set_code?: string | null
          series?: string | null
          release_date?: string | null
          language?: string
          description?: string | null
          image_url?: string | null
          metadata?: Json
        } & TimestampsInsert
        Update: {
          id?: string
          game_id?: string | null
          provider_id?: string | null
          provider_set_id?: string | null
          owner_id?: string | null
          name?: string
          set_code?: string | null
          series?: string | null
          release_date?: string | null
          language?: string
          description?: string | null
          image_url?: string | null
          metadata?: Json
        } & TimestampsInsert
        Relationships: []
      }
      catalog_cards: {
        Row: {
          id: string
          catalog_set_id: string
          owner_id: string | null
          provider_card_id: string | null
          name: string
          number: string | null
          sort_key: string | null
          rarity: string | null
          artist: string | null
          language: string | null
          image_url: string | null
          external_ids: Json
          metadata: Json
          position: number
        } & Timestamps
        Insert: {
          id?: string
          catalog_set_id: string
          owner_id?: string | null
          provider_card_id?: string | null
          name: string
          number?: string | null
          rarity?: string | null
          artist?: string | null
          language?: string | null
          image_url?: string | null
          external_ids?: Json
          metadata?: Json
          position?: number
        } & TimestampsInsert
        Update: {
          id?: string
          catalog_set_id?: string
          owner_id?: string | null
          provider_card_id?: string | null
          name?: string
          number?: string | null
          rarity?: string | null
          artist?: string | null
          language?: string | null
          image_url?: string | null
          external_ids?: Json
          metadata?: Json
          position?: number
        } & TimestampsInsert
        Relationships: []
      }
      variant_definitions: {
        Row: {
          id: string
          catalog_set_id: string
          owner_id: string | null
          slug: string
          name: string
          category: VariantCategory
          applies_by_default: boolean
          position: number
          metadata: Json
        } & Timestamps
        Insert: {
          id?: string
          catalog_set_id: string
          owner_id?: string | null
          slug: string
          name: string
          category?: VariantCategory
          applies_by_default?: boolean
          position?: number
          metadata?: Json
        } & TimestampsInsert
        Update: {
          id?: string
          catalog_set_id?: string
          owner_id?: string | null
          slug?: string
          name?: string
          category?: VariantCategory
          applies_by_default?: boolean
          position?: number
          metadata?: Json
        } & TimestampsInsert
        Relationships: []
      }
      card_printings: {
        Row: {
          id: string
          catalog_card_id: string
          variant_definition_id: string
          owner_id: string | null
          provider_printing_id: string | null
          image_url: string | null
          metadata: Json
        } & Timestamps
        Insert: {
          id?: string
          catalog_card_id: string
          variant_definition_id: string
          owner_id?: string | null
          provider_printing_id?: string | null
          image_url?: string | null
          metadata?: Json
        } & TimestampsInsert
        Update: {
          id?: string
          catalog_card_id?: string
          variant_definition_id?: string
          owner_id?: string | null
          provider_printing_id?: string | null
          image_url?: string | null
          metadata?: Json
        } & TimestampsInsert
        Relationships: []
      }
      user_sets: {
        Row: {
          id: string
          user_id: string
          catalog_set_id: string
          tracking_name: string | null
          status: 'active' | 'archived'
          favorite: boolean
          metadata: Json
        } & Timestamps
        Insert: {
          id?: string
          user_id: string
          catalog_set_id: string
          tracking_name?: string | null
          status?: 'active' | 'archived'
          favorite?: boolean
          metadata?: Json
        } & TimestampsInsert
        Update: {
          id?: string
          user_id?: string
          catalog_set_id?: string
          tracking_name?: string | null
          status?: 'active' | 'archived'
          favorite?: boolean
          metadata?: Json
        } & TimestampsInsert
        Relationships: []
      }
      checklist_import_jobs: {
        Row: {
          id: string
          user_id: string
          catalog_set_id: string | null
          source: ImportSource
          strategy: ConflictStrategyDb
          status: 'committed'
          summary: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          catalog_set_id?: string | null
          source: ImportSource
          strategy: ConflictStrategyDb
          status?: 'committed'
          summary?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          catalog_set_id?: string | null
          source?: ImportSource
          strategy?: ConflictStrategyDb
          status?: 'committed'
          summary?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_set_overview: {
        Row: {
          id: string
          user_id: string
          catalog_set_id: string
          tracking_name: string | null
          status: 'active' | 'archived'
          favorite: boolean
          created_at: string
          updated_at: string
          set_name: string
          set_code: string | null
          series: string | null
          release_date: string | null
          language: string
          description: string | null
          image_url: string | null
          set_owner_id: string | null
          provider_id: string | null
          game_id: string | null
          game_slug: string | null
          game_name: string | null
          card_count: number
          variant_count: number
        }
        Relationships: []
      }
    }
    Functions: {
      delete_own_account: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_custom_set: {
        Args: {
          p_name: string
          p_game_id?: string | null
          p_set_code?: string | null
          p_series?: string | null
          p_release_date?: string | null
          p_language?: string | null
          p_description?: string | null
          p_default_variant_name?: string | null
        }
        Returns: string
      }
      card_number_sort_key: {
        Args: { n: string }
        Returns: string
      }
      import_checklist: {
        Args: {
          p_catalog_set_id: string
          p_source: ImportSource
          p_strategy: ConflictStrategyDb
          p_cards: Json
          p_variants?: Json
        }
        Returns: Json
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

export type VariantCategory = 'finish' | 'edition' | 'parallel' | 'language' | 'promo' | 'rarity' | 'other'
export type ImportSource = 'paste' | 'csv' | 'tsv' | 'json'
export type ConflictStrategyDb = 'skip' | 'update' | 'create'

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row']
