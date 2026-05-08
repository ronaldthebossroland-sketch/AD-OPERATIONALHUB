import { isSupabaseConfigured, supabase, supabaseStatusMessage } from "./supabase";

const APP_SOURCE = "eva";
const EVA_CLEAN_DATA_CUTOFF = "2026-05-04T00:00:00.000Z";
const INTERNAL_TEST_TITLE = "codex persistence verification";
const ASSISTANT_CHAT_TITLE_PREFIX = "EVA conversation";

export { isSupabaseConfigured as isEvaSupabaseConfigured, supabaseStatusMessage };

export async function loadEvaSupabaseData(userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);

  // Phase 1: load user-scoped data and workspace membership in parallel
  const [
    tasksResult,
    meetingsResult,
    remindersResult,
    documentsResult,
    preferencesResult,
    workspaces,
  ] =
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
      loadSupabaseWorkspaces(activeUserId),
    ]);

  throwIfError(tasksResult.error);
  throwIfError(meetingsResult.error);
  throwIfError(remindersResult.error);
  throwIfError(documentsResult.error);
  throwIfError(preferencesResult.error);

  // Phase 2: scope workspace data to the user's own workspace IDs
  const workspaceIds = workspaces.map((w) => w.id).filter(Boolean);
  const [workspaceTasks, workspaceMeetings, workspaceReminders, chat, profile] =
    await Promise.all([
      loadSupabaseWorkspaceTasks(workspaceIds),
      loadSupabaseWorkspaceMeetings(workspaceIds),
      loadSupabaseWorkspaceReminders(workspaceIds),
      loadLatestAssistantChat(activeUserId),
      loadLatestProfile(activeUserId),
    ]);

  return {
    tasks: dedupeRowsById([...(tasksResult.data || []), ...workspaceTasks])
      .filter(isVisibleEvaTask)
      .map(mapSupabaseTask),
    meetings: dedupeRowsById([...(meetingsResult.data || []), ...workspaceMeetings])
      .filter(isVisibleEvaRecord)
      .map(mapSupabaseMeeting),
    reminders: dedupeRowsById([...(remindersResult.data || []), ...workspaceReminders])
      .filter(isVisibleEvaRecord)
      .map(mapSupabaseReminder),
    documents: (documentsResult.data || []).filter(isVisibleEvaRecord).map(mapSupabaseDocument),
    preferences: mapSupabasePreferences(preferencesResult.data),
    workspaces,
    profile,
    chat,
  };
}

export async function createSupabaseTask(task, userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);
  const payload = withUserId(taskPayload(task), activeUserId);
  let { data, error } = await supabase
    .from("tasks")
    .insert(payload)
    .select()
    .single();

  if (isMissingColumnError(error) && !hasWorkspaceTaskScope(task)) {
    ({ data, error } = await supabase
      .from("tasks")
      .insert(stripTaskWorkspacePayload(payload))
      .select()
      .single());
  }

  throwIfError(error);
  return mapSupabaseTask(data);
}

export async function updateSupabaseTask(id, patch, userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);
  const payload = taskPayload(patch);
  let query = supabase
    .from("tasks")
    .update(payload)
    .eq("id", id)
    .eq("app_source", APP_SOURCE);

  if (hasWorkspaceTaskScope(patch)) {
    query = query.eq("workspace_id", patch.workspaceId || patch.workspace_id);
  } else {
    query = query.eq("user_id", activeUserId);
  }

  let { data, error } = await query
    .select()
    .single();

  if (isMissingColumnError(error) && !hasWorkspaceTaskScope(patch)) {
    ({ data, error } = await supabase
      .from("tasks")
      .update(stripTaskWorkspacePayload(payload))
      .eq("id", id)
      .eq("app_source", APP_SOURCE)
      .eq("user_id", activeUserId)
      .select()
      .single());
  }

  throwIfError(error);
  return mapSupabaseTask(data);
}

