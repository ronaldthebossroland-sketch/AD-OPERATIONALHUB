import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor, registerPlugin } from "@capacitor/core";

import {
  API_BASE_URL,
  APP_HOME_URL,
  createNativeGmailStart,
  loginWithSupabaseToken,
} from "./api";
import {
  isSupabaseAuthConfigured,
  supabase,
  SUPABASE_LOCAL_REDIRECT_URL,
  SUPABASE_NATIVE_REDIRECT_URL,
  SUPABASE_WEB_REDIRECT_URL,
} from "./supabaseClient";

const GOOGLE_LOGIN_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");
const GOOGLE_PROVIDER_AUTH_STORAGE_KEY = "eva_google_provider_auth";
const AuthBrowser = registerPlugin("AuthBrowser");

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return cleanString(value).toLowerCase();
}

function getProviderExpiry(providerAuth = {}) {
  const parsedExpiresAt = Number.parseInt(providerAuth.tokenExpiresAt, 10);

  if (!Number.isNaN(parsedExpiresAt) && parsedExpiresAt > 0) {
    return parsedExpiresAt < 1000000000000
      ? parsedExpiresAt * 1000
      : parsedExpiresAt;
  }

  const parsedExpiresIn = Number.parseInt(providerAuth.tokenExpiresIn, 10);

  if (!Number.isNaN(parsedExpiresIn) && parsedExpiresIn > 0) {
    return Date.now() + parsedExpiresIn * 1000;
  }

  return null;
}

function normalizeGoogleProviderAuth(providerAuth = {}, email = "") {
  const providerToken = cleanString(providerAuth.providerToken);
  const providerRefreshToken = cleanString(providerAuth.providerRefreshToken);
  const providerScope =
    cleanString(providerAuth.providerScope) ||
    (providerToken || providerRefreshToken ? GOOGLE_LOGIN_SCOPES : "");
  const tokenExpiresAt = getProviderExpiry(providerAuth);

  if (!providerToken && !providerRefreshToken) {
    return null;
  }

  return {
    ...(email ? { email: normalizeEmail(email) } : {}),
    ...(providerToken ? { providerToken } : {}),
    ...(providerRefreshToken ? { providerRefreshToken } : {}),
    ...(providerScope ? { providerScope } : {}),
    ...(tokenExpiresAt ? { tokenExpiresAt: String(tokenExpiresAt) } : {}),
  };
}

function hasGmailProviderScope(providerAuth) {
  return cleanString(providerAuth?.providerScope)
    .split(/\s+/)
    .includes("https://www.googleapis.com/auth/gmail.readonly");
}

function readStoredGoogleProviderAuth(expectedEmail = "") {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(GOOGLE_PROVIDER_AUTH_STORAGE_KEY) || "null"
    );
    const storedEmail = normalizeEmail(stored?.email);
    const finalExpectedEmail = normalizeEmail(expectedEmail);

    if (finalExpectedEmail && storedEmail !== finalExpectedEmail) {
      return null;
    }

    return normalizeGoogleProviderAuth(stored, storedEmail);
  } catch {
    return null;
  }
}

function writeStoredGoogleProviderAuth(providerAuth, email = "") {
  if (
    typeof window === "undefined" ||
    !window.localStorage ||
    !hasGmailProviderScope(providerAuth)
  ) {
    return;
  }

  const nextProviderAuth = normalizeGoogleProviderAuth(providerAuth, email);

  if (!nextProviderAuth) {
    return;
  }

  try {
    window.localStorage.setItem(
      GOOGLE_PROVIDER_AUTH_STORAGE_KEY,
      JSON.stringify(nextProviderAuth)
    );
  } catch {
    // Local persistence is best-effort; the app can still use the live session.
  }
}

