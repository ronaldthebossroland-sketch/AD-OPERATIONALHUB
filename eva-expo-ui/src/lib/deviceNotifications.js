import { Platform } from "react-native";
import * as Device from "expo-device";
import {
  isExpoGoRuntime,
  requestNotificationPermissions,
} from "./devicePermissions";
import {
  parseMeetingReminderMinutes,
  parseTaskReminderDate,
  resolveMeetingDateRange,
} from "./meetingDateTime";

export const EVA_REMINDERS_CHANNEL_ID = "eva-reminders-v2";
const EXPO_GO_NOTIFICATION_MESSAGE =
  "Notifications need a development build on Android. EVA still saves your items in Expo Go.";
let notificationHandlerReady = false;

// Register the foreground notification handler as early as possible so it is
// in place before any notification response event fires (e.g. cold-start tap).
if (!isExpoGoRuntime()) {
  import("expo-notifications")
    .then((Notifications) => {
      if (!notificationHandlerReady) {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        notificationHandlerReady = true;
      }
    })
    .catch(() => {});
}

export async function ensureEvaReminderChannel() {
  if (Platform.OS !== "android") {
    return null;
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return null;
  }

  try {
    return Notifications.setNotificationChannelAsync(EVA_REMINDERS_CHANNEL_ID, {
      name: "EVA Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400, 200, 400],
      lightColor: "#38BDF8",
      sound: "eva_reminder_chime.wav",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      showBadge: false,
    });
  } catch (error) {
    console.warn("EVA notification channel unavailable.", error?.message || error);
    return null;
  }
}

export { requestNotificationPermissions };

export async function scheduleMeetingReminder(meeting) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return notificationFailure("unavailable", EXPO_GO_NOTIFICATION_MESSAGE);
  }

  const permission = await requestNotificationPermissions();

  if (!permission.granted) {
    return notificationFailure(
      permission.status === "denied" ? "permission_denied" : "permission_required",
      "Notification access was not granted."
    );
  }

  const range = resolveMeetingDateRange(meeting);
  if (!range) {
    return notificationFailure("missing_date_time", "Meeting date or time is missing.");
  }

  const reminderMinutes = parseMeetingReminderMinutes(meeting, 15);
  if (reminderMinutes <= 0) {
    return {
      ok: true,
      notification_id: "",
      reminder_scheduled: false,
      reminder_status: "not_requested",
    };
  }

  const triggerAt = new Date(range.startDate);
  triggerAt.setMinutes(triggerAt.getMinutes() - reminderMinutes);

  if (triggerAt <= new Date()) {
    return notificationFailure(
      "skipped_past_due",
      "Reminder time is already in the past."
    );
  }

  try {
    await ensureEvaReminderChannel();
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Upcoming meeting: ${meeting.title || "EVA meeting"}`,
        body: `${meeting.time || ""} ${meeting.attendees ? `with ${meeting.attendees}` : ""}`.trim(),
        sound: "eva_reminder_chime.wav",
        data: {
          type: "meeting",
          meetingId: meeting.id,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerAt,
        channelId: EVA_REMINDERS_CHANNEL_ID,
      },
    });

    return {
      ok: true,
      notification_id: notificationId,
      reminder_scheduled: true,
      reminder_status: Device.isDevice ? "scheduled" : "scheduled_in_preview",
    };
  } catch (error) {
    return notificationFailure(
      "schedule_failed",
      error?.message || "Could not schedule the meeting reminder."
    );
  }
}

export async function scheduleTaskReminder(task) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return notificationFailure("unavailable", EXPO_GO_NOTIFICATION_MESSAGE);
  }

  const permission = await requestNotificationPermissions();

  if (!permission.granted) {
    return notificationFailure(
      permission.status === "denied" ? "permission_denied" : "permission_required",
      "Notification access was not granted."
    );
  }

  const triggerAt = parseTaskReminderDate(task);
  if (!triggerAt) {
    return notificationFailure("missing_date_time", "Task due date is missing.");
  }

  if (triggerAt <= new Date()) {
    return notificationFailure("skipped_past_due", "Reminder time is already in the past.");
  }

  try {
    await ensureEvaReminderChannel();
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Task reminder: ${task.title || "EVA task"}`,
        body: task.detail || "This task needs attention.",
        sound: "eva_reminder_chime.wav",
        data: {
          type: "task",
          taskId: task.id,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerAt,
        channelId: EVA_REMINDERS_CHANNEL_ID,
      },
    });

    return {
      ok: true,
      notification_id: notificationId,
      reminder_scheduled: true,
      reminder_status: Device.isDevice ? "scheduled" : "scheduled_in_preview",
    };
  } catch (error) {
    return notificationFailure(
      "schedule_failed",
      error?.message || "Could not schedule the task reminder."
    );
  }
}

