import { createClient } from "@supabase/supabase-js";

// Cookie-based storage so the PKCE code verifier survives cross-origin navigation
// in browsers (e.g. Samsung Internet) that isolate localStorage across site boundaries.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const CHUNK = 3500; // stay under 4 KB per cookie

function readCookie(name) {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(name)}=`;
  for (const part of document.cookie.split(";")) {
    const t = part.trim();
    if (t.startsWith(prefix))
      return decodeURIComponent(t.slice(prefix.length));
  }
  return null;
}

function writeCookie(name, value) {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; SameSite=Lax; max-age=${COOKIE_MAX_AGE}`;
}

function deleteCookie(name) {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0`;
}

const cookieStorage = {
  getItem(key) {
    const v = readCookie(key);
    if (v !== null) return v;
    const c0 = readCookie(`${key}__0`);
    if (c0 === null) return null;
    let out = c0;
    for (let i = 1; i < 20; i++) {
      const c = readCookie(`${key}__${i}`);
      if (c === null) break;
      out += c;
    }
    return out;
  },
  setItem(key, value) {
    deleteCookie(key);
    for (let i = 0; i < 20; i++) deleteCookie(`${key}__${i}`);
    if (value.length <= CHUNK) {
      writeCookie(key, value);
    } else {
      for (let i = 0; i * CHUNK < value.length; i++)
        writeCookie(`${key}__${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
  },
  removeItem(key) {
    deleteCookie(key);
    for (let i = 0; i < 20; i++) deleteCookie(`${key}__${i}`);
  },
};

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
        detectSessionInUrl: true,
        flowType: "pkce",
        persistSession: true,
        storage: cookieStorage,
      },
    })
  : null;
