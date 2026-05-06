import { isSupabaseConfigured, supabase, supabaseStatusMessage } from "./supabase";

const APP_SOURCE = "eva";
const EVA_CLEAN_DATA_CUTOFF = "2026-05-04T00:00:00.000Z";
const INTERNAL_TEST_TITLE = "codex persistence verification";
const ASSISTANT_CHAT_TITLE_PREFIX = "EVA conversation";

export { isSupabaseConfigured as isEvaSupabaseConfigured, supabaseStatusMessage };

export async function loadEvaSupabaseData(userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);

  const [tasksResult, meetingsResult, remindersResult, documentsResult, preferencesResult] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("app_source", APP_SOURCE)
        .eq("user_id", activeUserId)
        .gte("created_at", EVA_CLEAN_DATA_CUTOFF)
        .order("created_at", { ascending: false }),
      supabase
        .from("meetings")
        .select("*")
        .eq("app_source", APP_SOURCE)
        .eq("user_id", activeUserId)
        .gte("created_at", EVA_CLEAN_DATA_CUTOFF)
        .order("created_at", { ascending: false }),
      supabase
        .from("reminders")
        .select("*")
        .eq("app_source", APP_SOURCE)
        .eq("user_id", activeUserId)
        .gte("created_at", EVA_CLEAN_DATA_CUTOFF)
        .order("created_at", { ascending: false }),
      supabase
        .from("documents")
        .select("*")
        .eq("app_source", APP_SOURCE)
        .eq("user_id", activeUserId)
        .gte("created_at", EVA_CLEAN_DATA_CUTOFF)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_preferences")
        .select("*")
        .eq("app_source", APP_SOURCE)
        .eq("user_id", activeUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  throwIfError(tasksResult.error);
  throwIfError(meetingsResult.error);
  throwIfError(remindersResult.error);
  throwIfError(documentsResult.error);
  throwIfError(preferencesResult.error);

  const [chat, profile] = await Promise.all([
    loadLatestAssistantChat(activeUserId),
    loadLatestProfile(activeUserId),
  ]);

  return {
    tasks: (tasksResult.data || []).filter(isVisibleEvaTask).map(mapSupabaseTask),
    meetings: (meetingsResult.data || []).filter(isVisibleEvaRecord).map(mapSupabaseMeeting),
    reminders: (remindersResult.data || []).filter(isVisibleEvaRecord).map(mapSupabaseReminder),
    documents: (documentsResult.data || []).filter(isVisibleEvaRecord).map(mapSupabaseDocument),
    preferences: mapSupabasePreferences(preferencesResult.data),
    profile,
    chat,
  };
}

export async function createSupabaseTask(task, userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);
  const { data, error } = await supabase
    .from("tasks")
    .insert(withUserId(taskPayload(task), activeUserId))
    .select()
    .single();

  throwIfError(error);
  return mapSupabaseTask(data);
}

export async function updateSupabaseTask(id, patch, userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);
  const { data, error } = await supabase
    .from("tasks")
    .update(taskPayload(patch))
    .eq("id", id)
    .eq("app_source", APP_SOURCE)
    .eq("user_id", activeUserId)
    .select()
    .single();

  throwIfError(error);
  return mapSupabaseTask(data);
}

export async function createSupabaseMeeting(meeting, userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);
  const payload = withUserId(meetingPayload(meeting), activeUserId);
  let { data, error } = await supabase
    .from("meetings")
    .insert(payload)
    .select()
    .single();

  if (isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from("meetings")
      .insert(stripMeetingSyncPayload(payload))
      .select()
      .single());
  }

  throwIfError(error);
  return mapSupabaseMeeting(data);
}

export async function updateSupabaseMeeting(id, patch, userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);
  const payload = meetingPayload(patch);
  let { data, error } = await supabase
    .from("meetings")
    .update(payload)
    .eq("id", id)
    .eq("app_source", APP_SOURCE)
    .eq("user_id", activeUserId)
    .select()
    .single();

  if (isMissingColumnError(error)) {
    const fallbackPayload = stripMeetingSyncPayload(payload);
    if (!Object.keys(fallbackPayload).length) {
      return null;
    }

    ({ data, error } = await supabase
      .from("meetings")
      .update(fallbackPayload)
      .eq("id", id)
      .eq("app_source", APP_SOURCE)
      .eq("user_id", activeUserId)
      .select()
      .single());
  }

  throwIfError(error);
  return mapSupabaseMeeting(data);
}

export async function deleteSupabaseMeeting(id, userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);
  const { error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", id)
    .eq("app_source", APP_SOURCE)
    .eq("user_id", activeUserId);

  throwIfError(error);
}

