function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function getBrowserOrigin() {
  if (typeof window === "undefined") {
    return "http://localhost:5173";
  }

  return window.location.origin;
}

function getApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL;

  if (typeof configuredUrl === "string") {
    return trimTrailingSlash(configuredUrl);
  }

  return "http://localhost:5000";
}

export const API_BASE_URL = getApiBaseUrl();
export const APP_HOME_URL = trimTrailingSlash(
  import.meta.env.VITE_APP_HOME_URL || getBrowserOrigin()
);
export const GOOGLE_AUTH_URL = `${API_BASE_URL}/auth/google`;
export const TRANSCRIPTION_WS_URL = (() => {
  const configuredUrl = import.meta.env.VITE_TRANSCRIPTION_WS_URL;

  if (typeof configuredUrl === "string" && configuredUrl.trim()) {
    return trimTrailingSlash(configuredUrl);
  }

  const apiUrl = new URL(API_BASE_URL || APP_HOME_URL, APP_HOME_URL);
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  apiUrl.pathname = "/ws/transcribe";
  apiUrl.search = "";
  apiUrl.hash = "";

  return trimTrailingSlash(apiUrl.toString());
})();

async function parseResponseJson(res) {
  const text = await res.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text || res.statusText };
  }
}

async function requestJson(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await parseResponseJson(res);
  return { ok: res.ok, status: res.status, ...data };
}

export async function askAI(message) {
  const data = await requestJson("/api/ai", {
    method: "POST",
    body: JSON.stringify({ message }),
  });

  return data.reply || data.error || "No AI response received.";
}

export function runAICommand(command) {
  return requestJson("/api/command", {
    method: "POST",
    body: JSON.stringify({ command }),
  });
}

export function generateDailyBriefing() {
  return requestJson("/api/daily-briefing", {
    method: "POST",
  });
}

