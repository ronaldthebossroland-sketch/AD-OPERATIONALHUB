import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { GlowCard } from "../components/GlowCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionTitle } from "../components/SectionTitle";
import { transcriptActions } from "../data/mockData";
import {
  createTranscriptionSession,
  getTranscripts,
  uploadTranscriptAudio,
} from "../lib/api";
import { colors, radii, shadows, spacing, type } from "../theme";

const stateCopy = {
  idle: "Ready",
  "requesting-permission": "Requesting microphone permission",
  connecting: "Connecting to secure transcription",
  recording: "Recording",
  failed: "Failed",
  stopped: "Stopped",
};

export function TranscriptsScreen() {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recordingActive, setRecordingActive] = useState(false);
  const [connectionState, setConnectionState] = useState("idle");
  const [error, setError] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [savedTranscripts, setSavedTranscripts] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSaved() {
      try {
        const data = await getTranscripts();
        if (mounted) {
          setSavedTranscripts(data.transcripts || []);
        }
      } catch {
        if (mounted) {
          setSavedTranscripts([]);
        }
      } finally {
        if (mounted) {
          setLoadingSaved(false);
        }
      }
    }

    loadSaved();
    return () => {
      mounted = false;
    };
  }, []);

  const canRecord = useMemo(
    () => connectionState === "idle" || connectionState === "failed" || connectionState === "stopped",
    [connectionState]
  );

  async function startRecording() {
      setError("");
      setLiveTranscript("");

    try {
      setConnectionState("requesting-permission");
      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        throw new Error("Microphone permission was not granted.");
      }

      setConnectionState("connecting");
      await withTimeout(
        createTranscriptionSession(44100),
        15000,
        "The transcription backend did not respond in time."
      );

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        allowsBackgroundRecording: false,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecordingActive(true);
      setConnectionState("recording");
    } catch (recordError) {
      setConnectionState("failed");
      setRecordingActive(false);
      setError(recordError.message || "Could not start transcription.");
    }
  }

  async function stopRecording() {
    if (!recordingActive) {
      return;
    }

    try {
      setConnectionState("connecting");
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setRecordingActive(false);

      if (!uri) {
        throw new Error("No recording file was created.");
      }

      const audioResponse = await fetch(uri);
      const audioBlob = await audioResponse.blob();
      const data = await uploadTranscriptAudio(
        audioBlob,
        audioBlob.type || "audio/m4a"
      );

      setLiveTranscript(data.transcript || "");
      setConnectionState("stopped");
    } catch (stopError) {
      setConnectionState("failed");
      setRecordingActive(false);
      setError(stopError.message || "Could not finish transcription.");
    }
  }

  async function handleRecordPress() {
    if (connectionState === "recording") {
      await stopRecording();
      return;
    }

    if (canRecord) {
      await startRecording();
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ScreenHeader title="Transcripts" subtitle="Memory layer for decisions and action items" eyebrow="Memory Layer" />
      <View style={styles.padded}>
        <TouchableOpacity
          activeOpacity={0.86}
          disabled={!canRecord && connectionState !== "recording"}
          style={styles.recordOuter}
          onPress={handleRecordPress}
        >
          <LinearGradient colors={[colors.electric, colors.blue, colors.violet]} style={styles.recordButton}>
            {connectionState === "connecting" || connectionState === "requesting-permission" ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Ionicons
                name={connectionState === "recording" ? "stop" : "mic"}
                size={28}
                color={colors.white}
              />
            )}
            <Text style={styles.recordText}>
              {connectionState === "recording" ? "Stop" : "Record"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.stateText}>{stateCopy[connectionState]}</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <SectionTitle title="Live Transcript" action="Listening ready" />
        <GlowCard elevated>
          <Text style={styles.transcriptText}>
            {liveTranscript ||
              "Voice capture will appear here after recording. EVA listens for decisions, owners, due dates, risks, and next steps."}
          </Text>
        </GlowCard>

        <SectionTitle title="AI Summary" />
        <GlowCard style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Meeting intelligence</Text>
          <Text style={styles.summaryText}>
            EVA will summarize key points, highlight decisions, and convert follow-ups into operations.
          </Text>
        </GlowCard>

        <SectionTitle title="Extracted Action Items" />
        <GlowCard style={styles.actionList}>
          {transcriptActions.map((action) => (
            <View key={action} style={styles.actionRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.green} />
              <Text style={styles.actionText}>{action}</Text>
            </View>
          ))}
          <TouchableOpacity activeOpacity={0.86} style={styles.addButton}>
            <Text style={styles.addButtonText}>Add to Operations</Text>
          </TouchableOpacity>
        </GlowCard>

        <SectionTitle title="Saved Transcripts" />
        <GlowCard style={styles.actionList}>
          {loadingSaved ? (
            <ActivityIndicator color={colors.electric} />
          ) : savedTranscripts.length ? (
            savedTranscripts.slice(0, 4).map((item) => (
              <View key={String(item.id)} style={styles.savedItem}>
                <Text style={styles.savedTitle}>{item.title || "Untitled transcript"}</Text>
                <Text style={styles.savedPreview} numberOfLines={2}>
                  {item.transcript || "No transcript text available."}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.summaryText}>No saved transcripts yet.</Text>
          )}
        </GlowCard>
      </View>
    </ScrollView>
  );
}

function withTimeout(promise, ms, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
  padded: {
    paddingHorizontal: spacing.xl,
  },
  recordOuter: {
    alignSelf: "center",
    width: 146,
    height: 146,
    borderRadius: 73,
    ...shadows.glow,
  },
  recordButton: {
    flex: 1,
    borderRadius: 73,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  recordText: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
  },
  stateText: {
    ...type.caption,
    alignSelf: "center",
    marginTop: spacing.md,
    color: colors.textSoft,
  },
  errorText: {
    ...type.caption,
    alignSelf: "center",
    marginTop: spacing.sm,
    color: colors.amber,
    textAlign: "center",
  },
  transcriptText: {
    ...type.body,
    color: colors.text,
  },
  summaryCard: {
    gap: spacing.sm,
  },
  summaryTitle: {
    ...type.h2,
  },
  summaryText: {
    ...type.body,
  },
  actionList: {
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionText: {
    ...type.body,
    flex: 1,
    color: colors.text,
  },
  addButton: {
    minHeight: 50,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.blue,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  savedItem: {
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    gap: spacing.xs,
  },
  savedTitle: {
    ...type.body,
    color: colors.text,
    fontWeight: "800",
  },
  savedPreview: {
    ...type.caption,
    color: colors.textSoft,
  },
});