export async function createSupabaseReminder(reminder, userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);
  const { data, error } = await supabase
    .from("reminders")
    .insert(withUserId(reminderPayload(reminder), activeUserId))
    .select()
    .single();

  throwIfError(error);
  return mapSupabaseReminder(data);
}

export async function createSupabaseDocument(document, userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);
  const { data, error } = await supabase
    .from("documents")
    .insert(withUserId(documentPayload(document), activeUserId))
    .select()
    .single();

  throwIfError(error);
  return mapSupabaseDocument(data);
}

export async function saveSupabasePreferences(preferences, userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);

  const payload = withUserId(preferencesPayload(preferences), activeUserId);
  let fallbackPayload = payload;
  let result = await upsertPreferencesPayload(fallbackPayload, activeUserId);
  let attempts = 0;

  while (isMissingColumnError(result.error) && attempts < 4) {
    fallbackPayload = stripMissingPreferencePayload(fallbackPayload, result.error);
    result = await upsertPreferencesPayload(fallbackPayload, activeUserId);
    attempts += 1;
  }

  throwIfError(result.error);
  return mapSupabasePreferences({
    ...result.data,
    appearance_mode: payload.appearance_mode,
    voice_mode: payload.voice_mode,
    ai_behavior: payload.ai_behavior,
    notification_enabled: payload.notification_enabled,
    calendar_sync_enabled: payload.calendar_sync_enabled,
    default_meeting_reminder_minutes: payload.default_meeting_reminder_minutes,
  });
}

export async function saveSupabaseProfile(profile, userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);

  const payload = withUserId(profilePayload(profile), activeUserId);
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id")
    .eq("app_source", APP_SOURCE)
    .eq("user_id", activeUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  throwIfError(existingError);

  const request = existing?.id
    ? supabase
        .from("profiles")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", activeUserId)
        .select()
        .single()
    : supabase.from("profiles").insert(payload).select().single();

  const { data, error } = await request;
  throwIfError(error);
  return mapSupabaseProfile(data);
}

async function upsertPreferencesPayload(payload, userId) {
  const { data: existing, error: existingError } = await supabase
    .from("user_preferences")
    .select("id")
    .eq("app_source", APP_SOURCE)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  throwIfError(existingError);

  const request = existing?.id
    ? supabase
        .from("user_preferences")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select()
        .single()
    : supabase.from("user_preferences").insert(payload).select().single();

  return request;
}

export async function createSupabaseChatMessages(messages, chatId, userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);

  const activeChatId = await getOrCreateAssistantChatId(chatId, activeUserId);
  const title = getTodayAssistantChatTitle();
  const rows = messages
    .filter((message) => message?.content)
    .map((message) =>
      withUserId(assistantMessagePayload(activeChatId, message), activeUserId)
    );

  if (!rows.length) {
    return { chatId: activeChatId, messages: [] };
  }

  const { data, error } = await supabase
    .from("assistant_messages")
    .insert(rows)
    .select();

  throwIfError(error);

  await supabase
    .from("assistant_chats")
    .update({ title })
    .eq("id", activeChatId)
    .eq("app_source", APP_SOURCE)
    .eq("user_id", activeUserId);

  return {
    chatId: activeChatId,
    messages: (data || []).map(mapSupabaseAssistantMessage),
  };
}

function ensureSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(supabaseStatusMessage);
  }
}

function throwIfError(error) {
  if (error) {
    throw error;
  }
}

function requireUserId(userId) {
  const value = String(userId || "").trim();
  if (!value) {
    throw new Error("A signed-in Supabase user is required.");
  }
  return value;
}

function withUserId(payload, userId) {
  return {
    ...payload,
    user_id: userId,
  };
}

function isMissingColumnError(error) {
  const text = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return text.includes("could not find the") && text.includes("column");
}

function stripMissingPreferencePayload(payload, error) {
  const missingColumn = getMissingColumnName(error);
  const fallbackPayload = { ...payload };

  if (missingColumn && missingColumn !== "user_id") {
    delete fallbackPayload[missingColumn];
    return fallbackPayload;
  }

  delete fallbackPayload.ai_behavior;
  delete fallbackPayload.calendar_sync_enabled;
  delete fallbackPayload.default_meeting_reminder_minutes;
  return fallbackPayload;
}

function getMissingColumnName(error) {
  const text = `${error?.message || ""} ${error?.details || ""}`;
  const match =
    text.match(/Could not find the '([^']+)' column/i) ||
    text.match(/column "([^"]+)" does not exist/i) ||
    text.match(/'([^']+)' column/i);

  return match?.[1] || "";
}