export async function scheduleTestNotification() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return notificationFailure("unavailable", EXPO_GO_NOTIFICATION_MESSAGE);
  }

  const permission = await requestNotificationPermissions();

  if (!permission.granted) {
    return notificationFailure(
      permission.status === "denied" ? "permission_denied" : "permission_required",
      "Notification access was not granted."
    );
  }

  try {
    await ensureEvaReminderChannel();
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "EVA Reminders",
        body: "Test notification received.",
        sound: "eva_reminder_chime.wav",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        channelId: EVA_REMINDERS_CHANNEL_ID,
      },
    });

    return {
      ok: true,
      notification_id: notificationId,
      reminder_scheduled: true,
      reminder_status: Device.isDevice ? "scheduled" : "scheduled_in_preview",
    };
  } catch (error) {
    return notificationFailure(
      "schedule_failed",
      error?.message || "Could not schedule the test notification."
    );
  }
}

export async function scheduleReminderNotification(reminder) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return notificationFailure("unavailable", EXPO_GO_NOTIFICATION_MESSAGE);
  }

  const permission = await requestNotificationPermissions();
  if (!permission.granted) {
    return notificationFailure(
      !permission.canAskAgain ? "permission_denied" : "permission_required",
      "Notification access was not granted."
    );
  }

  let triggerAt = null;
  if (reminder.reminder_time) {
    const parsed = new Date(reminder.reminder_time);
    if (!isNaN(parsed.getTime())) triggerAt = parsed;
  }
  if (!triggerAt) {
    triggerAt = parseTaskReminderDate(reminder);
  }

  if (!triggerAt) {
    return notificationFailure("missing_date_time", "Reminder time is missing or could not be parsed.");
  }

  const msUntilTrigger = triggerAt.getTime() - Date.now();
  if (msUntilTrigger <= 0) {
    return notificationFailure("skipped_past_due", "Reminder time is already in the past.");
  }
  if (msUntilTrigger < 90 * 1000) {
    // Too close for reliable Android delivery — push to 2 minutes from now
    triggerAt = new Date(Date.now() + 120 * 1000);
  } else {
    // Shift 45 seconds early to absorb Android inexact-alarm delivery jitter
    triggerAt = new Date(triggerAt.getTime() - 45 * 1000);
  }

  try {
    await ensureEvaReminderChannel();
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `EVA Reminder: ${reminder.title || "Reminder"}`,
        body: reminder.details || reminder.detail || "This reminder needs your attention.",
        sound: "eva_reminder_chime.wav",
        data: {
          type: "reminder",
          reminderId: reminder.id,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerAt,
        channelId: EVA_REMINDERS_CHANNEL_ID,
      },
    });

    return {
      ok: true,
      notification_id: notificationId,
      reminder_scheduled: true,
      reminder_status: Device.isDevice ? "scheduled" : "scheduled_in_preview",
    };
  } catch (error) {
    return notificationFailure(
      "schedule_failed",
      error?.message || "Could not schedule the reminder notification."
    );
  }
}

export async function addNotificationResponseListener(handler) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return () => {};
  const subscription = Notifications.addNotificationResponseReceivedListener(handler);
  return () => subscription.remove();
}

export async function cancelScheduledNotification(notificationId) {
  if (!notificationId) {
    return { ok: true };
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return { ok: true };
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error?.message || "Could not cancel the scheduled notification.",
    };
  }
}

async function getNotificationsModule() {
  if (isExpoGoRuntime()) {
    return null;
  }

  try {
    const Notifications = await import("expo-notifications");
    if (!notificationHandlerReady) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      notificationHandlerReady = true;
    }
    return Notifications;
  } catch (error) {
    console.warn("EVA notifications are unavailable.", error?.message || error);
    return null;
  }
}

function notificationFailure(status, message = "") {
  return {
    ok: false,
    notification_id: "",
    reminder_scheduled: false,
    reminder_status: status || "schedule_failed",
    message,
  };
}
