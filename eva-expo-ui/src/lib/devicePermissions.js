import * as Calendar from "expo-calendar";
import Constants from "expo-constants";
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";

const EXPO_GO_NOTIFICATION_MESSAGE =
  "Notifications need a development build on Android. EVA still works in Expo Go.";

export async function checkCalendarPermissions() {
  return readPermission(() => Calendar.getCalendarPermissionsAsync());
}

export async function requestCalendarPermissions() {
  const current = await checkCalendarPermissions();
  if (current.granted || !current.canAskAgain) {
    return current;
  }

  return readPermission(() => Calendar.requestCalendarPermissionsAsync());
}

export async function checkNotificationPermissions() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return unavailablePermission(EXPO_GO_NOTIFICATION_MESSAGE);
  }

  return readPermission(() => Notifications.getPermissionsAsync());
}

export async function requestNotificationPermissions() {
  const current = await checkNotificationPermissions();
  if (current.granted || !current.canAskAgain) {
    return current;
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return current;
  }

  return readPermission(() => Notifications.requestPermissionsAsync());
}

export async function checkMicrophonePermission() {
  return readPermission(() => getRecordingPermissionsAsync());
}

export async function requestMicrophonePermission() {
  const current = await checkMicrophonePermission();
  if (current.granted || !current.canAskAgain) {
    return current;
  }

  return readPermission(() => requestRecordingPermissionsAsync());
}

async function readPermission(action) {
  try {
    return normalizePermission(await action());
  } catch (error) {
    return unavailablePermission(
      error?.message || "Permission API is unavailable on this device."
    );
  }
}

async function getNotificationsModule() {
  if (isExpoGoRuntime()) {
    return null;
  }

  try {
    return await import("expo-notifications");
  } catch (error) {
    console.warn("EVA notifications are unavailable.", error?.message || error);
    return null;
  }
}

export function isExpoGoRuntime() {
  return (
    Constants.appOwnership === "expo" ||
    String(Constants.executionEnvironment || "").toLowerCase() === "storeclient"
  );
}

function unavailablePermission(message) {
  return {
    granted: false,
    status: "unavailable",
    canAskAgain: false,
    message,
  };
}

function normalizePermission(response = {}) {
  const status = String(response.status || "").toLowerCase();
  const granted = Boolean(response.granted) || status === "granted";

  if (granted) {
    return {
      granted: true,
      status: "granted",
      canAskAgain: Boolean(response.canAskAgain),
      message: "",
    };
  }

  if (status === "denied") {
    return {
      granted: false,
      status: "denied",
      canAskAgain: Boolean(response.canAskAgain),
      message: "Permission was denied.",
    };
  }

  return {
    granted: false,
    status: status || "undetermined",
    canAskAgain: response.canAskAgain !== false,
    message: "",
  };
}
