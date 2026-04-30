import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

import { API_BASE_URL, loginWithSupabaseToken } from "./api";
import {
  isSupabaseAuthConfigured,
  supabase,
  SUPABASE_REDIRECT_URL,
} from "./supabaseClient";

function ensureSupabaseAuth() {
  if (!isSupabaseAuthConfigured || !supabase) {
    throw new Error(
      "Supabase auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel."
    );
  }
}

export async function signInWithGoogle() {
  ensureSupabaseAuth();

  if (Capacitor.isNativePlatform()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: SUPABASE_REDIRECT_URL,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      throw error;
    }

    if (!data?.url) {
      throw new Error("Supabase did not return a Google sign-in URL.");
    }

    await Browser.open({
      presentationStyle: "fullscreen",
      url: data.url,
      windowName: "_self",
    });

    return data;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: SUPABASE_REDIRECT_URL,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function syncSupabaseAuthSession() {
  if (!isSupabaseAuthConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    return null;
  }

  const result = await loginWithSupabaseToken(accessToken);

  if (!result.ok) {
    throw new Error(result.error || "Could not finish Google sign-in.");
  }

  return result.user || null;
}

export async function connectGmailWithGoogle() {
  await Browser.open({
    presentationStyle: "fullscreen",
    url: `${API_BASE_URL}/auth/google`,
    windowName: "_self",
  });
}
