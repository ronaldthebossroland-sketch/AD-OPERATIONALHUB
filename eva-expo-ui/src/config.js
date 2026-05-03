function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

export const API_BASE_URL = stripTrailingSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL ||
    "https://ad-operationalhub.onrender.com"
);

export const TRANSCRIPTION_WS_URL = (() => {
  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/transcribe";
  url.search = "";
  url.hash = "";
  return stripTrailingSlash(url.toString());
})();

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://fwoisysufauefhsrrxgr.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
