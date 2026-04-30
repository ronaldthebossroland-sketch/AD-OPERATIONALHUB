import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

import { API_BASE_URL, loginWithSupabaseToken } from "./api";
import {
  isSupabaseAuthConfigured,
  supabase,
  SUPABASE_NATIVE_REDIRECT_URL,
  SUPABASE_WEB_REDIRECT_URL,
} from "./supabaseClient";

function ensureSupabaseAuth() {
  if (!isSupabaseAuthConfigured || !supabase) {
    throw new Error(
      "Supabase auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel."
    );
  }
}

function getOAuthRedirectUrl() {
  return Capacitor.isNativePlatform()
    ? SUPABASE_NATIVE_REDIRECT_URL
    : SUPABASE_WEB_REDIRECT_URL;
}

function readAuthParams(url) {
  const parsedUrl = new URL(url);
  const searchParams = parsedUrl.searchParams;
  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ""));

  return {
    accessToken:
      searchParams.get("access_token") || hashParams.get("access_token"),
    code: searchParams.get("code") || hashParams.get("code"),
    error: searchParams.get("error") || hashParams.get("error"),
    errorDescription:
      searchParams.get("error_description") ||
      hashParams.get("error_description"),
    parsedUrl,
    refreshToken:
      searchParams.get("refresh_token") || hashParams.get("refresh_token"),
  };
}

function hasAuthParams(url) {
  try {
    const params = readAuthParams(url);

    return Boolean(
      params.code ||
        params.accessToken ||
        params.refreshToken ||
        params.error ||
        params.errorDescription
    );
  } catch {
    return false;
  }
}

function isOAuthReturnUrl(url) {
  try {
    const { parsedUrl } = readAuthParams(url);
    const isNativeReturn =
      parsedUrl.protocol === "capacitor:" && parsedUrl.host === "localhost";
    const isWebReturn = parsedUrl.href.startsWith(SUPABASE_WEB_REDIRECT_URL);

    return isNativeReturn || isWebReturn || hasAuthParams(url);
  } catch {
    return false;
  }
}

function cleanCurrentUrl() {
  if (typeof window === "undefined" || !window.history?.replaceState) {
    return;
  }

  window.history.replaceState({}, document.title, window.location.pathname || "/");
}

async function syncAppSessionFromSupabase() {
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

export async function signInWithGoogle() {
  ensureSupabaseAuth();

  const isNative = Capacitor.isNativePlatform();
  const redirectTo = getOAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: isNative,
    },
  });

  if (error) {
    throw error;
  }

  if (isNative) {
    if (!data?.url) {
      throw new Error("Supabase did not return a Google sign-in URL.");
    }

    await Browser.open({
      presentationStyle: "fullscreen",
      url: data.url,
      windowName: "_self",
    });
  }

  return data;
}

export async function completeSupabaseAuthFromUrl(url) {
  ensureSupabaseAuth();

  if (!url || !isOAuthReturnUrl(url)) {
    return null;
  }

  const { accessToken, code, error, errorDescription, refreshToken } =
    readAuthParams(url);

  if (error || errorDescription) {
    throw new Error(errorDescription || error);
  }

  if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      throw exchangeError;
    }
  } else if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      throw sessionError;
    }
  }

  cleanCurrentUrl();

  return syncAppSessionFromSupabase();
}

export async function registerOAuthDeepLinkHandler(onUser) {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  async function handleUrl(url) {
    if (!isOAuthReturnUrl(url)) {
      return;
    }

    await Browser.close().catch(() => {});
    const user = await completeSupabaseAuthFromUrl(url);

    if (user) {
      onUser?.(user);
    }
  }

  const launchUrl = await App.getLaunchUrl();

  if (launchUrl?.url) {
    await handleUrl(launchUrl.url);
  }

  const listener = await App.addListener("appUrlOpen", ({ url }) => {
    handleUrl(url).catch((error) => {
      console.error("Could not complete Google OAuth return:", error);
    });
  });

  return () => {
    listener.remove();
  };
}

export async function syncSupabaseAuthSession() {
  if (!isSupabaseAuthConfigured || !supabase) {
    return null;
  }

  if (
    !Capacitor.isNativePlatform() &&
    typeof window !== "undefined" &&
    hasAuthParams(window.location.toString())
  ) {
    return completeSupabaseAuthFromUrl(window.location.toString());
  }

  return syncAppSessionFromSupabase();
}

export async function connectGmailWithGoogle() {
  await Browser.open({
    presentationStyle: "fullscreen",
    url: `${API_BASE_URL}/auth/google`,
    windowName: "_self",
  });
}
