import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Singleton client for browser usage
let supabase: SupabaseClient<Database> | null = null

/**
 * Get the Supabase client instance.
 * Returns null if Supabase is not configured (graceful degradation).
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  if (!supabase) {
    supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
  }

  return supabase
}

/**
 * Check if Supabase is configured and available.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}
