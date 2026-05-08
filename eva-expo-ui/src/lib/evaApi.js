import * as FileSystem from "expo-file-system/legacy";

const DEFAULT_API_BASE_URL = "https://ad-operationalhub.onrender.com";

export const API_BASE_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
);

let accessToken = "";

export function setEvaAccessToken(token) {
  accessToken = String(token || "");
}

export function hasEvaAccessToken() {
  return Boolean(accessToken);
}

async function requestEva(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs || 10000
  );

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("EVA backend request timed out.", { cause: error });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  const data = text ? safeJson(text) : {};

  if (!response.ok) {
    const error = new Error(data.error || response.statusText || "EVA request failed.");
    error.status = response.status;
    throw error;
  }

  return data;
}

export function getEvaBootstrap() {
  return requestEva("/api/eva/bootstrap");
}

export function createEvaTask(task) {
  return requestEva("/api/eva/tasks", {
    method: "POST",
    body: toEvaTaskPayload(task),
  });
}

export function updateEvaTask(id, updates) {
  return requestEva(`/api/eva/tasks/${id}`, {
    method: "PATCH",
    body: toEvaTaskPayload(updates),
  });
}

export function createEvaMeeting(meeting) {
  return requestEva("/api/eva/meetings", {
    method: "POST",
    body: toEvaMeetingPayload(meeting),
  });
}

export function updateEvaMeeting(id, updates) {
  return requestEva(`/api/eva/meetings/${id}`, {
    method: "PATCH",
    body: toEvaMeetingPayload(updates),
  });
}

export function createEvaReminder(reminder) {
  return requestEva("/api/eva/reminders", {
    method: "POST",
    body: toEvaReminderPayload(reminder),
  });
}

export function createEvaDocument(document) {
  return requestEva("/api/eva/documents", {
    method: "POST",
    body: toEvaDocumentPayload(document),
  });
}

export function saveEvaPreferences(preferences) {
  return requestEva("/api/eva/preferences", {
    method: "PUT",
    body: preferences,
  });
}

export function sendEvaAssistantChat(messages, threadId) {
  return requestEva("/api/eva/assistant/chat", {
    method: "POST",
    body: {
      thread_id: threadId || null,
      messages,
    },
  });
}

export function sendEvaAssistantCommand({ userMessage, context, messages }) {
  const safeContext = context || {};
  const recentChatHistory = Array.isArray(messages) ? messages : [];

  return requestEva("/api/eva/assistant", {
    method: "POST",
    timeoutMs: 15000,
    body: {
      userMessage,
      context: safeContext,
      tasks: Array.isArray(safeContext.tasks) ? safeContext.tasks : [],
      meetings: Array.isArray(safeContext.meetings) ? safeContext.meetings : [],
      reminders: Array.isArray(safeContext.reminders) ? safeContext.reminders : [],
      appMode: safeContext.mode,
      appStatus: safeContext.appStatus,
      recentChatHistory,
      messages: recentChatHistory,
    },
  });
}

export async function streamEvaAssistantCommand({ userMessage, context, messages }, onSentence, onDone) {
  const safeContext = context || {};
  const recentChatHistory = Array.isArray(messages) ? messages : [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/eva/assistant/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        userMessage,
        context: safeContext,
        tasks: Array.isArray(safeContext.tasks) ? safeContext.tasks : [],
        meetings: Array.isArray(safeContext.meetings) ? safeContext.meetings : [],
        reminders: Array.isArray(safeContext.reminders) ? safeContext.reminders : [],
        appMode: safeContext.mode,
        appStatus: safeContext.appStatus,
        recentChatHistory,
        messages: recentChatHistory,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") {
      throw new Error("EVA voice stream timed out.", { cause: error });
    }
    throw error;
  }

  if (!response.ok) {
    clearTimeout(timeoutId);
    const errText = await response.text().catch(() => "");
    const errData = errText ? safeJson(errText) : {};
    const error = new Error(errData?.error || "EVA stream request failed.");
    error.status = response.status;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let partial = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      partial += decoder.decode(value, { stream: true });
      const lines = partial.split("\n");
      partial = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        const event = safeJson(jsonStr);
        if (!event) continue;

        if (event.type === "sentence" && event.text) {
          onSentence(event.text);
        } else if (event.type === "done") {
          await onDone(event.structured, event.fullText);
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
    reader.releaseLock();
  }
}