function taskPayload(task = {}) {
  const payload = {
    app_source: APP_SOURCE,
  };

  if (task.title !== undefined) {
    payload.title = task.title || "New executive task";
  }
  if (task.detail !== undefined || task.details !== undefined) {
    payload.details = task.detail || task.details || "";
  }
  if (task.priority !== undefined) {
    payload.priority = normalizePriority(task.priority);
  }
  if (task.status !== undefined) {
    payload.status = normalizeTaskStatus(task.status);
  }
  if (task.due !== undefined || task.due_date !== undefined) {
    payload.due_date = task.due || task.due_date || "";
  }
  if (task.owner !== undefined) {
    payload.owner = task.owner || "";
  }

  return payload;
}

function meetingPayload(meeting = {}) {
  const payload = {
    app_source: APP_SOURCE,
  };

  if (meeting.title !== undefined) {
    payload.title = meeting.title || "Executive meeting";
  }
  if (meeting.date !== undefined || meeting.meeting_date !== undefined) {
    payload.meeting_date = meeting.date || meeting.meeting_date || "";
  }
  if (meeting.time !== undefined || meeting.start_time !== undefined) {
    payload.start_time = meeting.time || meeting.start_time || "";
  }
  if (meeting.endTime !== undefined || meeting.end_time !== undefined) {
    payload.end_time = meeting.endTime || meeting.end_time || "";
  }
  if (meeting.attendees !== undefined) {
    payload.attendees = normalizeAttendees(meeting.attendees);
  }
  if (meeting.location !== undefined) {
    payload.location = meeting.location || "";
  }
  if (meeting.briefing !== undefined || meeting.agenda !== undefined) {
    payload.agenda = meeting.briefing || meeting.agenda || "";
  }
  if (
    meeting.reminder !== undefined ||
    meeting.reminderMinutes !== undefined ||
    meeting.reminder_minutes !== undefined
  ) {
    payload.reminder_minutes = parseReminderMinutes(
      meeting.reminderMinutes ?? meeting.reminder ?? meeting.reminder_minutes
    );
  }
  if (meeting.status !== undefined) {
    payload.status = meeting.status || "scheduled";
  }
  if (meeting.deviceCalendarEventId !== undefined || meeting.device_calendar_event_id !== undefined) {
    payload.device_calendar_event_id =
      meeting.deviceCalendarEventId || meeting.device_calendar_event_id || "";
  }
  if (meeting.calendarSyncEnabled !== undefined || meeting.calendar_sync_enabled !== undefined) {
    payload.calendar_sync_enabled =
      meeting.calendarSyncEnabled ?? meeting.calendar_sync_enabled ?? false;
  }
  if (meeting.calendarSyncStatus !== undefined || meeting.calendar_sync_status !== undefined) {
    payload.calendar_sync_status =
      meeting.calendarSyncStatus || meeting.calendar_sync_status || "not_synced";
  }
  if (meeting.calendarName !== undefined || meeting.calendar_name !== undefined) {
    payload.calendar_name = meeting.calendarName || meeting.calendar_name || "";
  }
  if (meeting.notificationId !== undefined || meeting.notification_id !== undefined) {
    payload.notification_id = meeting.notificationId || meeting.notification_id || "";
  }
  if (meeting.reminderScheduled !== undefined || meeting.reminder_scheduled !== undefined) {
    payload.reminder_scheduled =
      meeting.reminderScheduled ?? meeting.reminder_scheduled ?? false;
  }
  if (meeting.reminderStatus !== undefined || meeting.reminder_status !== undefined) {
    payload.reminder_status =
      meeting.reminderStatus || meeting.reminder_status || "not_scheduled";
  }

  return payload;
}

function stripMeetingSyncPayload(payload) {
  const fallbackPayload = { ...payload };
  delete fallbackPayload.device_calendar_event_id;
  delete fallbackPayload.calendar_sync_enabled;
  delete fallbackPayload.calendar_sync_status;
  delete fallbackPayload.calendar_name;
  delete fallbackPayload.notification_id;
  delete fallbackPayload.reminder_scheduled;
  delete fallbackPayload.reminder_status;
  return fallbackPayload;
}

function reminderPayload(reminder = {}) {
  return {
    app_source: APP_SOURCE,
    title: reminder.title || "Executive reminder",
    details: reminder.details || reminder.detail || "",
    reminder_time: reminder.due || reminder.reminder_time || "Today",
    status: reminder.status || "pending",
  };
}

