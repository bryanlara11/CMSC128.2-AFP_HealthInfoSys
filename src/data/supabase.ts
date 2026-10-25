import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigurationError = !url || !key
  ? 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart the development server.'
  : null;

// Missing configuration shows a setup message; it never enables demo authentication.
export const supabase = url && key ? createClient(url, key) : null;

export function requireSupabase() {
  if (!supabase) throw new Error(supabaseConfigurationError!);
  return supabase;
}

export function databaseError(message: string, code?: string): Error {
  if (code === 'PGRST202' || code === 'PGRST205' || code === '42703' || code === '42P01') {
    return new Error('Supabase setup is incomplete. Apply migrations through 202610250003_analytics_editing_audit.sql in the SQL Editor.');
  }
  return new Error(message);
}
