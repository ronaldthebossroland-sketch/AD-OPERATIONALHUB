import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const placeholderPattern =
  /replace|placeholder|your-|your_|publishable-key|anon-key/i;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

function isUsableEnvValue(value) {
  return Boolean(value && !placeholderPattern.test(value));
}

export const isSupabaseConfigured =
  isUsableEnvValue(supabaseUrl) && isUsableEnvValue(supabasePublishableKey);

export const supabaseStatusMessage = !isUsableEnvValue(supabaseUrl)
  ? "Missing EXPO_PUBLIC_SUPABASE_URL"
  : !isUsableEnvValue(supabasePublishableKey)
    ? "Missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    : "Supabase configured";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
      },
    })
  : null;

if (supabase) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
