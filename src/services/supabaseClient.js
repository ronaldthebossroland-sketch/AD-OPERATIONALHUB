import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://fwoisysufauefhsrrxgr.supabase.co";
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const SUPABASE_WEB_REDIRECT_URL =
  "https://ad-operationalhub-seven.vercel.app/auth/callback";
export const SUPABASE_LOCAL_REDIRECT_URL =
  "http://localhost:5173/auth/callback";
export const SUPABASE_NATIVE_REDIRECT_URL =
  "capacitor://localhost/auth/callback";

export const isSupabaseAuthConfigured = Boolean(
  supabaseUrl && supabaseAnonKey
);

export const supabaseAuthConfigError = !supabaseAnonKey
  ? "Supabase auth is missing VITE_SUPABASE_ANON_KEY. Add your Supabase anon or publishable key to .env.local for local dev and to Vercel environment variables for production."
  : "";

export const supabase = isSupabaseAuthConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "implicit",
        persistSession: true,
      },
    })
  : null;
