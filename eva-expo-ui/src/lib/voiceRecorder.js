import { RecordingPresets, setAudioModeAsync } from "expo-audio";

export const VOICE_RECORDING_MAX_MS = 45_000;
export const VOICE_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

let activeRecorder = null;
let startedAt = 0;
let stoppedAt = 0;

export async function startRecording(recorder) {
  if (!recorder) {
    throw new Error("Voice recorder is not available.");
  }

  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });
  await recorder.prepareToRecordAsync();
  recorder.record({ forDuration: VOICE_RECORDING_MAX_MS / 1000 });

  activeRecorder = recorder;
  startedAt = Date.now();
  stoppedAt = 0;

  return {
    uri: getRecordingUri(recorder),
    durationMillis: 0,
    startedAt,
  };
}

export async function stopRecording(recorder = activeRecorder) {
  if (!recorder) {
    throw new Error("No active voice recording is available.");
  }

  if (isRecorderActive(recorder)) {
    await recorder.stop();
  }

  stoppedAt = Date.now();
  const uri = getRecordingUri(recorder);

  activeRecorder = null;
  await restorePlaybackMode();

  return {
    uri,
    durationMillis: getRecordingDuration(recorder),
    mimeType: getRecordingMimeType(uri),
  };
}

export async function cancelRecording(recorder = activeRecorder) {
  try {
    if (recorder && isRecorderActive(recorder)) {
      await recorder.stop();
    }
  } finally {
    activeRecorder = null;
    stoppedAt = Date.now();
    await restorePlaybackMode();
  }
}

export function getRecordingUri(recorder = activeRecorder) {
  if (!recorder) {
    return "";
  }

  const status = safeRecorderStatus(recorder);
  return recorder.uri || status?.url || "";
}

export function getRecordingDuration(recorder = activeRecorder) {
  const status = safeRecorderStatus(recorder);
  if (Number.isFinite(status?.durationMillis)) {
    return status.durationMillis;
  }

  if (Number.isFinite(recorder?.currentTime)) {
    return Math.round(recorder.currentTime * 1000);
  }

  if (startedAt) {
    return Math.max(0, (stoppedAt || Date.now()) - startedAt);
  }

  return 0;
}

export function getRecordingMimeType(uri = "") {
  const cleanUri = String(uri).toLowerCase();
  if (cleanUri.endsWith(".3gp")) {
    return "audio/3gpp";
  }
  if (cleanUri.endsWith(".webm")) {
    return "audio/webm";
  }
  if (cleanUri.endsWith(".wav")) {
    return "audio/wav";
  }
  return "audio/m4a";
}

function isRecorderActive(recorder) {
  if (recorder?.isRecording) {
    return true;
  }

  return Boolean(safeRecorderStatus(recorder)?.isRecording);
}

function safeRecorderStatus(recorder) {
  try {
    return recorder?.getStatus?.() || null;
  } catch {
    return null;
  }
}

async function restorePlaybackMode() {
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
  } catch {
    // Audio mode cleanup should never block the assistant flow.
  }
}
