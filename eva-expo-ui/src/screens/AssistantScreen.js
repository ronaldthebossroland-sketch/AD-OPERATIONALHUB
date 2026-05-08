import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { CommandInput } from "../components/CommandInput";
import { FloatingMic } from "../components/FloatingMic";
import { GlowCard } from "../components/GlowCard";
import { PromptChip } from "../components/PromptChip";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionTitle } from "../components/SectionTitle";
import { useEVAApp } from "../state/EVAAppContext";
import { requestMicrophonePermission } from "../lib/devicePermissions";
import { transcribeEvaAudio } from "../lib/evaApi";
import { createSentenceAudioQueue, speakEvaReply, stopEvaSpeech } from "../lib/evaSpeech";
import {
  VOICE_RECORDING_MAX_MS,
  VOICE_RECORDING_OPTIONS,
  cancelRecording,
  startRecording,
  stopRecording,
} from "../lib/voiceRecorder";

const VOICE_PERMISSION_MESSAGE =
  "Microphone access is needed for voice commands. You can still type commands manually.";
const VOICE_TRANSCRIPTION_ERROR =
  "I couldn't transcribe that clearly. Please try again or type your command.";

export function AssistantScreen({ wakeSignal = 0 }) {
  const {
    theme,
    assistantPrompts,
    chatMessages,
    handleAssistantCommand,
    handleAssistantCommandStreaming,
    addAssistantNotice,
    updateVoiceIntegrationStatus,
    pauseWakeWordListening,
    resumeWakeWordListening,
    voiceMode,
  } = useEVAApp();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme, compact), [compact, theme]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Ready");
  const [voiceState, setVoiceState] = useState("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const scrollRef = useRef(null);
  const autoStopRef = useRef(null);
  const stoppingRef = useRef(false);
  const pressHeldRef = useRef(false);
  const recordingStartedRef = useRef(false);
  const lastWakeSignalRef = useRef(0);
  const sentenceQueueRef = useRef(null);
  const audioRecorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const clearVoiceTimer = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearVoiceTimer();
      cancelRecording(audioRecorder).catch(() => {});
      stopEvaSpeech();
    };
  }, [audioRecorder, clearVoiceTimer]);

  async function submitMessage(text = draft) {
    const content = text.trim();

    if (!content) {
      return;
    }

    setStatus("Processing command");
    setDraft("");

    try {
      return await handleAssistantCommand(content);
    } finally {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd?.({ animated: true }));
      setTimeout(() => setStatus("Ready"), 420);
    }
  }

  async function handleMicPressIn() {
    if (voiceState === "transcribing" || voiceState === "processing") {
      return;
    }
    pressHeldRef.current = true;
    await beginVoiceRecording();
    if (!pressHeldRef.current && recordingStartedRef.current) {
      stopAndTranscribe().catch(() => {});
    }
  }

  function handleMicPressOut() {
    pressHeldRef.current = false;
    if (voiceState === "listening" || recorderState.isRecording) {
      stopAndTranscribe().catch(() => {});
    }
  }

  async function beginVoiceRecording() {
    recordingStartedRef.current = false;
    setStatus("Requesting microphone");
    setVoiceMessage("");
    if (sentenceQueueRef.current) {
      sentenceQueueRef.current.stop();
      sentenceQueueRef.current = null;
    }
    stopEvaSpeech();
    await pauseWakeWordListening?.().catch(() => {});

    const permission = await requestMicrophonePermission();
    const permissionStatus = permissionStatusLabel(permission);

    updateVoiceIntegrationStatus({
      microphoneStatus: permissionStatus,
      message: permission.granted ? "" : VOICE_PERMISSION_MESSAGE,
    });

    if (!permission.granted) {
      setStatus("Ready");
      setVoiceState("idle");
      setVoiceMessage(VOICE_PERMISSION_MESSAGE);
      addAssistantNotice(VOICE_PERMISSION_MESSAGE);
      resumeWakeWordListening?.({ silent: true }).catch(() => {});
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd?.({ animated: true }));
      return;
    }

    try {
      await startRecording(audioRecorder);
      recordingStartedRef.current = true;
      setVoiceState("listening");
      setStatus("Listening");
      setVoiceMessage("Listening... release the button when you are done.");
      clearVoiceTimer();
      autoStopRef.current = setTimeout(() => {
        stopAndTranscribe({ autoStopped: true }).catch(() => {});
      }, VOICE_RECORDING_MAX_MS);
    } catch (error) {
      setStatus("Ready");
      setVoiceState("idle");
      setVoiceMessage("Voice recording could not start. You can still type commands manually.");
      resumeWakeWordListening?.({ silent: true }).catch(() => {});
      updateVoiceIntegrationStatus({
        deepgramStatus: "not_connected",
        message: error?.message || "Voice recording could not start.",
      });
      console.warn("EVA voice recording failed.", error?.message || error);
    }
  }

  async function stopAndTranscribe({ autoStopped = false } = {}) {
    if (stoppingRef.current) {
      return;
    }

    stoppingRef.current = true;
    clearVoiceTimer();
    setVoiceState("transcribing");
    setStatus("Transcribing");
    setVoiceMessage(
      autoStopped
        ? "Voice limit reached. Transcribing your command..."
        : "Transcribing your command..."
    );

    try {
      const recording = await stopRecording(audioRecorder);

      if (!recording.uri) {
        throw new Error("No recording file was created.");
      }

      const result = await transcribeEvaAudio(recording.uri, {
        mimeType: recording.mimeType,
      });
      const transcript = String(result?.transcript || "").trim();

      if (!transcript) {
        throw new Error("Voice transcription returned an empty transcript.");
      }

      updateVoiceIntegrationStatus({
        microphoneStatus: "connected",
        deepgramStatus: "connected",
        message: "",
      });
      setVoiceMessage(`Heard: "${formatTranscriptPreview(transcript)}" EVA is working on it now...`);
      setVoiceState("processing");
      setStatus("Working");
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd?.({ animated: true }));

      let sentenceCount = 0;
      const queue = createSentenceAudioQueue(voiceMode);
      sentenceQueueRef.current = queue;
      const streamedReply = await handleAssistantCommandStreaming(transcript, (sentence) => {
        sentenceCount++;
        queue.enqueue(sentence);
      });
      sentenceQueueRef.current = null;
      setVoiceMessage("");
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd?.({ animated: true }));

      // Fallback: if streaming produced no audio sentences, speak the reply directly
      if (sentenceCount === 0 && streamedReply) {
        await speakEvaReply(streamedReply, voiceMode);
      }
    } catch (error) {
      console.warn("EVA voice transcription failed.", error?.message || error);
      updateVoiceIntegrationStatus({
        deepgramStatus: "unavailable",
        message: error?.message || VOICE_TRANSCRIPTION_ERROR,
      });
      setVoiceMessage(VOICE_TRANSCRIPTION_ERROR);
      addAssistantNotice(VOICE_TRANSCRIPTION_ERROR);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd?.({ animated: true }));
    } finally {
      stoppingRef.current = false;
      recordingStartedRef.current = false;
      setVoiceState("idle");
      setTimeout(() => setStatus("Ready"), 420);
      resumeWakeWordListening?.({ silent: true }).catch(() => {});
    }
  }

  useEffect(() => {
    if (!wakeSignal || wakeSignal === lastWakeSignalRef.current) {
      return undefined;
    }
    if (voiceState !== "idle") {
      return undefined;
    }

    lastWakeSignalRef.current = wakeSignal;
    addAssistantNotice("I'm listening. Tell EVA what to do.");
    const timer = setTimeout(() => {
      beginVoiceRecording().catch(() => {});
    }, 550);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeSignal, voiceState]);

  const processingText =
    voiceState === "listening"
      ? "EVA is listening"
      : voiceState === "transcribing"
        ? "EVA is transcribing your voice command"
        : voiceState === "processing"
          ? "EVA heard you and is preparing the action"
        : "EVA is processing the command";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
      >
        <ScreenHeader title="Assistant Chat" subtitle="Command EVA with natural language" eyebrow="EVA" />
        <View style={styles.padded}>
          <View style={styles.promptWrap}>
            {assistantPrompts.map((prompt) => (
              <PromptChip key={prompt} label={prompt} onPress={() => submitMessage(prompt)} />
            ))}
          </View>

          <SectionTitle title="Command Thread" action="Live" />
          <GlowCard elevated style={styles.thread}>
            {chatMessages.map((item) => (
              <View key={item.id} style={[styles.bubble, item.role === "user" && styles.userBubble]}>
                <Text style={styles.bubbleLabel}>{item.role === "assistant" ? "EVA" : "You"}</Text>
                <Text style={styles.bubbleText}>{item.content}</Text>
              </View>
            ))}
            {status !== "Ready" ? (
              <View style={styles.typingRow}>
                <Ionicons name="pulse-outline" size={16} color={colors.electric} />
                <Text style={styles.typingText}>{processingText}</Text>
              </View>
            ) : null}
          </GlowCard>
        </View>
      </ScrollView>
      <View style={styles.composer}>
        {voiceMessage ? (
          <Text style={styles.voiceStatusText}>{voiceMessage}</Text>
        ) : null}
        <CommandInput
          value={draft}
          onChangeText={setDraft}
          onSubmit={() => submitMessage()}
          disabled={voiceState === "transcribing" || voiceState === "processing"}
        />
      </View>
      <FloatingMic
        onPressIn={handleMicPressIn}
        onPressOut={handleMicPressOut}
        state={voiceState}
        disabled={voiceState === "transcribing" || voiceState === "processing"}
      />
    </KeyboardAvoidingView>
  );
}