function clearStoredGoogleProviderAuth() {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(GOOGLE_PROVIDER_AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function ensureHttpAuthUrl(url) {
  const parsedUrl = new URL(url);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Google sign-in returned an invalid browser URL.");
  }

  return parsedUrl.href;
}

async function openNativeAuthUrl(url) {
  const safeUrl = ensureHttpAuthUrl(url);

  await AuthBrowser.open({ url: safeUrl });
}

function ensureSupabaseAuth() {
  if (!isSupabaseAuthConfigured || !supabase) {
    throw new Error(
      "Supabase auth is missing VITE_SUPABASE_ANON_KEY. Add your Supabase anon or publishable key to .env.local and Vercel."
    );
  }
}

function getOAuthRedirectUrl() {
  if (Capacitor.isNativePlatform()) {
    return SUPABASE_NATIVE_REDIRECT_URL;
  }

  return import.meta.env.DEV
    ? SUPABASE_LOCAL_REDIRECT_URL
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
    providerRefreshToken:
      searchParams.get("provider_refresh_token") ||
      hashParams.get("provider_refresh_token"),
    providerScope:
      searchParams.get("scope") ||
      hashParams.get("scope") ||
      (searchParams.get("provider_token") || hashParams.get("provider_token")
        ? GOOGLE_LOGIN_SCOPES
        : ""),
    providerToken:
      searchParams.get("provider_token") || hashParams.get("provider_token"),
    refreshToken:
      searchParams.get("refresh_token") || hashParams.get("refresh_token"),
    tokenExpiresAt:
      searchParams.get("expires_at") || hashParams.get("expires_at"),
    tokenExpiresIn:
      searchParams.get("expires_in") || hashParams.get("expires_in"),
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
      parsedUrl.protocol === "capacitor:" &&
      parsedUrl.host === "localhost" &&
      parsedUrl.pathname.startsWith("/auth/callback");
    const isWebReturn =
      parsedUrl.href.startsWith(SUPABASE_WEB_REDIRECT_URL) ||
      parsedUrl.href.startsWith(SUPABASE_LOCAL_REDIRECT_URL);

    return isNativeReturn || isWebReturn || hasAuthParams(url);
  } catch {
    return false;
  }
}

function cleanCurrentUrl() {
  if (typeof window === "undefined" || !window.history?.replaceState) {
    return;
  }

  window.history.replaceState({}, document.title, "/");
}

async function syncAppSessionFromSupabase(providerAuth = {}) {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    return null;
  }

  const sessionEmail = normalizeEmail(data.session?.user?.email);
  const freshProviderAuth = normalizeGoogleProviderAuth(
    providerAuth,
    sessionEmail
  );
  const sessionProviderAuth = normalizeGoogleProviderAuth(
    {
      providerRefreshToken: data.session.provider_refresh_token,
      providerScope: freshProviderAuth?.providerScope,
      providerToken: data.session.provider_token,
    },
    sessionEmail
  );
  const storedProviderAuth = readStoredGoogleProviderAuth(sessionEmail);
  const liveProviderAuth = freshProviderAuth || sessionProviderAuth;
  const googleProviderAuth = liveProviderAuth || storedProviderAuth || {};
  const result = await loginWithSupabaseToken(accessToken, {
    googleProviderExpiresAt: googleProviderAuth.tokenExpiresAt,
    googleProviderRefreshToken:
      googleProviderAuth.providerRefreshToken,
    googleProviderScope: googleProviderAuth.providerScope,
    googleProviderToken: googleProviderAuth.providerToken,
  });

  if (!result.ok) {
    throw new Error(result.error || "Could not finish Google sign-in.");
  }

  if (result.gmailConnected && liveProviderAuth) {
    writeStoredGoogleProviderAuth(liveProviderAuth, sessionEmail);
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
      queryParams: {
        access_type: "offline",
        prompt: "consent select_account",
      },
      redirectTo,
      scopes: GOOGLE_LOGIN_SCOPES,
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

    await openNativeAuthUrl(data.url);
  }

  return data;
}

export async function completeSupabaseAuthFromUrl(url) {
  ensureSupabaseAuth();

  if (!url || !isOAuthReturnUrl(url)) {
    return null;
  }

  const authParams = readAuthParams(url);
  const { accessToken, code, error, errorDescription, refreshToken } =
    authParams;

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

  return syncAppSessionFromSupabase(authParams);
}

export async function registerOAuthDeepLinkHandler(onUser, onAppReturn) {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  async function handleUrl(url) {
    let parsedUrl;

    try {
      parsedUrl = new URL(url);
    } catch {
      return;
    }

    if (!isOAuthReturnUrl(url)) {
      const isNativeAppReturn =
        parsedUrl.protocol === "capacitor:" &&
        parsedUrl.host === "localhost";

      if (isNativeAppReturn) {
        await Browser.close().catch(() => {});
        onAppReturn?.(parsedUrl);
      }

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

export async function signOutSupabaseAuth() {
  if (!isSupabaseAuthConfigured || !supabase) {
    clearStoredGoogleProviderAuth();
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  clearStoredGoogleProviderAuth();
}

export async function connectGmailWithGoogle() {
  const returnTo = `${APP_HOME_URL}/?view=emails&gmail=connected`;
  const params = new URLSearchParams({ returnTo });

  if (Capacitor.isNativePlatform()) {
    const data = await createNativeGmailStart(returnTo);

    if (!data.ok || !data.authPath) {
      throw new Error(data.error || "Could not start Gmail connection.");
    }

    await openNativeAuthUrl(`${API_BASE_URL}${data.authPath}`);
    return;
  }

  const url = `${API_BASE_URL}/auth/gmail?${params.toString()}`;

  window.location.assign(url);
}