export async function loadSupabaseWorkspaces(userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);

  try {
    const { data: members, error: membersError } = await supabase
      .from("eva_workspace_members")
      .select("*")
      .eq("app_source", APP_SOURCE)
      .eq("user_id", activeUserId)
      .eq("status", "active");

    if (isMissingTableError(membersError)) {
      return [];
    }

    throwIfError(membersError);

    const activeMembers = Array.isArray(members) ? members : [];
    const workspaceIds = activeMembers
      .map((member) => member.workspace_id)
      .filter(Boolean);

    if (!workspaceIds.length) {
      return [];
    }

    const { data: workspaces, error: workspacesError } = await supabase
      .from("eva_workspaces")
      .select("*")
      .eq("app_source", APP_SOURCE)
      .in("id", workspaceIds);

    if (isMissingTableError(workspacesError)) {
      return [];
    }

    throwIfError(workspacesError);

    const workspaceById = new Map(
      (workspaces || []).map((workspace) => [String(workspace.id), workspace])
    );

    return activeMembers
      .map((member) =>
        mapSupabaseWorkspace(workspaceById.get(String(member.workspace_id)), member)
      )
      .filter(Boolean);
  } catch (error) {
    console.warn("EVA workspace sync is unavailable.", error?.message || error);
    return [];
  }
}

export async function createSupabaseWorkspace(workspace, userId) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);
  const name = String(workspace?.name || "EVA Team Workspace").trim();
  const displayName = cleanDisplayName(workspace?.memberName || workspace?.displayName);
  const inviteCode = normalizeWorkspaceInviteCode(
    workspace?.inviteCode || makeWorkspaceInviteCode(name)
  );

  const { data: createdWorkspace, error: workspaceError } = await supabase
    .from("eva_workspaces")
    .insert({
      app_source: APP_SOURCE,
      name,
      owner_id: activeUserId,
      invite_code: inviteCode,
    })
    .select()
    .single();

  throwIfError(workspaceError);

  const member = await insertWorkspaceMember({
      app_source: APP_SOURCE,
      workspace_id: createdWorkspace.id,
      user_id: activeUserId,
      role: "owner",
      status: "active",
      display_name: displayName,
    });
  return mapSupabaseWorkspace(createdWorkspace, member);
}

export async function joinSupabaseWorkspace(inviteCode, userId, options = {}) {
  ensureSupabase();
  const activeUserId = requireUserId(userId);
  const normalizedCode = normalizeWorkspaceInviteCode(inviteCode);
  const displayName = cleanDisplayName(options.memberName || options.displayName);

  if (!normalizedCode) {
    throw new Error("Enter a workspace invite code.");
  }

  const { data: rpcWorkspace, error: rpcError } = await supabase
    .rpc("join_eva_workspace_by_code", {
      invite_code_text: normalizedCode,
      display_name_text: displayName,
    })
    .maybeSingle();

  if (!isMissingFunctionError(rpcError)) {
    throwIfError(rpcError);
    if (rpcWorkspace?.id) {
      return mapSupabaseWorkspace(rpcWorkspace, {
        role: rpcWorkspace.role,
        status: rpcWorkspace.status,
      });
    }
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("eva_workspaces")
    .select("*")
    .eq("app_source", APP_SOURCE)
    .eq("invite_code", normalizedCode)
    .maybeSingle();

  throwIfError(workspaceError);

  if (!workspace?.id) {
    throw new Error("That workspace invite code was not found.");
  }

  const { data: existingMember, error: existingError } = await supabase
    .from("eva_workspace_members")
    .select("*")
    .eq("app_source", APP_SOURCE)
    .eq("workspace_id", workspace.id)
    .eq("user_id", activeUserId)
    .maybeSingle();

  throwIfError(existingError);

  if (existingMember?.id) {
    return mapSupabaseWorkspace(workspace, existingMember);
  }

  const member = await insertWorkspaceMember({
      app_source: APP_SOURCE,
      workspace_id: workspace.id,
      user_id: activeUserId,
      role: "member",
      status: "active",
      display_name: displayName,
    });
  return mapSupabaseWorkspace(workspace, member);
}

export async function loadSupabaseWorkspaceMembers(workspaceId, userId) {
  ensureSupabase();
  requireUserId(userId);
  const activeWorkspaceId = requireWorkspaceId(workspaceId);

  let { data, error } = await supabase
    .from("eva_workspace_members")
    .select("*")
    .eq("app_source", APP_SOURCE)
    .eq("workspace_id", activeWorkspaceId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (isMissingTableError(error)) {
    return [];
  }

  if (isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from("eva_workspace_members")
      .select("id,workspace_id,user_id,role,status,app_source,created_at")
      .eq("app_source", APP_SOURCE)
      .eq("workspace_id", activeWorkspaceId)
      .eq("status", "active")
      .order("created_at", { ascending: true }));
  }

  throwIfError(error);
  return (data || []).map(mapSupabaseWorkspaceMember);
}

export async function updateSupabaseWorkspaceMemberRole(
  memberId,
  role,
  workspaceId,
  userId
) {
  ensureSupabase();
  requireUserId(userId);
  const activeWorkspaceId = requireWorkspaceId(workspaceId);
  const normalizedRole = normalizeWorkspaceRole(role);

  if (normalizedRole === "owner") {
    throw new Error("Workspace ownership cannot be changed here.");
  }

  const { data, error } = await supabase
    .from("eva_workspace_members")
    .update({ role: normalizedRole })
    .eq("id", memberId)
    .eq("workspace_id", activeWorkspaceId)
    .eq("app_source", APP_SOURCE)
    .select()
    .single();

  throwIfError(error);
  return mapSupabaseWorkspaceMember(data);
}

async function insertWorkspaceMember(payload) {
  let { data, error } = await supabase
    .from("eva_workspace_members")
    .insert(payload)
    .select()
    .single();

  if (isMissingColumnError(error) && payload.display_name !== undefined) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.display_name;
    ({ data, error } = await supabase
      .from("eva_workspace_members")
      .insert(fallbackPayload)
      .select()
      .single());
  }

  throwIfError(error);
  return data;
}

