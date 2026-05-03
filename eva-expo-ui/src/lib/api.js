import { API_BASE_URL, TRANSCRIPTION_WS_URL } from "../config";
import { requireSupabase, supabase } from "./supabase";

const DEFAULT_TIMEOUT_MS = 15000;

async function getAccessToken() {
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token || null;
}

function isBlobBody(value) {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

async function parseJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text || response.statusText };
  }
}

export async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs || DEFAULT_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        ...(options.body && !isBlobBody(options.body)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body && !isBlobBody(options.body) ? JSON.stringify(options.body) : options.body,
      signal: controller.signal,
    });
    const data = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || data.reply || "Request failed.");
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The request timed out. Please check your connection.", {
        cause: error,
      });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncBackendSession(accessToken) {
  const finalAccessToken = accessToken || (await getAccessToken());

  if (!finalAccessToken) {
    return null;
  }

  return apiFetch("/api/auth/supabase", {
    method: "POST",
    body: { accessToken: finalAccessToken },
  });
}

export async function signInWithEmail(email, password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw error;
  }

  if (data.session?.access_token) {
    await syncBackendSession(data.session.access_token);
  }

  return data;
}

export async function signUpWithEmail(email, password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) {
    throw error;
  }

  if (data.session?.access_token) {
    await syncBackendSession(data.session.access_token);
  }

  return data;
}

export function sendAssistantChat(messages) {
  return apiFetch("/api/assistant/chat", {
    method: "POST",
    body: { messages },
    timeoutMs: 30000,
  });
}

export function getCalendarEvents() {
  return apiFetch("/api/calendar-events");
}

export function getOperations() {
  return apiFetch("/api/operations");
}

export function getTasks() {
  return apiFetch("/api/tasks");
}

export function getTranscripts() {
  return apiFetch("/api/transcripts");
}

export function createTranscriptionSession(sampleRate = 44100) {
  return apiFetch("/api/transcription-sessions", {
    method: "POST",
    body: { sampleRate },
  });
}

export async function uploadTranscriptAudio(blob, contentType = "audio/m4a") {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/transcription-upload`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: blob,
      signal: controller.signal,
    });
    const data = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "Could not transcribe audio.");
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Transcription timed out. Please try a shorter recording.", {
        cause: error,
      });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export { TRANSCRIPTION_WS_URL };