export async function transcribeEvaAudio(uri, options = {}) {
  const audioUri = String(uri || "").trim();
  if (!audioUri) {
    throw new Error("No voice recording was captured.");
  }

  const uploadResult = await FileSystem.uploadAsync(
    `${API_BASE_URL}/api/eva/transcribe`,
    audioUri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        "Content-Type": options.mimeType || "audio/m4a",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    }
  );
  const data = uploadResult?.body ? safeJson(uploadResult.body) : {};
  const status = Number(uploadResult?.status || 0);

  if (status < 200 || status >= 300) {
    const error = new Error(data.error || "Voice transcription failed.");
    error.status = status;
    throw error;
  }

  return data;
}

export function mapEvaTask(row) {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail || "",
    priority: displayPriority(row.priority),
    status: displayTaskStatus(row.status),
    due: row.metadata?.dueLabel || formatDisplayDate(row.due_at) || "Today",
  };
}

export function mapEvaMeeting(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.metadata?.dateLabel || formatDisplayDate(row.starts_at) || "Today",
    time: row.metadata?.timeLabel || formatDisplayTime(row.starts_at) || "10:00 AM",
    attendees: Array.isArray(row.attendees) ? row.attendees.join(", ") : "Team",
    briefing: row.briefing || "EVA will prepare context before the meeting.",
    reminder: `${row.reminder_minutes_before || 15} minutes before`,
  };
}

export function mapEvaReminder(row) {
  return {
    id: row.id,
    title: row.title,
    due: row.metadata?.dueLabel || formatDisplayDate(row.remind_at) || "Today",
  };
}

export function mapEvaDocument(row) {
  return {
    id: row.id,
    title: row.title,
    type: displayDocumentType(row.type),
    updatedAt: formatDisplayDate(row.updated_at || row.created_at) || "Just now",
    content: row.content || "",
    summary: row.summary || "EVA will use this knowledge for future briefings.",
  };
}

function toEvaTaskPayload(task) {
  const status = task.status || task.statusLabel;

  return compactObject({
    title: task.title,
    detail: task.detail,
    priority: databasePriority(task.priority),
    status: databaseTaskStatus(status),
    due_at: task.due_at || null,
    completed_at: status === "Done" || status === "done" ? new Date().toISOString() : null,
    metadata: compactObject({
      dueLabel: task.due,
    }),
  });
}

function toEvaMeetingPayload(meeting) {
  return compactObject({
    title: meeting.title,
    starts_at: meeting.starts_at || null,
    ends_at: meeting.ends_at || null,
    timezone: meeting.timezone || "Africa/Lagos",
    location: meeting.location || "",
    attendees: parseAttendees(meeting.attendees),
    briefing: meeting.briefing,
    status: meeting.status || "scheduled",
    reminder_minutes_before: parseReminderMinutes(meeting.reminder),
    notes: meeting.notes || "",
    metadata: compactObject({
      dateLabel: meeting.date,
      timeLabel: meeting.time,
    }),
  });
}

function toEvaReminderPayload(reminder) {
  return compactObject({
    title: reminder.title,
    remind_at: reminder.remind_at || null,
    status: reminder.status || "pending",
    metadata: compactObject({
      dueLabel: reminder.due,
    }),
  });
}

function toEvaDocumentPayload(document) {
  return compactObject({
    title: document.title,
    type: databaseDocumentType(document.type),
    content: document.content,
    summary: document.summary,
    tags: document.tags || [],
    metadata: document.metadata || {},
  });
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { error: "Server error" };
  }
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

function displayPriority(value) {
  const priority = String(value || "").toLowerCase();
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}

function databasePriority(value) {
  const priority = String(value || "").toLowerCase();
  if (priority === "high") return "high";
  if (priority === "low") return "low";
  return "medium";
}

function displayTaskStatus(value) {
  const status = String(value || "").toLowerCase();
  if (status === "done") return "Done";
  if (status === "in_progress") return "In progress";
  return "To do";
}

function databaseTaskStatus(value) {
  const status = String(value || "").toLowerCase();
  if (status === "done") return "done";
  if (status.includes("progress")) return "in_progress";
  return "todo";
}

function displayDocumentType(value) {
  const type = String(value || "").toLowerCase();
  if (type === "transcript") return "Transcript";
  if (type === "briefing") return "Briefing";
  return "Note";
}

function databaseDocumentType(value) {
  const type = String(value || "").toLowerCase();
  if (type === "transcript") return "transcript";
  if (type === "briefing") return "briefing";
  return "note";
}

function parseAttendees(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseReminderMinutes(value) {
  const match = String(value || "").match(/(\d+)/);
  return match ? Number(match[1]) : 15;
}

function formatDisplayDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatDisplayTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