function documentPayload(document = {}) {
  return {
    app_source: APP_SOURCE,
    title: document.title || "New knowledge note",
    type: document.type || "Note",
    content: document.content || "",
    summary:
      document.summary ||
      "EVA will use this note for summaries, briefings, and follow-up actions.",
  };
}

function preferencesPayload(preferences = {}) {
  return {
    app_source: APP_SOURCE,
    appearance_mode: preferences.appearanceMode || preferences.appearance_mode || "dark",
    voice_mode: normalizeVoiceMode(preferences.voiceMode || preferences.voice_mode),
    ai_behavior:
      preferences.aiBehavior || preferences.ai_behavior || "executive",
    notification_enabled:
      preferences.notificationEnabled ?? preferences.notification_enabled ?? true,
    calendar_sync_enabled:
      preferences.calendarSyncEnabled ?? preferences.calendar_sync_enabled ?? false,
    default_meeting_reminder_minutes:
      Number.parseInt(
        preferences.defaultMeetingReminderMinutes ??
          preferences.default_meeting_reminder_minutes ??
          15,
        10
      ) || 15,
  };
}

function profilePayload(profile = {}) {
  return {
    app_source: APP_SOURCE,
    full_name: String(profile.fullName || profile.full_name || "EVA User").trim(),
    role: String(profile.role || "Personal workspace").trim(),
  };
}

function assistantMessagePayload(chatId, message = {}) {
  return {
    app_source: APP_SOURCE,
    chat_id: chatId,
    role: message.role === "user" ? "user" : "assistant",
    content: message.content || "",
  };
}

async function loadLatestAssistantChat(userId) {
  try {
    const activeUserId = requireUserId(userId);
    const todayStart = startOfLocalDayIso();
    const tomorrowStart = startOfLocalDayIso(1);
    const { data: chat, error: chatError } = await supabase
      .from("assistant_chats")
      .select("*")
      .eq("app_source", APP_SOURCE)
      .eq("user_id", activeUserId)
      .gte("created_at", EVA_CLEAN_DATA_CUTOFF)
      .gte("created_at", todayStart)
      .lt("created_at", tomorrowStart)
      .order("updated_at", { ascending: false })
      .limit(10);

    throwIfError(chatError);

    const visibleChat = (chat || []).find(isVisibleEvaRecord);

    if (!visibleChat?.id) {
      return null;
    }

    const { data: messages, error: messagesError } = await supabase
      .from("assistant_messages")
      .select("*")
      .eq("app_source", APP_SOURCE)
      .eq("user_id", activeUserId)
      .eq("chat_id", visibleChat.id)
      .order("created_at", { ascending: true });

    throwIfError(messagesError);

    return {
      id: String(visibleChat.id),
      dayKey: getLocalDayKey(),
      messages: (messages || []).filter(isVisibleEvaRecord).map(mapSupabaseAssistantMessage),
    };
  } catch (error) {
    console.warn("EVA chat history sync is unavailable.", error?.message || error);
    return null;
  }
}

