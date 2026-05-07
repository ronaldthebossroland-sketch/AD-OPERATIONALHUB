import { NativeModules, Platform } from "react-native";

const nativeWakeWord = NativeModules.EvaWakeWord;
const UNAVAILABLE = {
  available: false,
  running: false,
  status: "unavailable",
  message: "Hi EVA needs the Android test APK.",
};

export function isWakeWordSupported() {
  return Platform.OS === "android" && Boolean(nativeWakeWord);
}

export async function getWakeWordStatus() {
  if (!isWakeWordSupported()) {
    return UNAVAILABLE;
  }

  return nativeWakeWord.getStatus();
}

export async function startWakeWordListening() {
  if (!isWakeWordSupported()) {
    return UNAVAILABLE;
  }

  return nativeWakeWord.start();
}

export async function stopWakeWordListening() {
  if (!isWakeWordSupported()) {
    return UNAVAILABLE;
  }

  return nativeWakeWord.stop();
}

export async function consumeWakeWordEvent() {
  if (!isWakeWordSupported()) {
    return { detected: false, status: "unavailable" };
  }

  return nativeWakeWord.consumeWakeWordEvent();
}
