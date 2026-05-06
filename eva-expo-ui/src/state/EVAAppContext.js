import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert, Linking, Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  assistantPrompts,
  initialDocuments,
  initialMeetings,
  initialReminders,
  initialTasks,
} from "../data/mockData";
import {
  createSupabaseChatMessages,
  createSupabaseDocument,
  createSupabaseMeeting,
  createSupabaseReminder,
  createSupabaseTask,
  deleteSupabaseMeeting,
  isEvaSupabaseConfigured,
  loadEvaSupabaseData,
  saveSupabaseProfile,
  saveSupabasePreferences,
  updateSupabaseMeeting,
  updateSupabaseTask,
} from "../lib/evaSupabaseStore";
import { supabase } from "../lib/supabase";
import { sendEvaAssistantCommand } from "../lib/evaApi";
import {
  checkCalendarPermissions,
  checkMicrophonePermission,
  checkNotificationPermissions,
  requestMicrophonePermission,
  requestCalendarPermissions,
  requestNotificationPermissions,
} from "../lib/devicePermissions";
import { createDeviceCalendarEvent, deleteDeviceCalendarEvent, updateDeviceCalendarEvent } from "../lib/deviceCalendar";
import {
  addNotificationResponseListener,
  cancelScheduledNotification,
  ensureEvaReminderChannel,
  scheduleMeetingReminder,
  scheduleReminderNotification,
  scheduleTaskReminder,
  scheduleTestNotification,
} from "../lib/deviceNotifications";
import { makeTheme } from "../theme";

export const EVA_TUTORIAL_COMPLETE_KEY = "eva:onboarding:tutorial-complete:v1";
export const EVA_POST_TUTORIAL_PERMISSIONS_KEY = "eva:onboarding:permissions-asked:v1";

const NOTIFICATION_DENIED_ALERT_TITLE = "Notifications Blocked";
const NOTIFICATION_DENIED_ALERT_BODY =
  "EVA's notification access was denied. Open your phone settings to allow reminders.";

function openNotificationSettings() {
  if (Platform.OS === "android") {
    const pkg =
      Constants.expoConfig?.android?.package ??
      Constants.manifest?.android?.package ??
      "host.exp.exponent";
    IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS,
      { data: `package:${pkg}` }
    ).catch(() => Linking.openSettings());
  } else {
    Linking.openSettings();
  }
}

const EVAAppContext = createContext(null);

const initialMessages = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Good evening. EVA is ready. You can ask me to create tasks, schedule meetings, summarize notes, prepare briefings, or set reminders.",
  },
];

export const aiBehaviorOptions = [
  {
    id: "executive",
    label: "Executive",
    description: "Balanced, polished, decision-focused.",
  },
  {
    id: "concise",
    label: "Concise",
    description: "Fast answers with only the essentials.",
  },
  {
    id: "proactive",
    label: "Proactive",
    description: "Suggests next moves, risks, and follow-ups.",
  },
];

export const voiceModeOptions = [
  {
    id: "calm",
    label: "Calm",
    description: "Slow, soft, and soothing for focused work.",
  },
  {
    id: "executive",
    label: "Executive",
    description: "Polished, composed, and butler-like where the device voice allows.",
  },
  {
    id: "warm",
    label: "Warm",
    description: "Gentle, homely, and reassuring.",
  },
  {
    id: "direct",
    label: "Direct",
    description: "Firm, clear, and action-oriented.",
  },
];

const defaultProfile = {
  fullName: "EVA User",
  role: "Personal workspace",
};

const DEBUG_EVA_FLOW = process.env.EXPO_PUBLIC_EVA_DEBUG === "true";
const initialRecordIds = {
  tasks: new Set(initialTasks.map((item) => item.id)),
  meetings: new Set(initialMeetings.map((item) => item.id)),
  reminders: new Set(initialReminders.map((item) => item.id)),
  documents: new Set(initialDocuments.map((item) => item.id)),
};