async function loadSupabaseWorkspaceTasks(workspaceIds) {
  if (!Array.isArray(workspaceIds) || !workspaceIds.length) return [];

  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("app_source", APP_SOURCE)
      .in("workspace_id", workspaceIds)
      .gte("created_at", EVA_CLEAN_DATA_CUTOFF)
      .order("created_at", { ascending: false });

    if (isMissingColumnError(error)) {
      return [];
    }

    throwIfError(error);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("EVA workspace task sync is unavailable.", error?.message || error);
    return [];
  }
}

async function loadSupabaseWorkspaceMeetings(workspaceIds) {
  if (!Array.isArray(workspaceIds) || !workspaceIds.length) return [];

  try {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("app_source", APP_SOURCE)
      .in("workspace_id", workspaceIds)
      .gte("created_at", EVA_CLEAN_DATA_CUTOFF)
      .order("created_at", { ascending: false });

    if (isMissingColumnError(error)) {
      return [];
    }

    throwIfError(error);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("EVA workspace meeting sync is unavailable.", error?.message || error);
    return [];
  }
}

async function loadSupabaseWorkspaceReminders(workspaceIds) {
  if (!Array.isArray(workspaceIds) || !workspaceIds.length) return [];

  try {
    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("app_source", APP_SOURCE)
      .in("workspace_id", workspaceIds)
      .gte("created_at", EVA_CLEAN_DATA_CUTOFF)
      .order("created_at", { ascending: false });

    if (isMissingColumnError(error)) {
      return [];
    }

    throwIfError(error);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("EVA workspace reminder sync is unavailable.", error?.message || error);
    return [];
  }
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
  const payload = withUserId(reminderPayload(reminder), activeUserId);
  let { data, error } = await supabase
    .from("reminders")
    .insert(payload)
    .select()
    .single();

  if (isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from("reminders")
      .insert(stripReminderNotificationPayload(payload))
      .select()
      .single());
  }

  throwIfError(error);
  return mapSupabaseReminder(data, reminder);
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

