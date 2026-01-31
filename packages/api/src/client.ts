// Supabase Client - Casa API
// Separated to avoid circular dependencies

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types/database';

// Singleton Supabase client
let supabaseInstance: SupabaseClient<Database> | null = null;
let configuredUrl: string = '';
let configuredAnonKey: string = '';

// Initialize Supabase with runtime config (called from app entry point)
export function initializeSupabase(url: string, anonKey: string): void {
  configuredUrl = url;
  configuredAnonKey = anonKey;
  supabaseInstance = null; // Reset instance to use new config
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    if (!configuredUrl || !configuredAnonKey) {
      throw new Error(
        'Supabase not initialized. Call initializeSupabase(url, anonKey) first.'
      );
    }
    supabaseInstance = createClient<Database>(configuredUrl, configuredAnonKey, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return supabaseInstance;
}

// Check if Supabase is configured (for conditional rendering)
export function isSupabaseConfigured(): boolean {
  return !!configuredUrl && !!configuredAnonKey;
}