export function EVAAppProvider({ children }) {
  const [authLoading, setAuthLoading] = useState(isEvaSupabaseConfigured);
  const [authError, setAuthError] = useState("");
  const [session, setSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [localPreviewUnlocked, setLocalPreviewUnlocked] = useState(false);
  const [themeMode, setThemeMode] = useState("dark");
  const [aiBehavior, setAiBehaviorState] = useState("executive");
  const [voiceMode, setVoiceModeState] = useState("calm");
  const [notificationEnabled, setNotificationEnabledState] = useState(true);
  const [phoneCalendarSyncEnabled, setPhoneCalendarSyncEnabledState] = useState(false);
  const [defaultMeetingReminderMinutes, setDefaultMeetingReminderMinutesState] =
    useState(15);
  const [calendarPermissionStatus, setCalendarPermissionStatus] = useState("unknown");
  const [notificationPermissionStatus, setNotificationPermissionStatus] =
    useState("unknown");
  const [microphonePermissionStatus, setMicrophonePermissionStatus] =
    useState("unknown");
  const [deepgramConnectionStatus, setDeepgramConnectionStatus] =
    useState("not_connected");
  const [deviceIntegrationWarning, setDeviceIntegrationWarning] = useState("");
  const [profile, setProfileState] = useState(defaultProfile);
  const [tasks, setTasks] = useState(initialTasks);
  const [meetings, setMeetings] = useState(initialMeetings);
  const [documents, setDocuments] = useState(initialDocuments);
  const [reminders, setReminders] = useState(initialReminders);
  const [chatMessages, setChatMessages] = useState(initialMessages);
  const [chatId, setChatId] = useState(null);
  const [chatDay, setChatDay] = useState(getLocalDayKey());
  const [remoteEnabled, setRemoteEnabled] = useState(false);
  const [assistantConnection, setAssistantConnection] = useState({
    backend: "unknown",
    ai: "unknown",
  });
  const [syncStatus, setSyncStatus] = useState(
    isEvaSupabaseConfigured ? "auth_required" : "local"
  );
  const [syncWarning, setSyncWarning] = useState("");
  const theme = useMemo(() => makeTheme(themeMode), [themeMode]);
  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status !== "Done"),
    [tasks]
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.status === "Done"),
    [tasks]
  );

  const resetWorkspaceForUserLoad = useCallback((activeUser) => {
    setProfileState(getProfileFallback(activeUser));
    setTasks([]);
    setMeetings([]);
    setDocuments([]);
    setReminders([]);
    setChatMessages(initialMessages);
    setChatId(null);
    setChatDay(getLocalDayKey());
  }, []);

  const resetWorkspaceForSignedOut = useCallback(() => {
    setProfileState(defaultProfile);
    setThemeMode("dark");
    setAiBehaviorState("executive");
    setVoiceModeState("calm");
    setNotificationEnabledState(true);
    setPhoneCalendarSyncEnabledState(false);
    setDefaultMeetingReminderMinutesState(15);
    setTasks(initialTasks);
    setMeetings(initialMeetings);
    setDocuments(initialDocuments);
    setReminders(initialReminders);
    setChatMessages(initialMessages);
    setChatId(null);
    setChatDay(getLocalDayKey());
  }, []);

  const applyAuthSession = useCallback((nextSession) => {
    const nextUser = nextSession?.user || null;
    const userChanged = (nextUser?.id || "") !== (currentUser?.id || "");
    setSession(nextSession);
    setCurrentUser(nextUser);
    setLocalPreviewUnlocked(false);
    setAuthError("");

    if (nextUser) {
      if (userChanged) {
        resetWorkspaceForUserLoad(nextUser);
      }
      setSyncStatus("connecting");
      return;
    }

    resetWorkspaceForSignedOut();
    setRemoteEnabled(false);
    setSyncStatus(isEvaSupabaseConfigured ? "auth_required" : "local");
    setSyncWarning("");
  }, [currentUser?.id, resetWorkspaceForSignedOut, resetWorkspaceForUserLoad]);

  useEffect(() => {
    if (!isEvaSupabaseConfigured || !supabase) {
      return undefined;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          throw error;
        }

        applyAuthSession(data?.session || null);
        setAuthLoading(false);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setAuthError(error?.message || "Could not restore your EVA session.");
        setAuthLoading(false);
        setSyncStatus("auth_required");
        console.warn("EVA Auth session restore failed.", error?.message || error);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!isMounted) {
          return;
        }

        applyAuthSession(nextSession || null);
        setAuthLoading(false);
      }
    );

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, [applyAuthSession]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      checkCalendarPermissions(),
      checkNotificationPermissions(),
      checkMicrophonePermission(),
    ])
      .then(([calendarPermission, notificationPermission, microphonePermission]) => {
        if (!isMounted) {
          return;
        }

        setCalendarPermissionStatus(permissionStatusLabel(calendarPermission));
        setNotificationPermissionStatus(permissionStatusLabel(notificationPermission));
        setMicrophonePermissionStatus(permissionStatusLabel(microphonePermission));
      })
      .catch((error) => {
        if (isMounted) {
          console.warn("EVA permission status check failed.", error?.message || error);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isEvaSupabaseConfigured || !currentUser?.id) {
      return undefined;
    }

    let isMounted = true;
    const activeUser = currentUser;
    const activeUserId = activeUser.id;

    Promise.resolve().then(() => {
      if (!isMounted) {
        return;
      }

      setRemoteEnabled(false);
      setSyncStatus("connecting");
      setSyncWarning("");
      resetWorkspaceForUserLoad(activeUser);
    });

    loadEvaSupabaseData(activeUserId)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setRemoteEnabled(true);
        setSyncStatus("connected");
        setSyncWarning("");
        setTasks((current) =>
          mergeRemoteWithPendingLocal(
            Array.isArray(data.tasks) ? data.tasks : [],
            current,
            initialRecordIds.tasks
          )
        );
        setMeetings((current) =>
          mergeRemoteWithPendingLocal(
            Array.isArray(data.meetings) ? data.meetings : [],
            current,
            initialRecordIds.meetings
          )
        );
        setReminders((current) =>
          mergeRemoteWithPendingLocal(
            Array.isArray(data.reminders) ? data.reminders : [],
            current,
            initialRecordIds.reminders
          )
        );
        setDocuments((current) =>
          mergeRemoteWithPendingLocal(
            Array.isArray(data.documents) ? data.documents : [],
            current,
            initialRecordIds.documents
          )
        );
        setChatId(data.chat?.id || null);
        setChatDay(data.chat?.dayKey || getLocalDayKey());

        if (Array.isArray(data.chat?.messages) && data.chat.messages.length) {
          setChatMessages([initialMessages[0], ...data.chat.messages]);
        } else {
          setChatMessages(initialMessages);
        }

        const remoteTheme = data.preferences?.appearanceMode;
        if (remoteTheme === "dark" || remoteTheme === "light") {
          setThemeMode(remoteTheme);
        }

        const remoteBehavior = normalizeAiBehavior(data.preferences?.aiBehavior);
        setAiBehaviorState(remoteBehavior);

        const remoteVoiceMode = normalizeVoiceMode(data.preferences?.voiceMode);
        setVoiceModeState(remoteVoiceMode);

        if (typeof data.preferences?.notificationEnabled === "boolean") {
          setNotificationEnabledState(data.preferences.notificationEnabled);
        }
        if (typeof data.preferences?.calendarSyncEnabled === "boolean") {
          setPhoneCalendarSyncEnabledState(data.preferences.calendarSyncEnabled);
        }
        if (Number.isFinite(data.preferences?.defaultMeetingReminderMinutes)) {
          setDefaultMeetingReminderMinutesState(
            data.preferences.defaultMeetingReminderMinutes
          );
        }

        if (data.profile) {
          setProfileState(resolveLoadedProfile(data.profile, activeUser));
        } else {
          setProfileState(getProfileFallback(activeUser));
        }
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setRemoteEnabled(false);
        setSyncStatus("unavailable");
        setSyncWarning("Local Mode is active because Supabase could not be reached.");
        console.warn("EVA Supabase bootstrap failed.", error?.message || error);
      });

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, resetWorkspaceForUserLoad]);

  useEffect(() => {
    let removeListener = () => {};
    addNotificationResponseListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      if (data.type === "reminder" && data.reminderId) {
        setReminders((current) =>
          current.map((r) => r.id === data.reminderId ? { ...r, status: "done" } : r)
        );
      } else if (data.type === "task" && data.taskId) {
        setTasks((current) =>
          current.map((t) => t.id === data.taskId ? { ...t, reminderScheduled: false, notificationId: "" } : t)
        );
      } else if (data.type === "meeting" && data.meetingId) {
        setMeetings((current) =>
          current.map((m) => m.id === data.meetingId ? { ...m, reminderStatus: "acknowledged" } : m)
        );
      }
    }).then((removeFn) => {
      removeListener = removeFn;
    });
    return () => removeListener();
  }, []);

  async function signIn(email, password) {
    ensureAuthClient();
    setAuthError("");
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setAuthError(error.message || "Could not sign in.");
      throw error;
    }

    return data;
  }

  async function signUp(email, password, fullName) {
    ensureAuthClient();
    setAuthError("");
    const normalizedEmail = normalizeEmail(email);
    const name = String(fullName || "").trim();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: name ? { full_name: name } : undefined,
      },
    });

    if (error) {
      setAuthError(error.message || "Could not create your account.");
      throw error;
    }

    if (!data?.session) {
      setAuthError(
        "Account created. Check your email if Supabase requires confirmation before sign in."
      );
    }

    if (data?.user?.id && name) {
      saveSupabaseProfile(
        { fullName: name, role: "EVA workspace owner" },
        data.user.id
      ).catch((error) => {
        console.warn("EVA profile setup is unavailable.", error?.message || error);
      });
    }

    return data;
  }

  async function signOut() {
    if (localPreviewUnlocked && (!isEvaSupabaseConfigured || !currentUser?.id)) {
      setLocalPreviewUnlocked(false);
      applyAuthSession(null);
      return { ok: true };
    }

    ensureAuthClient();
    setAuthError("");
    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message || "Could not log out.");
      throw error;
    }

    applyAuthSession(null);
    return { ok: true };
  }

  function continueLocalPreview() {
    if (isEvaSupabaseConfigured) {
      setAuthError("Sign in is required for this EVA workspace.");
      return;
    }

    setAuthError("");
    setLocalPreviewUnlocked(true);
    setRemoteEnabled(false);
    setSyncStatus("local");
    resetWorkspaceForSignedOut();
  }

  async function resetPassword(email) {
    ensureAuthClient();
    setAuthError("");
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail
    );

    if (error) {
      setAuthError(error.message || "Could not send a reset email.");
      throw error;
    }

    return data || { ok: true };
  }

  function ensureAuthClient() {
    if (!isEvaSupabaseConfigured || !supabase) {
      throw new Error("Sign-in is not ready on this build.");
    }
  }

  function syncMutation(label, action, onSuccess) {
    if (!remoteEnabled || !currentUser?.id) {
      debugEvaFlow(`${label}: Supabase skipped`, {
        reason: !currentUser?.id ? "auth_required" : "remote_not_connected",
      });
      return;
    }

    action()
      .then((data) => {
        setSyncStatus("connected");
        setSyncWarning("");
        debugEvaFlow(`${label}: Supabase save result`, {
          ok: true,
          id: data?.id,
          title: data?.title,
        });
        onSuccess?.(data);
      })
      .catch((error) => {
        setSyncStatus("unavailable");
        setSyncWarning("Supabase sync paused. Local changes are safe.");
        debugEvaFlow(`${label}: Supabase save result`, {
          ok: false,
          message: error?.message || String(error),
        });
        console.warn("EVA Supabase sync failed.", error?.message || error);
      });
  }

  function saveChatMessages(messages, targetChatId = chatId) {
    const todayKey = getLocalDayKey();
    const resolvedChatId = chatDay === todayKey ? targetChatId : null;

    if (chatDay !== todayKey) {
      setChatDay(todayKey);
      setChatId(null);
    }

    syncMutation(
      "chat_messages",
      () => createSupabaseChatMessages(messages, resolvedChatId, currentUser.id),
      (data) => {
        if (data?.chatId) {
          setChatId(data.chatId);
        }
      }
    );
  }

  function savePreferencesPatch(patch = {}) {
    const preferences = {
      appearanceMode: patch.appearanceMode ?? themeMode,
      aiBehavior: patch.aiBehavior ?? aiBehavior,
      voiceMode: patch.voiceMode ?? voiceMode,
      notificationEnabled:
        patch.notificationEnabled ?? notificationEnabled,
      calendarSyncEnabled:
        patch.calendarSyncEnabled ?? phoneCalendarSyncEnabled,
      defaultMeetingReminderMinutes:
        patch.defaultMeetingReminderMinutes ?? defaultMeetingReminderMinutes,
    };

    syncMutation(
      "preferences",
      () => saveSupabasePreferences(preferences, currentUser.id),
      (data) => {
        if (!data) {
          return;
        }

        if (data.appearanceMode === "dark" || data.appearanceMode === "light") {
          setThemeMode(data.appearanceMode);
        }
        setAiBehaviorState(normalizeAiBehavior(data.aiBehavior));
        setVoiceModeState(normalizeVoiceMode(data.voiceMode));
        setNotificationEnabledState(
          data.notificationEnabled ?? preferences.notificationEnabled
        );
        setPhoneCalendarSyncEnabledState(
          data.calendarSyncEnabled ?? preferences.calendarSyncEnabled
        );
        setDefaultMeetingReminderMinutesState(
          data.defaultMeetingReminderMinutes ??
            preferences.defaultMeetingReminderMinutes
        );
      }
    );
  }

  function toggleThemeMode() {
    const nextMode = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextMode);
    savePreferencesPatch({ appearanceMode: nextMode });
  }

  function setAiBehavior(nextBehavior) {
    const normalized = normalizeAiBehavior(nextBehavior);
    setAiBehaviorState(normalized);
    savePreferencesPatch({ aiBehavior: normalized });
  }

  function setVoiceMode(nextVoiceMode) {
    const normalized = normalizeVoiceMode(nextVoiceMode);
    setVoiceModeState(normalized);
    savePreferencesPatch({ voiceMode: normalized });
  }

  async function toggleNotifications() {
    const nextValue = !notificationEnabled;

    if (!nextValue) {
      setNotificationEnabledState(false);
      savePreferencesPatch({ notificationEnabled: false });
      return {
        ok: true,
        status: notificationPermissionStatus,
      };
    }

    const current = await checkNotificationPermissions();

    if (current.status === "denied" && !current.canAskAgain) {
      Alert.alert(NOTIFICATION_DENIED_ALERT_TITLE, NOTIFICATION_DENIED_ALERT_BODY, [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => openNotificationSettings() },
      ]);
      return { ok: false, status: "denied" };
    }

    const permission = await requestNotificationPermissions();
    const status = permissionStatusLabel(permission);
    setNotificationPermissionStatus(status);

    if (!permission.granted) {
      setNotificationEnabledState(false);
      if (permission.status === "denied") {
        Alert.alert(NOTIFICATION_DENIED_ALERT_TITLE, NOTIFICATION_DENIED_ALERT_BODY, [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => openNotificationSettings() },
        ]);
      } else {
        setDeviceIntegrationWarning(
          permission.message || "Notification access was not granted. EVA will still save your tasks and meetings."
        );
      }
      savePreferencesPatch({ notificationEnabled: false });
      return { ok: false, status };
    }

    await ensureEvaReminderChannel();
    setNotificationEnabledState(nextValue);
    setDeviceIntegrationWarning("");
    savePreferencesPatch({ notificationEnabled: nextValue });
    return { ok: true, status };
  }

  async function togglePhoneCalendarSync() {
    const nextValue = !phoneCalendarSyncEnabled;

    if (!nextValue) {
      setPhoneCalendarSyncEnabledState(false);
      setDeviceIntegrationWarning("");
      savePreferencesPatch({ calendarSyncEnabled: false });
      return {
        ok: true,
        status: calendarPermissionStatus,
      };
    }

    const permission = await requestCalendarPermissions();
    const status = permissionStatusLabel(permission);
    setCalendarPermissionStatus(status);

    if (!permission.granted) {
      setPhoneCalendarSyncEnabledState(false);
      setDeviceIntegrationWarning(
        "Calendar access was not granted. EVA will keep meetings inside the app."
      );
      savePreferencesPatch({ calendarSyncEnabled: false });
      return { ok: false, status };
    }

    setPhoneCalendarSyncEnabledState(true);
    setDeviceIntegrationWarning("");
    savePreferencesPatch({ calendarSyncEnabled: true });
    return { ok: true, status };
  }

  async function testCalendarPermission() {
    const permission = await requestCalendarPermissions();
    const status = permissionStatusLabel(permission);
    setCalendarPermissionStatus(status);
    setDeviceIntegrationWarning(
      permission.granted
        ? "Phone calendar access is connected."
        : "Calendar access was not granted."
    );
    return permission;
  }

  async function testMicrophonePermission() {
    const permission = await requestMicrophonePermission();
    const status = permissionStatusLabel(permission);
    setMicrophonePermissionStatus(status);
    setDeviceIntegrationWarning(
      permission.granted
        ? "Microphone access is ready for EVA voice commands."
        : "Microphone access was not granted. You can still type commands manually."
    );
    return permission;
  }

  async function requestPostTutorialPermissions() {
    const results = {};

    setDeviceIntegrationWarning("Setting up EVA permissions...");

    const notificationPermission = await requestNotificationPermissions();
    const notificationStatus = permissionStatusLabel(notificationPermission);
    results.notifications = notificationPermission;
    setNotificationPermissionStatus(notificationStatus);
    setNotificationEnabledState(Boolean(notificationPermission.granted));
    if (notificationPermission.granted) {
      await ensureEvaReminderChannel();
    }

    const microphonePermission = await requestMicrophonePermission();
    const microphoneStatus = permissionStatusLabel(microphonePermission);
    results.microphone = microphonePermission;
    setMicrophonePermissionStatus(microphoneStatus);

    const calendarPermission = await requestCalendarPermissions();
    const calendarStatus = permissionStatusLabel(calendarPermission);
    results.calendar = calendarPermission;
    setCalendarPermissionStatus(calendarStatus);
    setPhoneCalendarSyncEnabledState(Boolean(calendarPermission.granted));

    savePreferencesPatch({
      notificationEnabled: Boolean(notificationPermission.granted),
      calendarSyncEnabled: Boolean(calendarPermission.granted),
    });

    const denied = [
      !notificationPermission.granted ? "notifications" : "",
      !microphonePermission.granted ? "microphone" : "",
      !calendarPermission.granted ? "calendar" : "",
    ].filter(Boolean);

    setDeviceIntegrationWarning(
      denied.length
        ? `EVA is ready. You can retry ${denied.join(", ")} access later in Settings.`
        : "EVA permissions are ready."
    );

    return {
      ok:
        Boolean(notificationPermission.granted) &&
        Boolean(microphonePermission.granted) &&
        Boolean(calendarPermission.granted),
      results,
    };
  }

  function updateVoiceIntegrationStatus({
    microphoneStatus,
    deepgramStatus,
    message,
  } = {}) {
    if (microphoneStatus) {
      setMicrophonePermissionStatus(microphoneStatus);
    }
    if (deepgramStatus) {
      setDeepgramConnectionStatus(deepgramStatus);
    }
    if (message !== undefined) {
      setDeviceIntegrationWarning(message || "");
    }
  }

  function addAssistantNotice(content) {
    const text = String(content || "").trim();
    if (!text) {
      return null;
    }

    const assistantMessage = {
      id: makeLocalRecordId("message"),
      role: "assistant",
      content: text,
    };

    setChatMessages((current) => [...current, assistantMessage]);
    saveChatMessages([assistantMessage]);
    return assistantMessage;
  }

  async function sendTestNotification() {
    const current = await checkNotificationPermissions();

    if (current.status === "denied" && !current.canAskAgain) {
      setNotificationPermissionStatus("denied");
      Alert.alert(NOTIFICATION_DENIED_ALERT_TITLE, NOTIFICATION_DENIED_ALERT_BODY, [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => openNotificationSettings() },
      ]);
      return {
        ok: false,
        reminder_status: "permission_denied",
        message: "Notification access was denied.",
      };
    }

    const result = await scheduleTestNotification();
    if (result.ok) {
      setNotificationPermissionStatus("connected");
      setDeviceIntegrationWarning("Test notification scheduled.");
    } else {
      if (result.reminder_status === "permission_denied") {
        setNotificationPermissionStatus("denied");
        Alert.alert(NOTIFICATION_DENIED_ALERT_TITLE, NOTIFICATION_DENIED_ALERT_BODY, [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => openNotificationSettings() },
        ]);
      } else {
        setDeviceIntegrationWarning(
          result.message || "Test notification could not be scheduled."
        );
      }
    }
    return result;
  }

  async function createTestCalendarEvent() {
    const result = await createDeviceCalendarEvent({
      id: makeLocalRecordId("meeting"),
      title: "EVA test calendar event",
      date: "Today",
      time: "5:00 PM",
      attendees: "EVA",
      briefing: "Created to confirm phone calendar access.",
      reminder: `${defaultMeetingReminderMinutes} minutes before`,
    });

    if (result.ok) {
      setCalendarPermissionStatus("connected");
      setDeviceIntegrationWarning(
        `Test calendar event created in ${result.calendar_name || "phone calendar"}.`
      );
    } else {
      if (result.calendar_sync_status === "permission_denied") {
        setCalendarPermissionStatus("denied");
      }
      setDeviceIntegrationWarning(
        result.message || "Test calendar event could not be created."
      );
    }

    return result;
  }

  function setDefaultMeetingReminderMinutes(nextMinutes) {
    const minutes = [10, 15, 30].includes(Number(nextMinutes))
      ? Number(nextMinutes)
      : 15;
    setDefaultMeetingReminderMinutesState(minutes);
    savePreferencesPatch({ defaultMeetingReminderMinutes: minutes });
  }

  async function clearLocalPreviewData() {
    setTasks(currentUser?.id ? [] : initialTasks);
    setMeetings(currentUser?.id ? [] : initialMeetings);
    setDocuments(currentUser?.id ? [] : initialDocuments);
    setReminders(currentUser?.id ? [] : initialReminders);
    setChatMessages(initialMessages);
    setChatId(null);
    setDeviceIntegrationWarning(
      "Local preview data was cleared. Supabase records remain untouched."
    );
    await AsyncStorage.multiRemove([
      EVA_TUTORIAL_COMPLETE_KEY,
      EVA_POST_TUTORIAL_PERMISSIONS_KEY,
    ]).catch(() => {});
  }

  function updateProfile(nextProfile = {}) {
    const updatedProfile = {
      fullName:
        String(nextProfile.fullName || "").trim() || defaultProfile.fullName,
      role: String(nextProfile.role || "").trim() || defaultProfile.role,
    };

    setProfileState(updatedProfile);
    syncMutation(
      "profile",
      () => saveSupabaseProfile(updatedProfile, currentUser.id),
      (data) => {
        if (data) {
          setProfileState(data);
        }
      }
    );
  }

  function addTask(input) {
    const task = {
      id: makeLocalRecordId("task"),
      title: input.title || "New executive task",
      detail: input.detail || "Created from EVA preview.",
      priority: input.priority || "Medium",
      status: input.status || "To do",
      due: input.due || "Today",
    };
    debugEvaFlow("task: before saving", task);
    setTasks((current) => {
      const next = [task, ...current];
      debugEvaFlow("task: local state after creation", summarizeRecords(next));
      return next;
    });
    syncMutation(
      "task",
      () => createSupabaseTask(task, currentUser.id),
      (data) => {
        if (data) {
          replaceRecord(setTasks, task.id, data);
        }
      }
    );

    if (notificationEnabled) {
      scheduleTaskReminder(task)
        .then((notificationResult) => {
          const patch = {
            notificationId: notificationResult.notification_id || "",
            reminderScheduled: Boolean(notificationResult.reminder_scheduled),
            reminderStatus:
              notificationResult.reminder_status || "schedule_failed",
          };

          patchRecord(setTasks, task.id, patch);

          if (notificationResult.ok) {
            setNotificationPermissionStatus("connected");
            return;
          }

          if (notificationResult.reminder_status === "permission_denied") {
            setNotificationPermissionStatus("denied");
          }
          if (
            notificationResult.reminder_status !== "missing_date_time" &&
            notificationResult.reminder_status !== "skipped_past_due"
          ) {
            setDeviceIntegrationWarning(
              notificationResult.message ||
                "Task saved in EVA, but the reminder was not scheduled."
            );
          }
        })
        .catch((error) => {
          setDeviceIntegrationWarning(
            error?.message || "Task saved in EVA, but the reminder was not scheduled."
          );
        });
    }

    return task;
  }

  function updateTaskStatus(id, status) {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, status } : task))
    );

    if (isLocalRecordId(id, "task")) {
      return;
    }

    syncMutation(
      "task_status",
      () => updateSupabaseTask(id, { status }, currentUser.id),
      (data) => {
        if (data) {
          replaceRecord(setTasks, id, data);
        }
      }
    );
  }

  async function addMeeting(input) {
    const reminderMinutes = parseReminderMinutes(
      input.reminderMinutes || input.reminder_minutes || input.reminder,
      defaultMeetingReminderMinutes
    );
    const meeting = {
      id: makeLocalRecordId("meeting"),
      title: input.title || "Executive meeting",
      date: input.date || "Today",
      time: input.time || "10:00 AM",
      endTime: input.endTime || input.end_time || "",
      attendees: input.attendees || "Team",
      briefing: input.briefing || "EVA will prepare context before the meeting.",
      reminder: formatReminderLabel(reminderMinutes),
      reminderMinutes,
      status: input.status || "scheduled",
      deviceCalendarEventId: input.deviceCalendarEventId || "",
      calendarSyncEnabled: phoneCalendarSyncEnabled,
      calendarSyncStatus: phoneCalendarSyncEnabled ? "pending" : "off",
      calendarName: "",
      notificationId: "",
      reminderScheduled: false,
      reminderStatus: notificationEnabled ? "pending" : "off",
    };
    debugEvaFlow("meeting: before saving", meeting);
    setMeetings((current) => {
      const next = [meeting, ...current];
      debugEvaFlow("meeting: local state after creation", summarizeRecords(next));
      return next;
    });

    let activeMeeting = meeting;
    let activeId = meeting.id;
    let savedRemotely = false;

    if (remoteEnabled && currentUser?.id) {
      try {
        const saved = await createSupabaseMeeting(activeMeeting, currentUser.id);
        savedRemotely = true;
        activeMeeting = { ...activeMeeting, ...saved };
        activeId = saved.id;
        replaceRecord(setMeetings, meeting.id, activeMeeting);
        setSyncStatus("connected");
        setSyncWarning("");
        debugEvaFlow("meeting: Supabase save result", {
          ok: true,
          id: saved.id,
          title: saved.title,
        });
      } catch (error) {
        setSyncStatus("unavailable");
        setSyncWarning("Supabase sync paused. Local changes are safe.");
        setDeviceIntegrationWarning("Meeting is local until Supabase sync resumes.");
        debugEvaFlow("meeting: Supabase save result", {
          ok: false,
          message: error?.message || String(error),
        });
        console.warn("EVA Supabase sync failed.", error?.message || error);
      }
    }

    const devicePatch = await syncMeetingToDevice(activeMeeting, {
      calendarSyncEnabled: phoneCalendarSyncEnabled,
      notificationsEnabled: notificationEnabled,
    });

    if (Object.keys(devicePatch).length) {
      activeMeeting = { ...activeMeeting, ...devicePatch };
      patchRecord(setMeetings, activeId, devicePatch);

      if (savedRemotely) {
        syncMutation(
          "meeting_device_sync",
          () => updateSupabaseMeeting(activeId, devicePatch, currentUser.id),
          (data) => {
            if (data) {
              replaceRecord(setMeetings, activeId, data);
            }
          }
        );
      }
    }

    return activeMeeting;
  }

  async function syncMeetingToDevice(meeting, options = {}) {
    const patch = {};

    if (options.calendarSyncEnabled) {
      const calendarResult = await createDeviceCalendarEvent(meeting);
      patch.deviceCalendarEventId = calendarResult.device_calendar_event_id || "";
      patch.calendarSyncEnabled = true;
      patch.calendarSyncStatus = calendarResult.calendar_sync_status || "sync_failed";
      patch.calendarName = calendarResult.calendar_name || "";

      if (calendarResult.ok) {
        setCalendarPermissionStatus("connected");
        setDeviceIntegrationWarning("");
      } else {
        if (calendarResult.calendar_sync_status === "permission_denied") {
          setCalendarPermissionStatus("denied");
        }
        setDeviceIntegrationWarning(
          calendarResult.message ||
            "Meeting saved in EVA, but phone calendar sync did not complete."
        );
      }
    }

    if (options.notificationsEnabled) {
      const notificationResult = await scheduleMeetingReminder({
        ...meeting,
        ...patch,
      });
      patch.notificationId = notificationResult.notification_id || "";
      patch.reminderScheduled = Boolean(notificationResult.reminder_scheduled);
      patch.reminderStatus = notificationResult.reminder_status || "schedule_failed";

      if (notificationResult.ok) {
        setNotificationPermissionStatus("connected");
      } else {
        if (notificationResult.reminder_status === "permission_denied") {
          setNotificationPermissionStatus("denied");
        }
        setDeviceIntegrationWarning(
          notificationResult.message ||
            "Meeting saved in EVA, but the reminder was not scheduled."
        );
      }
    }

    return patch;
  }

  function deleteMeeting(id) {
    const target = meetings.find((m) => m.id === id);
    setMeetings((current) => current.filter((meeting) => meeting.id !== id));

    if (target?.notificationId) {
      cancelScheduledNotification(target.notificationId).catch(() => {});
    }
    if (target?.deviceCalendarEventId) {
      deleteDeviceCalendarEvent(target).catch(() => {});
    }
    if (remoteEnabled && currentUser?.id && !isLocalRecordId(id, "meeting")) {
      deleteSupabaseMeeting(id, currentUser.id).catch((error) => {
        console.warn("EVA Supabase meeting delete failed.", error?.message || error);
      });
    }
  }

  function rescheduleMeeting(id, input = {}) {
    const existing = meetings.find((meeting) => meeting.id === id);
    const updatedMeeting = existing
      ? {
          ...existing,
          date: input.date || existing.date,
          time: input.time || existing.time,
        }
      : null;

    setMeetings((current) =>
      current.map((meeting) =>
        meeting.id === id && updatedMeeting ? updatedMeeting : meeting
      )
    );

    if (updatedMeeting) {
      if (existing.notificationId && notificationEnabled) {
        cancelScheduledNotification(existing.notificationId)
          .then(() => scheduleMeetingReminder(updatedMeeting))
          .then((result) => {
            if (result.ok) {
              const notificationPatch = {
                notificationId: result.notification_id || "",
                reminderScheduled: Boolean(result.reminder_scheduled),
                reminderStatus: result.reminder_status || "scheduled",
              };
              patchRecord(setMeetings, id, notificationPatch);
              if (!isLocalRecordId(id, "meeting")) {
                syncMutation(
                  "meeting_notification_patch",
                  () => updateSupabaseMeeting(id, notificationPatch, currentUser.id),
                  () => {}
                );
              }
            }
          })
          .catch(() => {});
      }
      if (existing.deviceCalendarEventId) {
        updateDeviceCalendarEvent(updatedMeeting).catch(() => {});
      }
    }

    if (updatedMeeting && !isLocalRecordId(id, "meeting")) {
      syncMutation(
        "meeting_reschedule",
        () => updateSupabaseMeeting(id, updatedMeeting, currentUser.id),
        (data) => {
          if (data) {
            replaceRecord(setMeetings, id, data);
          }
        }
      );
    }

    return updatedMeeting;
  }

  function addDocument(input) {
    const document = {
      id: makeLocalRecordId("doc"),
      title: input.title || "New knowledge note",
      type: input.type || "Note",
      updatedAt: "Just now",
      content: input.content || "",
      summary:
        input.summary ||
        "EVA will use this note for summaries, briefings, and follow-up actions.",
    };
    setDocuments((current) => [document, ...current]);
    syncMutation(
      "document",
      () => createSupabaseDocument(document, currentUser.id),
      (data) => {
        if (data) {
          replaceRecord(setDocuments, document.id, data);
        }
      }
    );
    return document;
  }

  function addTranscript(input) {
    return addDocument({
      title: input.title || "Live meeting transcript",
      type: "Transcript",
      content: input.content || "",
      summary:
        input.summary ||
        "Transcript captured for EVA to summarize into briefings and follow-up actions.",
    });
  }

  function addReminder(input) {
    const reminder = {
      id: makeLocalRecordId("reminder"),
      title: input.title || "Executive reminder",
      due: input.due || "Today",
    };
    setReminders((current) => [reminder, ...current]);
    syncMutation(
      "reminder",
      () => createSupabaseReminder(reminder, currentUser.id),
      (data) => {
        if (data) {
          replaceRecord(setReminders, reminder.id, data);
        }
      }
    );

    if (notificationEnabled) {
      scheduleReminderNotification({
        ...reminder,
        details: reminder.title,
        reminder_time: input.reminder_time || input.time || "",
      })
        .then((notificationResult) => {
          if (notificationResult.ok) {
            setNotificationPermissionStatus("connected");
            patchRecord(setReminders, reminder.id, {
              notification_id: notificationResult.notification_id || "",
              reminder_status: notificationResult.reminder_status || "scheduled",
            });
            return;
          }

          if (notificationResult.reminder_status === "permission_denied") {
            setNotificationPermissionStatus("denied");
          }
          if (
            notificationResult.reminder_status !== "missing_date_time" &&
            notificationResult.reminder_status !== "skipped_past_due"
          ) {
            setDeviceIntegrationWarning(
              notificationResult.message ||
                "Reminder saved in EVA, but the notification was not scheduled."
            );
          }
        })
        .catch((error) => {
          setDeviceIntegrationWarning(
            error?.message ||
              "Reminder saved in EVA, but the notification was not scheduled."
          );
        });
    }

    return reminder;
  }

  async function handleAssistantCommand(rawText) {
    const content = rawText.trim();
    if (!content) {
      return "";
    }

    const messageId = makeLocalRecordId("message");
    const userMessage = { id: `${messageId}-user`, role: "user", content };
    const todayKey = getLocalDayKey();
    const isNewChatDay = chatDay !== todayKey;
    const recentMessages = isNewChatDay ? initialMessages : chatMessages;
    const targetChatId = isNewChatDay ? null : chatId;
    let reply;

    if (isNewChatDay) {
      setChatDay(todayKey);
      setChatId(null);
    }

    setChatMessages((current) => [
      ...(isNewChatDay ? initialMessages : current),
      userMessage,
    ]);
    setAssistantConnection({ backend: "checking", ai: "checking" });

    try {
      const response = await sendEvaAssistantCommand({
        userMessage: content,
        context: buildAssistantContext(),
        messages: [...recentMessages, userMessage]
          .slice(-12)
          .map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
      });

      debugEvaFlow("assistant: backend response", summarizeAssistantResponse(response));
      setAssistantConnection({
        backend: "connected",
        ai: response?.mode === "ai" ? "gemini" : "fallback",
      });
      reply = adaptAssistantReply(await applyAssistantRouteResult(response, content), {
        intent: response?.intent,
        action: response?.action,
      });
    } catch (error) {
      console.warn("EVA assistant backend unavailable. Using local preview logic.", error?.message || error);
      setAssistantConnection({ backend: "offline", ai: "fallback" });
      reply = adaptAssistantReply(await runLocalAssistantCommand(content), {
        intent: inferLocalActionType(content),
      });
    }

    const assistantMessage = {
      id: `${messageId}-eva`,
      role: "assistant",
      content: reply || "I understand. I have captured that in the preview flow.",
    };

    setChatMessages((current) => [...current, assistantMessage]);
    saveChatMessages([userMessage, assistantMessage], targetChatId);

    return assistantMessage.content;
  }

  async function runLocalAssistantCommand(content) {
    const lower = content.toLowerCase();
    let reply = "I understand. I have captured that in the preview flow.";

    if (/remind|reminder|alarm/.test(lower)) {
      const reminderTitle = extractReminderTitle(content);
      if (!reminderTitle) {
        reply = "Sure. What should I remind you about?";
      } else {
        const reminder = addReminder({
          title: reminderTitle,
          due: extractDueDate(content),
        });
        reply = `Reminder set: ${reminder.title}, ${reminder.due}.`;
      }
    } else if (isScheduleQuestion(lower)) {
      const nextMeeting = meetings[0];
      reply = nextMeeting
        ? `You have ${meetings.length} meeting${meetings.length === 1 ? "" : "s"} in EVA. The next one is ${nextMeeting.title} at ${nextMeeting.time}.`
        : "I do not see a meeting scheduled in EVA yet.";
    } else if (isPendingTasksQuestion(lower)) {
      const pendingTasks = tasks.filter((task) => task.status !== "Done");
      reply = pendingTasks.length
        ? `${pendingTasks.length} task${pendingTasks.length === 1 ? "" : "s"} need attention. Start with ${pendingTasks[0].title}.`
        : "Your EVA task list is clear right now.";
    } else if (/summari[sz]e|summary|notes|document|knowledge/.test(lower)) {
      const latest = documents[0];
      reply = latest
        ? `Summary of "${latest.title}": ${latest.summary}`
        : "There are no notes yet. Add a document or paste notes into Knowledge first.";
    } else if (/brief|briefing|prepare my next move|next move/.test(lower)) {
      const nextMeeting = meetings[0];
      const highTasks = tasks.filter((task) => task.priority === "High");
      reply = nextMeeting
        ? `Briefing focus for ${nextMeeting.title}: confirm the outcome, decisions needed, open risks, and follow-up owner. Then clear ${highTasks.length || 1} high-priority action.`
        : "I do not see a next meeting yet. Add the meeting first and I will prepare a briefing around it.";
    } else if (/reschedule|move|shift/.test(lower)) {
      const target = meetings[0];
      if (target) {
        const updated = rescheduleMeeting(target.id, {
          date: extractMeetingDate(content),
          time: extractTime(content, "2:00 PM"),
        });
        reply = `I rescheduled "${updated.title}" to ${updated.date} at ${updated.time}.`;
      } else {
        reply = "There is no meeting to reschedule yet. Ask me to create one first.";
      }
    } else if (isTaskIntent(lower)) {
      const taskTitle = extractTaskTitle(content);
      if (!taskTitle) {
        reply = "Sure. What task should I create?";
      } else {
        const task = addTask({
          title: taskTitle,
          detail: content,
          priority: extractPriority(lower),
          due: extractDueDate(content),
        });
        reply = `Done. I created the task "${task.title}" with ${task.priority.toLowerCase()} priority, due ${task.due}.`;
      }
    } else if (isMeetingIntent(lower)) {
      const meetingTime = extractTime(content, "");
      const attendees = extractAttendees(content);
      if (!meetingTime) {
        reply = `Sure. What time should I schedule the meeting${attendees && attendees !== "Team" ? ` with ${attendees}` : ""}?`;
      } else {
        const meeting = await addMeeting({
          title: extractMeetingTitle(content),
          date: extractMeetingDate(content),
          time: meetingTime,
          attendees,
          reminder: extractReminder(content),
        });
        reply = formatMeetingCreationReply(
          `Meeting created: ${meeting.title}, ${meeting.date} at ${meeting.time}.`,
          meeting
        );
      }
    } else if (/question|what is|how do|explain|ask/.test(lower)) {
      reply =
        "Here is the clean answer: EVA can reason through your command, then turn it into tasks, meetings, reminders, summaries, or briefings in this preview.";
    }

    return reply;
  }

  async function applyAssistantRouteResult(response, content) {
    const intent = String(response?.intent || "").toLowerCase();
    const action = response?.action;
    const actionType = normalizeAssistantActionType(action?.type || intent);
    const fallbackReply =
      response?.reply || "I understand. I have captured that in the EVA command flow.";

    debugEvaFlow("assistant: detected action", {
      intent,
      actionType,
      rawActionType: action?.type,
    });

    if (!action) {
      return fallbackReply;
    }

    if (actionType === "create_task" || actionType === "create_follow_up_action") {
      const title = action.title || extractTaskTitle(content);
      if (!title) {
        return response?.reply || "Sure. What task should I create?";
      }

      const task = addTask({
        title,
        detail: action.details || action.detail || content,
        priority: displayPriorityFromAction(action.priority),
        due: formatAssistantActionDate(action.due_date || action.due || action.due_at),
      });

      return (
        response?.reply ||
        `Done. I created the task "${task.title}" with ${task.priority.toLowerCase()} priority, due ${task.due}.`
      );
    }

    if (actionType === "create_meeting") {
      const startTime =
        action.start_time ||
        action.startTime ||
        action.time ||
        action.starts_at ||
        action.startsAt;

      if (!startTime) {
        return fallbackReply || "Sure. What time should I schedule the meeting?";
      }

      const durationMinutes =
        action.duration_minutes || action.durationMinutes || action.duration || 30;
      const rawTitle = String(action.title || action.meeting_title || "").trim();
      const meeting = await addMeeting({
        title: isGenericMeetingTitle(rawTitle) ? (extractMeetingTitle(content) || "Meeting") : rawTitle,
        date: formatAssistantActionDate(
          action.meeting_date || action.meetingDate || action.date || action.day
        ),
        time: formatAssistantActionTime(startTime),
        attendees:
          formatAssistantAttendees(
            action.attendees || action.participants || action.invitees
          ) || extractAttendees(content),
        briefing:
          action.agenda ||
          action.briefing ||
          action.details ||
          `${durationMinutes}-minute meeting created by EVA.`,
        reminder: formatAssistantReminder(
          action.reminder_minutes ||
            action.reminderMinutes ||
            action.reminder_minutes_before ||
            action.reminderMinutesBefore
        ),
      });

      return (
        formatMeetingCreationReply(response?.reply, meeting) ||
        `Meeting created: ${meeting.title}, ${meeting.date} at ${meeting.time}.`
      );
    }

    if (actionType === "create_reminder") {
      const title = action.title || extractReminderTitle(content);
      if (!title) {
        return response?.reply || "Sure. What should I remind you about?";
      }

      const reminder = addReminder({
        title,
        due: formatAssistantActionDate(action.reminder_time || action.due_date || action.due),
      });

      return response?.reply || `Reminder set: ${reminder.title}, ${reminder.due}.`;
    }

    if (actionType === "reschedule_meeting") {
      const target = findMeetingForAction(action) || meetings[0];
      if (!target) {
        return "There is no meeting to reschedule yet. Ask me to create one first.";
      }

      const updated = rescheduleMeeting(target.id, {
        date: formatAssistantActionDate(action.meeting_date || action.date),
        time: formatAssistantActionTime(action.start_time || action.time),
      });

      return (
        response?.reply ||
        `I rescheduled "${updated.title}" to ${updated.date} at ${updated.time}.`
      );
    }

    return fallbackReply;
  }

  function buildAssistantContext() {
    return {
      mode: remoteEnabled ? "supabase_connected" : "local_mode",
      appStatus: syncStatus,
      syncWarning,
      profile,
      aiBehavior,
      voiceMode,
      notificationsEnabled: notificationEnabled,
      phoneCalendarSyncEnabled,
      defaultMeetingReminderMinutes,
      calendarPermissionStatus,
      notificationPermissionStatus,
      microphonePermissionStatus,
      deepgramConnectionStatus,
      tasks: tasks.slice(0, 10).map(({ title, priority, status, due }) => ({
        title,
        priority,
        status,
        due,
      })),
      meetings: meetings.slice(0, 10).map(({ title, date, time, attendees }) => ({
        title,
        date,
        time,
        attendees,
      })),
      reminders: reminders.slice(0, 10).map(({ title, due }) => ({
        title,
        due,
      })),
      documents: documents.slice(0, 5).map(({ title, type, summary }) => ({
        title,
        type,
        summary,
      })),
    };
  }

  function adaptAssistantReply(reply, result = {}) {
    const text = String(reply || "").trim();
    const actionType = String(result?.action?.type || result?.intent || "").toLowerCase();

    if (aiBehavior === "concise") {
      return makeConciseReply(text);
    }

    if (aiBehavior === "proactive") {
      return makeProactiveReply(text, actionType);
    }

    return text || "Captured. I will keep this aligned with your executive workflow.";
  }

  function findMeetingForAction(action) {
    const title = String(action?.title || action?.meeting_title || "").toLowerCase();
    if (!title) {
      return null;
    }

    return (
      meetings.find((meeting) => meeting.title.toLowerCase().includes(title)) ||
      null
    );
  }

  function showVoiceModeComingSoon() {
    const messageId = makeLocalRecordId("voice");
    const selectedVoice =
      voiceModeOptions.find((option) => option.id === voiceMode)?.label || "Calm";
    const reply =
      `Voice replies are active. EVA will answer voice commands with the ${selectedVoice} speaking style.`;

    const assistantMessage = {
      id: messageId,
      role: "assistant",
      content: reply,
    };

    setChatMessages((current) => [...current, assistantMessage]);
    saveChatMessages([assistantMessage]);

    return reply;
  }

  const value = {
    assistantPrompts,
    authLoading,
    authError,
    authStatus: getAuthStatus({
      authLoading,
      configured: isEvaSupabaseConfigured,
      currentUser,
      localPreviewUnlocked,
    }),
    currentUser,
    session,
    localPreviewUnlocked,
    accountEmail: currentUser?.email || "",
    signIn,
    signUp,
    signOut,
    resetPassword,
    continueLocalPreview,
    theme,
    themeMode,
    aiBehavior,
    aiBehaviorOptions,
    voiceMode,
    voiceModeOptions,
    notificationEnabled,
    phoneCalendarSyncEnabled,
    defaultMeetingReminderMinutes,
    calendarPermissionStatus,
    notificationPermissionStatus,
    microphonePermissionStatus,
    deepgramConnectionStatus,
    deviceIntegrationWarning,
    profile,
    remoteEnabled,
    assistantConnection,
    syncStatus,
    syncWarning,
    toggleThemeMode,
    setAiBehavior,
    setVoiceMode,
    toggleNotifications,
    togglePhoneCalendarSync,
    testCalendarPermission,
    testMicrophonePermission,
    requestPostTutorialPermissions,
    sendTestNotification,
    createTestCalendarEvent,
    setDefaultMeetingReminderMinutes,
    clearLocalPreviewData,
    updateProfile,
    tasks,
    activeTasks,
    completedTasks,
    meetings,
    documents,
    reminders,
    chatMessages,
    addTask,
    updateTaskStatus,
    addMeeting,
    rescheduleMeeting,
    deleteMeeting,
    addDocument,
    addTranscript,
    addReminder,
    handleAssistantCommand,
    addAssistantNotice,
    updateVoiceIntegrationStatus,
    showVoiceModeComingSoon,
  };

  return <EVAAppContext.Provider value={value}>{children}</EVAAppContext.Provider>;
}

