import { synthesizeVoiceAudio } from "./api";

function preferredBrowserVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];

  return voices.find((voice) =>
    /natural|aria|jenny|sonia|zira|samantha|serena|google uk english female|microsoft/i.test(
      voice.name
    )
  );
}

export function stopBrowserSpeech() {
  window.speechSynthesis?.cancel?.();
}

function speakWithBrowserVoice(text, options = {}) {
  if (!window.speechSynthesis || !text) {
    return null;
  }

  stopBrowserSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate ?? 0.88;
  utterance.pitch = options.pitch ?? 0.92;
  utterance.volume = options.volume ?? 0.92;

  const voice = preferredBrowserVoice();

  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
  return stopBrowserSpeech;
}

export async function playCalmVoiceAlert(text, options = {}) {
  if (typeof window === "undefined" || !text) {
    return null;
  }

  stopBrowserSpeech();

  try {
    const audioBlob = await synthesizeVoiceAudio(text);

    if (!audioBlob?.size) {
      throw new Error("Empty voice response.");
    }

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    let cleanedUp = false;

    audio.volume = options.volume ?? 0.94;

    const cleanup = () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      URL.revokeObjectURL(audioUrl);
    };

    audio.addEventListener("ended", cleanup, { once: true });
    audio.addEventListener("error", cleanup, { once: true });

    await audio.play();

    return () => {
      audio.pause();
      cleanup();
    };
  } catch {
    return speakWithBrowserVoice(text, options);
  }
}
