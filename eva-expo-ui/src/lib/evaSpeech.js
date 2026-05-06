import * as FileSystem from "expo-file-system/legacy";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { API_BASE_URL } from "./evaApi";

const VOICE_MODELS = {
  calm:      { model: "aura-2-luna-en",   speed: 0.82 },
  executive: { model: "aura-2-thalia-en", speed: 0.90 },
  warm:      { model: "aura-2-stella-en", speed: 0.85 },
  direct:    { model: "aura-2-athena-en", speed: 0.96 },
};

const VOICE_PREVIEWS = {
  calm:      "Calm voice selected. I will keep my replies slow, soft, and considered.",
  executive: "Executive voice selected. I will sound polished, composed, and quietly authoritative.",
  warm:      "Warm voice selected. I will answer with a gentle, reassuring tone.",
  direct:    "Direct voice selected. I will keep my voice firm, clear, and focused.",
};

const TTS_AUDIO_PATH = (FileSystem.cacheDirectory ?? "") + "eva_tts_reply.wav";
const TTS_TIMEOUT_MS = 14_000;

let activePlayer = null;

export function stopEvaSpeech() {
  if (!activePlayer) return;
  try { activePlayer.pause(); } catch { /* noop */ }
  try { activePlayer.remove(); } catch { /* noop */ }
  activePlayer = null;
}

export async function speakEvaReply(text, voiceMode = "calm") {
  const content = cleanSpeechText(text);
  if (!content) return { ok: false, message: "Nothing to speak." };

  stopEvaSpeech();

  try {
    const audioUri = await fetchAndCacheTTS(content, voiceMode);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const player = createAudioPlayer({ uri: audioUri });
    activePlayer = player;
    player.play();
    const config = VOICE_MODELS[voiceMode] || VOICE_MODELS.executive;
    return { ok: true, voice: config.model };
  } catch (error) {
    stopEvaSpeech();
    return {
      ok: false,
      message: error?.message || "EVA voice playback is unavailable.",
    };
  }
}

export function previewEvaVoice(voiceMode) {
  return speakEvaReply(
    VOICE_PREVIEWS[voiceMode] || VOICE_PREVIEWS.calm,
    voiceMode
  );
}

async function fetchAndCacheTTS(text, voiceMode, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/eva/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceMode }),
      signal: controller.signal,
    });
  } catch (fetchError) {
    clearTimeout(timer);
    if (attempt === 0 && fetchError?.name !== "AbortError") {
      // One retry on network drop
      return fetchAndCacheTTS(text, voiceMode, 1);
    }
    throw new Error(
      fetchError?.name === "AbortError"
        ? "EVA voice request timed out."
        : "EVA voice is unavailable right now. Check your connection.",
      { cause: fetchError }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      errData?.error || `EVA voice request failed (${response.status}).`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer?.byteLength) {
    throw new Error("EVA voice returned empty audio.");
  }

  const base64 = arrayBufferToBase64(arrayBuffer);
  await FileSystem.writeAsStringAsync(TTS_AUDIO_PATH, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const info = await FileSystem.getInfoAsync(TTS_AUDIO_PATH);
  if (!info.exists || !info.size) {
    throw new Error("EVA voice audio could not be saved to device.");
  }

  return TTS_AUDIO_PATH;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function cleanSpeechText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/Recommended next move:/gi, "Next move:")
    .trim()
    .slice(0, 900);
}