export function useEVAApp() {
  const context = useContext(EVAAppContext);
  if (!context) {
    throw new Error("useEVAApp must be used within EVAAppProvider");
  }
  return context;
}

function replaceRecord(setter, id, nextRecord) {
  setter((current) =>
    current.map((record) => (record.id === id ? nextRecord : record))
  );
}

function patchRecord(setter, id, patch) {
  setter((current) =>
    current.map((record) => (record.id === id ? { ...record, ...patch } : record))
  );
}

function getAuthStatus({
  authLoading,
  configured,
  currentUser,
  localPreviewUnlocked,
}) {
  if (localPreviewUnlocked) {
    return "local_preview";
  }
  if (!configured) {
    return "unconfigured";
  }
  if (authLoading) {
    return "checking";
  }
  if (currentUser?.id) {
    return "signed_in";
  }
  return "signed_out";
}

function getProfileFallback(user) {
  const metadataName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0];
  const safeName = cleanProfileName(metadataName);

  return {
    fullName: safeName ? capitalizeTitle(safeName) : defaultProfile.fullName,
    role: "EVA workspace owner",
  };
}

function resolveLoadedProfile(profile, user) {
  const fallback = getProfileFallback(user);
  const loadedName = cleanProfileName(profile?.fullName);
  const loadedRole = cleanProfileName(profile?.role);
  const legacyDefaultForAnotherUser =
    /^ronald roland$/i.test(loadedName) &&
    fallback.fullName &&
    !/^ronald roland$/i.test(fallback.fullName);

  return {
    fullName:
      loadedName && !legacyDefaultForAnotherUser
        ? loadedName
        : fallback.fullName,
    role: loadedRole || fallback.role,
  };
}

