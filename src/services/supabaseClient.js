import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const SUPABASE_WEB_REDIRECT_URL =
  "https://ad-operationalhub-seven.vercel.app";
export const SUPABASE_LOCAL_REDIRECT_URL = "http://localhost:5173";
export const SUPABASE_NATIVE_REDIRECT_URL = "capacitor://localhost";

export const isSupabaseAuthConfigured = Boolean(
  supabaseUrl && supabaseAnonKey
);

export const supabase = isSupabaseAuthConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        persistSession: true,
      },
    })
  : null;
