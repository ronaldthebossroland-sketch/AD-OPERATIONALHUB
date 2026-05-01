import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const NativeAlarm = registerPlugin("NativeAlarm");

const REMINDER_CHANNEL_ID = "executive-reminders";
const REMINDER_NOTIFICATION_BASE_ID = 200000;
const PHONE_ALARM_WINDOW_MS = 24 * 60 * 60 * 1000;

let channelReady = false;
let permissionRequest = null;
const nativeAlarmAttempts = new Set();

function isNativeApp() {
  return Capacitor.isNativePlatform();
}

function reminderNotificationId(reminder) {
  const source = String(reminder?.id || reminder?.title || reminder?.due_at || "");
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return REMINDER_NOTIFICATION_BASE_ID + (hash % 800000);
}

function isCompletedReminder(reminder) {
  return ["completed", "done", "resolved", "closed"].includes(
    String(reminder?.status || "").toLowerCase()
  );
}

function reminderDueDate(reminder) {
  for (const value of [
    reminder?.due_at,
    reminder?.dueAt,
    reminder?.start_at,
    reminder?.startAt,
    reminder?.reminder_time,
  ]) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function shouldScheduleReminder(reminder) {
  const dueDate = reminderDueDate(reminder);

  return Boolean(
    dueDate &&
      dueDate.getTime() > Date.now() + 15_000 &&
      !isCompletedReminder(reminder)
  );
}

async function ensureReminderChannel() {
  if (channelReady || !isNativeApp()) {
    return;
  }

  try {
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: "Executive Reminders",
      description: "Meeting reminders, alarms, and executive follow-ups.",
      importance: 5,
      visibility: 1,
      lights: true,
      lightColor: "#D8AF55",
      vibration: true,
    });
  } finally {
    channelReady = true;
  }
}

export async function ensureNotificationPermissions() {
  if (!isNativeApp()) {
    return { display: "web" };
  }

  if (!permissionRequest) {
    permissionRequest = (async () => {
      let permissions = await LocalNotifications.checkPermissions();

      if (permissions.display !== "granted") {
        permissions = await LocalNotifications.requestPermissions();
      }

      await ensureReminderChannel();

      return permissions;
    })().finally(() => {
      permissionRequest = null;
    });
  }

  return permissionRequest;
}

async function cancelReminderNotification(reminder) {
  if (!isNativeApp() || !reminder) {
    return;
  }

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: reminderNotificationId(reminder) }],
    });
  } catch (error) {
    console.warn("Could not cancel reminder notification:", error);
  }
}

async function setNativePhoneAlarm(reminder, dueDate) {
  if (!isNativeApp() || !dueDate) {
    return { scheduled: false };
  }

  const msUntilDue = dueDate.getTime() - Date.now();

  if (msUntilDue <= 15_000 || msUntilDue > PHONE_ALARM_WINDOW_MS) {
    return { scheduled: false };
  }

  const key = `${reminder?.id || reminder?.title || dueDate.toISOString()}-${dueDate.toISOString()}`;

  if (nativeAlarmAttempts.has(key)) {
    return { scheduled: false };
  }

  nativeAlarmAttempts.add(key);

  try {
    return await NativeAlarm.setAlarm({
      title: reminder?.title || "Executive reminder",
      hour: dueDate.getHours(),
      minute: dueDate.getMinutes(),
      skipUi: true,
    });
  } catch (error) {
    console.warn("Could not set native phone alarm:", error);
    return { scheduled: false, error };
  }
}

export async function scheduleDeviceReminder(reminder, options = {}) {
  if (!isNativeApp() || !shouldScheduleReminder(reminder)) {
    return { scheduled: false };
  }

  const dueDate = reminderDueDate(reminder);
  const permissions = await ensureNotificationPermissions();

  if (permissions.display !== "granted") {
    return { scheduled: false, permissions };
  }

  await cancelReminderNotification(reminder);

  const notificationId = reminderNotificationId(reminder);

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId,
        title: reminder?.title || "Executive reminder",
        body: reminder?.notes || reminder?.reminder_time || "You have an upcoming executive item.",
        channelId: REMINDER_CHANNEL_ID,
        schedule: {
          at: dueDate,
          allowWhileIdle: true,
        },
        extra: {
          reminderId: reminder?.id || "",
          relatedType: reminder?.related_type || "",
          relatedId: reminder?.related_id || "",
        },
      },
    ],
  });

  const phoneAlarm = options.setNativeAlarm
    ? await setNativePhoneAlarm(reminder, dueDate)
    : { scheduled: false };

  return {
    scheduled: true,
    notificationId,
    phoneAlarm,
  };
}

export async function syncDeviceReminders(reminders = []) {
  if (!isNativeApp()) {
    return;
  }

  const scheduleable = reminders.filter(shouldScheduleReminder);
  const desiredIds = new Set(scheduleable.map(reminderNotificationId));

  try {
    const pending = await LocalNotifications.getPending();
    const staleNotifications = (pending.notifications || []).filter(
      (notification) =>
        notification.id >= REMINDER_NOTIFICATION_BASE_ID &&
        notification.id < REMINDER_NOTIFICATION_BASE_ID + 800000 &&
        !desiredIds.has(notification.id)
    );

    if (staleNotifications.length > 0) {
      await LocalNotifications.cancel({ notifications: staleNotifications });
    }

    if (scheduleable.length === 0) {
      return;
    }

    await ensureNotificationPermissions();

    await Promise.all(
      scheduleable.map((reminder) =>
        scheduleDeviceReminder(reminder).catch((error) => {
          console.warn("Could not sync reminder notification:", error);
        })
      )
    );
  } catch (error) {
    console.warn("Could not sync device reminders:", error);
  }
}

export async function cancelDeviceReminder(reminder) {
  await cancelReminderNotification(reminder);
}