function requireWorkspaceId(workspaceId) {
  const value = String(workspaceId || "").trim();
  if (!value) {
    throw new Error("A workspace is required.");
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
  return (
    Boolean(getMissingColumnName(error)) ||
    (text.includes("could not find the") && text.includes("column")) ||
    (text.includes("column") && text.includes("does not exist"))
  );
}

function isMissingTableError(error) {
  const text = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (
    (text.includes("relation") && text.includes("does not exist")) ||
    text.includes("could not find the table") ||
    (text.includes("schema cache") &&
      (text.includes("eva_workspaces") ||
        text.includes("eva_workspace_members")))
  );
}

function isMissingFunctionError(error) {
  if (!error) {
    return false;
  }
  const text = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (
    text.includes("could not find the function") ||
    (text.includes("function") && text.includes("does not exist")) ||
    text.includes("schema cache") && text.includes("join_eva_workspace_by_code")
  );
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
  if (task.workspaceId !== undefined || task.workspace_id !== undefined) {
    payload.workspace_id = task.workspaceId || task.workspace_id || null;
  }
  if (task.createdBy !== undefined || task.created_by !== undefined) {
    payload.created_by = task.createdBy || task.created_by || null;
  }
  if (task.assignedTo !== undefined || task.assigned_to !== undefined) {
    payload.assigned_to = task.assignedTo || task.assigned_to || null;
  }

  return payload;
}

function stripTaskWorkspacePayload(payload) {
  const fallbackPayload = { ...payload };
  delete fallbackPayload.workspace_id;
  delete fallbackPayload.created_by;
  delete fallbackPayload.assigned_to;
  return fallbackPayload;
}

function hasWorkspaceTaskScope(task = {}) {
  return Boolean(task.workspaceId || task.workspace_id);
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
  if (meeting.workspaceId !== undefined || meeting.workspace_id !== undefined) {
    payload.workspace_id = meeting.workspaceId || meeting.workspace_id || null;
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
  const payload = {
    app_source: APP_SOURCE,
    title: reminder.title || "Executive reminder",
    details: reminder.details || reminder.detail || "",
    reminder_time:
      reminder.reminder_time ||
      reminder.reminderTime ||
      reminder.time ||
      reminder.due ||
      "Today",
    status: reminder.status || "pending",
  };

  if (reminder.notificationId !== undefined || reminder.notification_id !== undefined) {
    payload.notification_id = reminder.notificationId || reminder.notification_id || "";
  }
  if (reminder.reminderScheduled !== undefined || reminder.reminder_scheduled !== undefined) {
    payload.reminder_scheduled =
      reminder.reminderScheduled ?? reminder.reminder_scheduled ?? false;
  }
  if (reminder.reminderStatus !== undefined || reminder.reminder_status !== undefined) {
    payload.reminder_status =
      reminder.reminderStatus || reminder.reminder_status || "not_scheduled";
  }
  if (reminder.workspaceId !== undefined || reminder.workspace_id !== undefined) {
    payload.workspace_id = reminder.workspaceId || reminder.workspace_id || null;
  }

  return payload;
}

function stripReminderNotificationPayload(payload) {
  const fallbackPayload = { ...payload };
  delete fallbackPayload.notification_id;
  delete fallbackPayload.reminder_scheduled;
  delete fallbackPayload.reminder_status;
  return fallbackPayload;
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
    workspaceId: row.workspace_id || "",
    createdBy: row.created_by || row.user_id || "",
    assignedTo: row.assigned_to || "",
  };
}

function mapSupabaseWorkspace(row, member = {}) {
  if (!row?.id) {
    return null;
  }

  return {
    id: String(row.id),
    name: row.name || "EVA Workspace",
    role: normalizeWorkspaceRole(member.role),
    ownerId: row.owner_id || "",
    inviteCode: row.invite_code || "",
    status: member.status || "active",
  };
}

function mapSupabaseWorkspaceMember(row = {}) {
  const userId = String(row.user_id || "");
  return {
    id: String(row.id || ""),
    workspaceId: String(row.workspace_id || ""),
    userId,
    displayName: cleanDisplayName(row.display_name) || shortUserId(userId),
    role: normalizeWorkspaceRole(row.role),
    status: row.status || "active",
  };
}

function dedupeRowsById(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const id = String(row?.id || "");
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
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
    workspaceId: row.workspace_id || "",
  };
}

function mapSupabaseReminder(row, fallback = {}) {
  return {
    id: String(row.id),
    title: row.title || "Executive reminder",
    detail: row.details || "",
    due: fallback.due || row.reminder_time || "Today",
    reminder_time:
      fallback.reminder_time ||
      fallback.reminderTime ||
      row.reminder_time ||
      "",
    status: row.status || "pending",
    notificationId: row.notification_id || fallback.notificationId || "",
    reminderScheduled:
      row.reminder_scheduled ?? fallback.reminderScheduled ?? false,
    reminderStatus:
      row.reminder_status || fallback.reminderStatus || "not_scheduled",
    workspaceId: row.workspace_id || "",
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

function normalizeWorkspaceRole(value) {
  const role = String(value || "member").toLowerCase();
  if (["owner", "admin", "viewer"].includes(role)) {
    return role;
  }
  return "member";
}

function normalizeWorkspaceInviteCode(value) {
  return String(value || "")
    .replace(/[^a-z0-9-]/gi, "")
    .toUpperCase()
    .slice(0, 32);
}

function cleanDisplayName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function shortUserId(userId) {
  const value = String(userId || "");
  return value ? `Member ${value.slice(0, 8)}` : "Workspace member";
}

function makeWorkspaceInviteCode(name) {
  const prefix =
    String(name || "EVA")
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 4) || "EVA";
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${random}`;
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