async function loadLatestProfile(userId) {
  try {
    const activeUserId = requireUserId(userId);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("app_source", APP_SOURCE)
      .eq("user_id", activeUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    throwIfError(error);
    return mapSupabaseProfile(data);
  } catch (error) {
    console.warn("EVA profile sync is unavailable.", error?.message || error);
    return null;
  }
}

async function getOrCreateAssistantChatId(chatId, userId) {
  const activeUserId = requireUserId(userId);
  if (chatId) {
    return chatId;
  }

  const existing = await loadLatestAssistantChat(activeUserId);
  if (existing?.id) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from("assistant_chats")
    .insert(
      withUserId(
        { app_source: APP_SOURCE, title: getTodayAssistantChatTitle() },
        activeUserId
      )
    )
    .select("id")
    .single();

  throwIfError(error);
  return String(data.id);
}

function mapSupabaseTask(row) {
  return {
    id: String(row.id),
    title: row.title || "New executive task",
    detail: row.details || "",
    priority: normalizePriority(row.priority),
    status: normalizeTaskStatus(row.status),
    due: row.due_date || "Today",
    owner: row.owner || "",
  };
}

function isVisibleEvaTask(row) {
  if (!isVisibleEvaRecord(row)) {
    return false;
  }

  // Older Operational Hub rows used "Open"; current EVA writes To do/In progress/Done.
  return String(row.status || "").trim().toLowerCase() !== "open";
}

function isVisibleEvaRecord(row) {
  if (!row || row.app_source !== APP_SOURCE) {
    return false;
  }

  if (isInternalTestRecord(row)) {
    return false;
  }

  if (!row.created_at) {
    return true;
  }

  return new Date(row.created_at).getTime() >= new Date(EVA_CLEAN_DATA_CUTOFF).getTime();
}

function isInternalTestRecord(row) {
  return String(row.title || row.content || "")
    .toLowerCase()
    .includes(INTERNAL_TEST_TITLE);
}

function mapSupabaseMeeting(row) {
  return {
    id: String(row.id),
    title: row.title || "Executive meeting",
    date: row.meeting_date || "Today",
    time: row.start_time || "10:00 AM",
    endTime: row.end_time || "",
    attendees: Array.isArray(row.attendees)
      ? row.attendees.join(", ")
      : row.attendees || "Team",
    location: row.location || "",
    briefing:
      row.agenda || "EVA will prepare context before the meeting.",
    reminder: `${row.reminder_minutes || 15} ${
      Number(row.reminder_minutes) === 1 ? "minute" : "minutes"
    } before`,
    reminderMinutes: Number(row.reminder_minutes) || 15,
    status: row.status || "scheduled",
    deviceCalendarEventId: row.device_calendar_event_id || "",
    calendarSyncEnabled: row.calendar_sync_enabled ?? false,
    calendarSyncStatus: row.calendar_sync_status || "not_synced",
    calendarName: row.calendar_name || "",
    notificationId: row.notification_id || "",
    reminderScheduled: row.reminder_scheduled ?? false,
    reminderStatus: row.reminder_status || "not_scheduled",
  };
}

function mapSupabaseReminder(row) {
  return {
    id: String(row.id),
    title: row.title || "Executive reminder",
    detail: row.details || "",
    due: row.reminder_time || "Today",
    status: row.status || "pending",
  };
}

function mapSupabaseDocument(row) {
  return {
    id: String(row.id),
    title: row.title || "New knowledge note",
    type: row.type || "Note",
    content: row.content || "",
    summary:
      row.summary ||
      "EVA will use this note for summaries, briefings, and follow-up actions.",
    updatedAt: row.updated_at
      ? new Date(row.updated_at).toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })
      : "Just now",
  };
}

function mapSupabasePreferences(row) {
  if (!row) {
    return null;
  }

  return {
    appearanceMode: row.appearance_mode || "dark",
    voiceMode: normalizeVoiceMode(row.voice_mode),
    aiBehavior: normalizeAiBehavior(row.ai_behavior),
    notificationEnabled: row.notification_enabled ?? true,
    calendarSyncEnabled: row.calendar_sync_enabled ?? false,
    defaultMeetingReminderMinutes:
      Number.parseInt(row.default_meeting_reminder_minutes, 10) || 15,
  };
}

function mapSupabaseProfile(row) {
  if (!row) {
    return null;
  }

  return {
    fullName: row.full_name || "EVA User",
    role: row.role || "Personal workspace",
  };
}

function normalizeAiBehavior(value) {
  const behavior = String(value || "executive").toLowerCase();
  if (behavior === "concise" || behavior === "proactive") {
    return behavior;
  }
  return "executive";
}

function normalizeVoiceMode(value) {
  const mode = String(value || "calm").toLowerCase();
  if (mode === "executive" || mode === "warm" || mode === "direct") {
    return mode;
  }
  return "calm";
}

function mapSupabaseAssistantMessage(row) {
  return {
    id: String(row.id),
    role: row.role === "user" ? "user" : "assistant",
    content: row.content || "",
  };
}

function getTodayAssistantChatTitle() {
  return `${ASSISTANT_CHAT_TITLE_PREFIX} ${getLocalDayKey()}`;
}

function getLocalDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDayIso(offsetDays = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

function normalizePriority(priority) {
  const value = String(priority || "Medium").toLowerCase();
  if (value === "high") {
    return "High";
  }
  if (value === "low") {
    return "Low";
  }
  return "Medium";
}

function normalizeTaskStatus(status) {
  const value = String(status || "To do").toLowerCase();
  if (value === "done" || value === "completed") {
    return "Done";
  }
  if (value === "in progress" || value === "in_progress") {
    return "In progress";
  }
  return "To do";
}

function normalizeAttendees(attendees) {
  if (Array.isArray(attendees)) {
    return attendees.filter(Boolean);
  }

  return String(attendees || "Team")
    .split(",")
    .map((attendee) => attendee.trim())
    .filter(Boolean);
}

function parseReminderMinutes(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const match = String(value || "").match(/(\d+)/);
  return match ? Math.max(0, Number(match[1])) : 15;
}