export function askHub(question) {
  return requestJson("/api/ask-hub", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

export function getCommandLogs() {
  return requestJson("/api/command-logs");
}

export function getCalendarEvents() {
  return requestJson("/api/calendar-events");
}

export function createCalendarEvent(event) {
  return requestJson("/api/calendar-events", {
    method: "POST",
    body: JSON.stringify(event),
  });
}

export function updateCalendarEvent(id, updates) {
  return requestJson(`/api/calendar-events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteCalendarEvent(id) {
  return requestJson(`/api/calendar-events/${id}`, {
    method: "DELETE",
  });
}

export function runScheduleAssistant(command) {
  return requestJson("/api/calendar/assistant", {
    method: "POST",
    body: JSON.stringify({ command }),
  });
}

export function getApprovals() {
  return requestJson("/api/approvals");
}

export function createApproval(approval) {
  return requestJson("/api/approvals", {
    method: "POST",
    body: JSON.stringify(approval),
  });
}

export function updateApproval(source, id, updates) {
  return requestJson(`/api/approvals/${source}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function getGmailStatus() {
  return requestJson("/api/gmail/status");
}

export function getGmailEmails() {
  return requestJson("/api/gmail/emails");
}

export function getEmailDrafts() {
  return requestJson("/api/email-drafts");
}

export function createEmailDraft(draft) {
  return requestJson("/api/email-drafts", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export function sendGmailMessage(message) {
  return requestJson("/api/gmail/send", {
    method: "POST",
    body: JSON.stringify(message),
  });
}

export function getCurrentUser() {
  return requestJson("/api/auth/me");
}

export function loginUser(credentials) {
  return requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function signupUser(account) {
  return requestJson("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(account),
  });
}

export function getUsers() {
  return requestJson("/api/users");
}

export function createUser(user) {
  return requestJson("/api/users", {
    method: "POST",
    body: JSON.stringify(user),
  });
}

export function deleteUser(id) {
  return requestJson(`/api/users/${id}`, {
    method: "DELETE",
  });
}

export function logoutUser() {
  return requestJson("/api/auth/logout", {
    method: "POST",
  });
}

export function loginWithKingsChat(tokens) {
  return requestJson("/api/auth/kingschat", {
    method: "POST",
    body: JSON.stringify(tokens),
  });
}

export function getMeetings() {
  return requestJson("/api/meetings");
}

export function createMeeting(meeting) {
  return requestJson("/api/meetings", {
    method: "POST",
    body: JSON.stringify(meeting),
  });
}

export function updateMeeting(id, updates) {
  return requestJson(`/api/meetings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteMeeting(id) {
  return requestJson(`/api/meetings/${id}`, {
    method: "DELETE",
  });
}

export function getAlerts() {
  return requestJson("/api/alerts");
}

export function createAlert(alert) {
  return requestJson("/api/alerts", {
    method: "POST",
    body: JSON.stringify(alert),
  });
}

export function updateAlert(id, updates) {
  return requestJson(`/api/alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteAlert(id) {
  return requestJson(`/api/alerts/${id}`, {
    method: "DELETE",
  });
}

export function getAlarms() {
  return requestJson("/api/alarms");
}

export function deleteAlarm(id) {
  return requestJson(`/api/alarms/${id}`, {
    method: "DELETE",
  });
}

export function updateAlarm(id, updates) {
  return requestJson(`/api/alarms/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function getTasks() {
  return requestJson("/api/tasks");
}

export function createTask(task) {
  return requestJson("/api/tasks", {
    method: "POST",
    body: JSON.stringify(task),
  });
}

export function updateTask(id, updates) {
  return requestJson(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteTask(id) {
  return requestJson(`/api/tasks/${id}`, {
    method: "DELETE",
  });
}

export function getProjects() {
  return requestJson("/api/projects");
}

export function createProject(project) {
  return requestJson("/api/projects", {
    method: "POST",
    body: JSON.stringify(project),
  });
}

export function updateProject(id, updates) {
  return requestJson(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteProject(id) {
  return requestJson(`/api/projects/${id}`, {
    method: "DELETE",
  });
}

export function getPartners() {
  return requestJson("/api/partners");
}

export function createPartner(partner) {
  return requestJson("/api/partners", {
    method: "POST",
    body: JSON.stringify(partner),
  });
}

export function updatePartner(id, updates) {
  return requestJson(`/api/partners/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deletePartner(id) {
  return requestJson(`/api/partners/${id}`, {
    method: "DELETE",
  });
}

export function getPartnerTimeline(partnerId) {
  return requestJson(`/api/partners/${partnerId}/timeline`);
}

export function createPartnerTimelineItem(partnerId, item) {
  return requestJson(`/api/partners/${partnerId}/timeline`, {
    method: "POST",
    body: JSON.stringify(item),
  });
}

export function deletePartnerTimelineItem(partnerId, id) {
  return requestJson(`/api/partners/${partnerId}/timeline/${id}`, {
    method: "DELETE",
  });
}

export function getActivities() {
  return requestJson("/api/activities");
}

export function createActivity(activity) {
  return requestJson("/api/activities", {
    method: "POST",
    body: JSON.stringify(activity),
  });
}

export function updateActivity(id, updates) {
  return requestJson(`/api/activities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteActivity(id) {
  return requestJson(`/api/activities/${id}`, {
    method: "DELETE",
  });
}

export function getOperations() {
  return requestJson("/api/operations");
}

export function createOperation(operation) {
  return requestJson("/api/operations", {
    method: "POST",
    body: JSON.stringify(operation),
  });
}

export function updateOperation(id, updates) {
  return requestJson(`/api/operations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteOperation(id) {
  return requestJson(`/api/operations/${id}`, {
    method: "DELETE",
  });
}

export function getTranscripts() {
  return requestJson("/api/transcripts");
}

export function createTranscript(transcript) {
  return requestJson("/api/transcripts", {
    method: "POST",
    body: JSON.stringify(transcript),
  });
}

export function updateTranscript(id, transcript) {
  return requestJson(`/api/transcripts/${id}`, {
    method: "PUT",
    body: JSON.stringify(transcript),
  });
}

export function extractTranscriptActions(id) {
  return requestJson(`/api/transcripts/${id}/extract-actions`, {
    method: "POST",
  });
}

export function createTranscriptionSession(sampleRate) {
  return requestJson("/api/transcription-sessions", {
    method: "POST",
    body: JSON.stringify({ sampleRate }),
  });
}