function cleanProfileName(value) {
  return String(value || "")
    .replace(/[_+.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function mergeRemoteWithPendingLocal(remoteRecords, currentRecords, initialIds) {
  const remote = Array.isArray(remoteRecords) ? remoteRecords : [];
  const seen = new Set(remote.map((record) => String(record.id)));
  const pendingLocal = (Array.isArray(currentRecords) ? currentRecords : []).filter(
    (record) =>
      record?.id &&
      !initialIds.has(record.id) &&
      !seen.has(String(record.id)) &&
      isPendingLocalRecordId(record.id)
  );

  return [...pendingLocal, ...remote];
}

function normalizeAssistantActionType(value) {
  const type = String(value || "").trim().toLowerCase();
  const aliases = {
    schedule_meeting: "create_meeting",
    scheduled_meeting: "create_meeting",
    book_meeting: "create_meeting",
    add_meeting: "create_meeting",
    create_calendar_event: "create_meeting",
    schedule_calendar_event: "create_meeting",
    calendar_event: "create_meeting",
    create_appointment: "create_meeting",
    schedule_appointment: "create_meeting",
    add_task: "create_task",
    schedule_task: "create_task",
    add_reminder: "create_reminder",
    set_reminder: "create_reminder",
    schedule_reminder: "create_reminder",
  };

  return aliases[type] || type;
}

function debugEvaFlow(label, payload = {}) {
  if (!DEBUG_EVA_FLOW) {
    return;
  }

  console.log(`[EVA debug] ${label}`, payload);
}

function summarizeAssistantResponse(response) {
  return {
    mode: response?.mode,
    intent: response?.intent,
    reply: response?.reply,
    actionType: response?.action?.type,
    actionTitle: response?.action?.title,
    meetingDate: response?.action?.meeting_date || response?.action?.date,
    startTime: response?.action?.start_time || response?.action?.time,
    durationMinutes: response?.action?.duration_minutes,
    attendees: response?.action?.attendees,
  };
}

function summarizeRecords(records) {
  return {
    count: records.length,
    latest: records[0]
      ? {
          id: records[0].id,
          title: records[0].title,
          date: records[0].date,
          time: records[0].time,
        }
      : null,
  };
}

function isLocalRecordId(id, prefix) {
  return String(id || "").startsWith(`${prefix}-`);
}

function isPendingLocalRecordId(id) {
  return /^(task|meeting|reminder|doc|message|voice)-/.test(String(id || ""));
}

function makeLocalRecordId(prefix) {
  return `${prefix}-${Date.now()}`;
}

function getLocalDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function makeConciseReply(reply) {
  const text = String(reply || "").trim();
  if (!text) {
    return "Done.";
  }

  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map((item) => item.trim()) || [];
  const firstSentence = sentences[0];
  if (!firstSentence) {
    return text.length > 110 ? `${text.slice(0, 107).trim()}...` : text;
  }

  const usefulSentence =
    /^(done|sure|okay|ok)\.?$/i.test(firstSentence) && sentences[1]
      ? `${firstSentence} ${sentences[1]}`
      : firstSentence;

  return usefulSentence.length > 150
    ? `${usefulSentence.slice(0, 147).trim()}...`
    : usefulSentence;
}

function makeProactiveReply(reply, actionType) {
  const text = String(reply || "").trim() || "Done.";
  const suggestion = proactiveSuggestionFor(actionType);

  if (!suggestion || text.includes("Recommended next move")) {
    return text;
  }

  return `${text}\n\nRecommended next move: ${suggestion}`;
}

function proactiveSuggestionFor(actionType) {
  switch (actionType) {
    case "create_task":
    case "create_follow_up_action":
      return "assign an owner and add a reminder so this does not sit unattended.";
    case "create_meeting":
      return "add a short agenda and confirm who owns the follow-up after the meeting.";
    case "create_reminder":
      return "connect this reminder to a task or meeting if it belongs to a larger outcome.";
    case "prepare_meeting_briefing":
      return "review risks, decisions needed, and the one outcome you want from the meeting.";
    case "show_today_schedule":
      return "protect one open block for preparation before your highest-stakes meeting.";
    case "show_pending_tasks":
      return "clear or delegate the highest-priority open task first.";
    default:
      return "";
  }
}

function inferLocalActionType(text) {
  const lower = String(text || "").toLowerCase();
  if (/\b(remind|reminder|alarm)\b/.test(lower)) {
    return "create_reminder";
  }
  if (isScheduleQuestion(lower)) {
    return "show_today_schedule";
  }
  if (isPendingTasksQuestion(lower)) {
    return "show_pending_tasks";
  }
  if (/\b(summarize|summary|notes|knowledge|document)\b/.test(lower)) {
    return "summarize_notes";
  }
  if (/\b(brief|briefing|prepare my next move|next move)\b/.test(lower)) {
    return "prepare_meeting_briefing";
  }
  if (/\b(reschedule|move|shift)\b/.test(lower)) {
    return "reschedule_meeting";
  }
  if (isTaskIntent(lower)) {
    return /\bfollow[-\s]?up|follow up\b/.test(lower)
      ? "create_follow_up_action"
      : "create_task";
  }
  if (isMeetingIntent(lower)) {
    return "create_meeting";
  }
  return "general_question";
}

function isTaskIntent(text) {
  return /\b(task|todo|to-do|follow-up|follow up|action item|action)\b/.test(text);
}

function isMeetingIntent(text) {
  return /\b(meeting|schedule|calendar|appointment|sync)\b/.test(text);
}

function isScheduleQuestion(text) {
  return (
    /\b(meetings?|schedule|calendar|appointments?)\b/.test(text) &&
    /\b(what|which|show|list|today|do i have|have i got)\b/.test(text) &&
    !/\b(create|add|book|set up|schedule a|schedule the)\b/.test(text)
  );
}

function isPendingTasksQuestion(text) {
  return (
    /\b(tasks?|todos?|to-dos?|action items?|follow[-\s]?ups?)\b/.test(text) &&
    /\b(what|which|show|list|pending|open|blocked|overdue|attention)\b/.test(text) &&
    !/\b(create|add|make|set)\b/.test(text)
  );
}

function extractPriority(text) {
  if (/\b(high|urgent|critical)\b/.test(text)) {
    return "High";
  }
  if (/\b(low|minor)\b/.test(text)) {
    return "Low";
  }
  return "Medium";
}

function extractDueDate(text) {
  const lower = text.toLowerCase();
  const dayMatch = lower.match(/\b(?:on|by|due)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (dayMatch) {
    const month = new Date().toLocaleString([], { month: "short" });
    return `${month} ${dayMatch[1]}`;
  }
  if (/\btomorrow\b/.test(lower)) {
    return "Tomorrow";
  }
  if (/\btoday\b/.test(lower)) {
    return "Today";
  }
  if (/\bnext week\b/.test(lower)) {
    return "Next week";
  }
  return "Today";
}

function extractTime(text, fallback = "10:00 AM") {
  const match =
    text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\b/i) ||
    text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/i) ||
    text.match(/\b(\d{1,2}):(\d{2})\b/i);

  if (!match) {
    return fallback;
  }
  const hour = Number(match[1]);
  if (hour > 24) {
    return fallback;
  }
  const minutes = match[2] || "00";
  const period = (match[3] || (hour >= 8 && hour <= 11 ? "AM" : "PM"))
    .replace(/\./g, "")
    .toUpperCase();
  const normalizedHour = hour > 12 ? hour - 12 : hour;
  return `${normalizedHour}:${minutes} ${period}`;
}

function extractReminder(text) {
  const match = text.toLowerCase().match(/\b(\d{1,3})\s*(minute|minutes|min|mins|hour|hours)\s+before\b/);
  if (!match) {
    return "15 minutes before";
  }
  const unit = match[2].startsWith("hour") ? "hour" : "minute";
  const plural = Number(match[1]) === 1 ? unit : `${unit}s`;
  return `${match[1]} ${plural} before`;
}

function displayPriorityFromAction(value) {
  const priority = String(value || "").toLowerCase();
  if (priority === "high" || priority === "urgent" || priority === "critical") {
    return "High";
  }
  if (priority === "low") {
    return "Low";
  }
  return "Medium";
}

function formatAssistantActionDate(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "Today";
  }

  const lower = text.toLowerCase();
  if (lower === "today") {
    return "Today";
  }
  if (lower === "tomorrow") {
    return "Tomorrow";
  }
  if (lower === "next week") {
    return "Next week";
  }

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatAssistantActionTime(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "10:00 AM";
  }

  const twentyFourHour = text.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = twentyFourHour[2];
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute} ${period}`;
  }

  return text.toUpperCase().replace(/\./g, "");
}

function formatAssistantAttendees(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
  }

  return String(value || "").trim();
}

function formatAssistantReminder(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "15 minutes before";
  }

  const unit = minutes === 1 ? "minute" : "minutes";
  return `${minutes} ${unit} before`;
}

function parseReminderMinutes(value, fallback = 15) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const match = String(value || "").match(/(\d{1,4})/);
  return match ? Number(match[1]) : fallback;
}

function formatReminderLabel(minutes) {
  const value = Number.isFinite(Number(minutes)) ? Number(minutes) : 15;
  const unit = value === 1 ? "minute" : "minutes";
  return `${value} ${unit} before`;
}

function formatMeetingCreationReply(baseReply, meeting = {}) {
  const text = String(baseReply || "").trim();

  if (meeting.calendarSyncEnabled) {
    if (meeting.calendarSyncStatus === "synced") {
      return "Done. I created the meeting in EVA and added it to your phone calendar.";
    }

    if (meeting.calendarSyncStatus === "permission_denied") {
      return "I created the meeting in EVA, but calendar access was not granted, so I could not add it to your phone calendar.";
    }

    if (meeting.calendarSyncStatus && meeting.calendarSyncStatus !== "pending") {
      return `${text || "Meeting created in EVA."} Phone calendar sync did not complete.`;
    }
  }

  return text || "Meeting created in EVA.";
}

function permissionStatusLabel(permission = {}) {
  if (permission.granted) {
    return "connected";
  }
  if (permission.status === "denied") {
    return "denied";
  }
  if (permission.status === "unavailable") {
    return "unavailable";
  }
  return "not_connected";
}

function extractTaskTitle(text) {
  const cleaned = text
    .replace(/^(please\s+)?(create|add|make|set)\s+(a\s+)?(task|todo|to-do|follow-up|follow up|action item)\s*(for|to)?\s*/i, "")
    .replace(/\b(today|tomorrow|next week)\b/gi, "")
    .replace(/\b(?:by|due|on)\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\b/gi, "")
    .trim();
  return cleaned ? capitalizeTitle(cleaned) : "";
}

function extractMeetingTitle(text) {
  const withMatch = text.match(/\bmeeting\s+with\s+(.+?)(?:\s+on|\s+at|\s+by|\s+for|,|$)/i);
  if (withMatch) {
    const name = stripMeetingDateWords(withMatch[1].trim());
    if (name) return `Meeting with ${capitalizeTitle(name)}`;
  }
  const scheduleWith = text.match(/\b(?:schedule|set up|book|create)\s+.*?\bwith\s+(.+?)(?:\s+on|\s+at|\s+by|,|$)/i);
  if (scheduleWith) {
    const name = stripMeetingDateWords(scheduleWith[1].trim());
    if (name) return `Meeting with ${capitalizeTitle(name)}`;
  }
  return "";
}

function stripMeetingDateWords(name) {
  return name
    .replace(/\b(today|tomorrow|next\s+week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericMeetingTitle(title) {
  return !title || /^(executive|team|new|a|the)\s+meeting$/i.test(title.trim());
}

function extractMeetingDate(text) {
  const lower = text.toLowerCase();
  if (/\btomorrow\b/.test(lower)) {
    return "Tomorrow";
  }
  if (/\btoday\b/.test(lower)) {
    return "Today";
  }
  const dayMatch = lower.match(/\b(?:on|for)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (dayMatch) {
    const month = new Date().toLocaleString([], { month: "short" });
    return `${month} ${dayMatch[1]}`;
  }
  return "Today";
}

function extractAttendees(text) {
  const match = text.match(/\bwith\s+(.+?)(?:\s+on|\s+at|\s+by|$)/i);
  const name = match?.[1]?.trim();
  return name ? (stripMeetingDateWords(name) || "Team") : "Team";
}

function extractReminderTitle(text) {
  const cleaned = text
    .replace(/^(please\s+)?remind\s+me\s+(to|about)\s*/i, "")
    .replace(/^(please\s+)?(set|create|add)\s+(a\s+)?(reminder|alarm)\s*(for|to)?\s*/i, "")
    .trim();
  return cleaned ? capitalizeTitle(cleaned) : "";
}

function capitalizeTitle(text) {
  const cleaned = String(text || "").trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "";
}