function permissionStatusLabel(permission = {}) {
  if (permission.granted) return "connected";
  if (permission.status === "denied") return "denied";
  if (permission.status === "unavailable") return "unavailable";
  return "not_connected";
}

function formatTranscriptPreview(transcript) {
  const text = String(transcript || "").replace(/\s+/g, " ").trim();
  return text.length > 96 ? `${text.slice(0, 93).trim()}...` : text;
}

function createStyles({ colors, radii, spacing, type }, compact) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    content: {
      paddingBottom: spacing.lg,
    },
    padded: {
      paddingHorizontal: compact ? spacing.lg : spacing.xl,
    },
    composer: {
      paddingHorizontal: compact ? spacing.lg : spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.bg + "F0",
    },
    promptWrap: {
      marginTop: spacing.lg,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    thread: {
      gap: spacing.md,
    },
    bubble: {
      alignSelf: "flex-start",
      maxWidth: "86%",
      borderRadius: radii.lg,
      backgroundColor: colors.navActive,
      padding: spacing.md,
    },
    userBubble: {
      alignSelf: "flex-end",
      backgroundColor: colors.violet + (colors.isDark ? "29" : "1A"),
    },
    bubbleLabel: {
      ...type.micro,
      color: colors.electric,
      marginBottom: spacing.xs,
    },
    bubbleText: {
      ...type.body,
      color: colors.text,
    },
    typingRow: {
      marginTop: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: colors.input,
      padding: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    typingText: {
      ...type.caption,
      flex: 1,
      color: colors.textSoft,
    },
    voiceStatusText: {
      ...type.caption,
      color: colors.textSoft,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
  });
}
