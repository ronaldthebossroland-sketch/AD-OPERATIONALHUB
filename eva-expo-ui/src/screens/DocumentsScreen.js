import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioRecorder, setAudioModeAsync } from "expo-audio";
import { GlowCard } from "../components/GlowCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionTitle } from "../components/SectionTitle";
import { StatusPill } from "../components/StatusPill";
import { useEVAApp } from "../state/EVAAppContext";
import { requestMicrophonePermission } from "../lib/devicePermissions";
import { transcribeEvaAudio } from "../lib/evaApi";
import {
  VOICE_RECORDING_OPTIONS,
  getRecordingMimeType,
} from "../lib/voiceRecorder";

const SEGMENT_MS = 12_000;

export function DocumentsScreen() {
  const { theme, documents, addDocument, addTranscript, addTask, handleAssistantCommand } = useEVAApp();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme, compact), [compact, theme]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [transcriptTitle, setTranscriptTitle] = useState("Leadership transcript");
  const [transcriptStatus, setTranscriptStatus] = useState("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [segmentStatus, setSegmentStatus] = useState("");
  const transcribingRef = useRef(false);
  const segmentTimerRef = useRef(null);
  const segmentResolveRef = useRef(null);
  const audioRecorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);

  useEffect(() => {
    return () => {
      transcribingRef.current = false;
      if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
      segmentResolveRef.current?.();
      segmentResolveRef.current = null;
      try { if (audioRecorder.isRecording) audioRecorder.stop().catch(() => {}); } catch { /* noop */ }
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    };
  }, [audioRecorder]);

  const stopLiveTranscription = useCallback(async () => {
    transcribingRef.current = false;
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    setIsTranscribing(false);
    setSegmentStatus("");
    segmentResolveRef.current?.();
    segmentResolveRef.current = null;
    try { if (audioRecorder.isRecording) await audioRecorder.stop(); } catch { /* noop */ }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    setTranscriptStatus((s) => (s === "listening" ? "editing" : s));
  }, [audioRecorder]);

  async function runSegment() {
    if (!transcribingRef.current) return;
    try {
      setSegmentStatus("recording");
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      await new Promise((resolve) => {
        segmentResolveRef.current = resolve;
        segmentTimerRef.current = setTimeout(() => {
          segmentResolveRef.current = null;
          resolve();
        }, SEGMENT_MS);
      });
      segmentResolveRef.current = null;
      segmentTimerRef.current = null;
      if (!transcribingRef.current) {
        await audioRecorder.stop().catch(() => {});
        return;
      }
      setSegmentStatus("processing");
      await audioRecorder.stop();
      const uri = audioRecorder.uri || "";
      if (!uri || !transcribingRef.current) return;
      const data = await transcribeEvaAudio(uri, { mimeType: getRecordingMimeType(uri) });
      const text = String(data?.transcript || "").trim();
      if (text && transcribingRef.current) {
        setLiveTranscript((current) => (current ? `${current} ${text}` : text));
        setTranscriptStatus("listening");
      }
    } catch (error) {
      if (transcribingRef.current) {
        console.warn("EVA live transcription segment failed.", error?.message || error);
      }
    }
    if (transcribingRef.current) {
      segmentTimerRef.current = setTimeout(() => {
        segmentTimerRef.current = null;
        runSegment();
      }, 150);
    }
  }

  async function startLiveTranscription() {
    const permission = await requestMicrophonePermission();
    if (!permission.granted) {
      setTranscriptStatus("mic blocked");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(() => {});
    transcribingRef.current = true;
    setIsTranscribing(true);
    setTranscriptStatus("listening");
    runSegment();
  }

  function addNote() {
    if (!title.trim() && !content.trim()) return;
    addDocument({
      title: title.trim() || "Executive note",
      content: content.trim(),
      summary: summarize(content),
    });
    setTitle("");
    setContent("");
  }

  function summarizeLatest() {
    handleAssistantCommand("Summarize notes");
  }

  function clearTranscript() {
    setLiveTranscript("");
    setTranscriptStatus("idle");
  }

  function saveTranscript() {
    if (!liveTranscript.trim()) return;
    addTranscript({
      title: transcriptTitle.trim() || "Meeting notes",
      content: liveTranscript.trim(),
      summary: "EVA captured this transcript for briefings, decisions, and follow-up actions.",
    });
    setTranscriptStatus("saved");
    setLiveTranscript("");
    setTranscriptTitle("Leadership transcript");
  }

  function createTranscriptFollowUp() {
    addTask({
      title: "Review transcript action items",
      detail: "Confirm coverage, review the media timeline, and prepare the budget decision.",
      priority: "High",
      due: "Today",
    });
    setTranscriptStatus("follow-up created");
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Documents / Knowledge"
        subtitle="Memory for notes, transcripts, briefings, and decisions"
        eyebrow="Knowledge Layer"
      />
      <View style={styles.padded}>
        <GlowCard elevated style={styles.transcriptionCard}>
          <View style={styles.transcriptionTop}>
            <View style={styles.transcriptionIcon}>
              <Ionicons name="document-text-outline" size={22} color={colors.electric} />
            </View>
            <View style={styles.transcriptionCopy}>
              <Text style={styles.formTitle}>Live Transcription</Text>
              <Text style={styles.helperText}>
                Record a meeting and EVA will transcribe it in real time.
              </Text>
            </View>
            <StatusPill label={transcriptStatus} />
          </View>

          <Field
            styles={styles}
            colors={colors}
            placeholder="Transcript title"
            value={transcriptTitle}
            onChangeText={setTranscriptTitle}
          />

          {isTranscribing ? (
            <View style={styles.recordingRow}>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingLabel}>
                  {segmentStatus === "processing" ? "Processing..." : "Recording..."}
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.86} style={styles.stopButton} onPress={stopLiveTranscription}>
                <Ionicons name="stop" size={16} color={colors.white} />
                <Text style={styles.stopButtonText}>Stop</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.startButton}
              onPress={startLiveTranscription}
            >
              <Ionicons name="mic-outline" size={18} color={colors.electric} />
              <Text style={styles.startButtonText}>Start Transcribing</Text>
            </TouchableOpacity>
          )}

          <TextInput
            multiline
            value={liveTranscript}
            onChangeText={(text) => {
              setLiveTranscript(text);
              if (text.trim()) setTranscriptStatus("editing");
              else if (transcribingRef.current) setTranscriptStatus("listening");
            }}
            placeholder="Transcript will appear here as you speak. You can also type or paste notes."
            placeholderTextColor={colors.textMuted}
            style={[styles.transcriptPanel, styles.transcriptInput]}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity activeOpacity={0.86} style={styles.primaryButton} onPress={saveTranscript}>
              <Ionicons name="save-outline" size={18} color={colors.white} />
              <Text style={styles.primaryButtonText}>Save Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.86} style={styles.secondaryButton} onPress={clearTranscript}>
              <Text style={styles.secondaryButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity activeOpacity={0.86} style={styles.secondaryButtonWide} onPress={createTranscriptFollowUp}>
              <Ionicons name="checkbox-outline" size={17} color={colors.electric} />
              <Text style={styles.secondaryButtonText}>Create Follow-up Task</Text>
            </TouchableOpacity>
          </View>
        </GlowCard>

        <GlowCard elevated style={styles.form}>
          <Text style={styles.formTitle}>Capture knowledge</Text>
          <Field styles={styles} colors={colors} placeholder="Document title" value={title} onChangeText={setTitle} />
          <Field
            styles={styles}
            colors={colors}
            placeholder="Paste notes, decisions, or briefing context..."
            value={content}
            onChangeText={setContent}
            multiline
            style={styles.noteField}
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity activeOpacity={0.86} style={styles.primaryButton} onPress={addNote}>
              <Ionicons name="add" size={18} color={colors.white} />
              <Text style={styles.primaryButtonText}>Add Note</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.86} style={styles.secondaryButton} onPress={summarizeLatest}>
              <Text style={styles.secondaryButtonText}>Summarize</Text>
            </TouchableOpacity>
          </View>
        </GlowCard>

        <SectionTitle title="Knowledge Base" action={`${documents.length} items`} />
        <View style={styles.stack}>
          {documents.map((document) => (
            <GlowCard key={document.id} style={styles.docCard}>
              <View style={styles.docTop}>
                <View style={styles.docIcon}>
                  <Ionicons
                    name={document.type === "Transcript" ? "mic-outline" : "document-text-outline"}
                    size={19}
                    color={colors.electric}
                  />
                </View>
                <View style={styles.docCopy}>
                  <Text style={styles.docTitle}>{document.title}</Text>
                  <Text style={styles.docMeta}>{document.type} - {document.updatedAt}</Text>
                </View>
              </View>
              <Text style={styles.docSummary}>{document.summary}</Text>
              <Text style={styles.docContent} numberOfLines={4}>{document.content}</Text>
            </GlowCard>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function Field({ styles, colors, style, ...props }) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      style={[styles.field, style]}
      textAlignVertical="top"
      {...props}
    />
  );
}

function summarize(text) {
  const clean = text.trim();
  if (!clean) return "EVA has saved this item for future briefings.";
  const firstSentence = clean.split(/[.!?]/).find(Boolean)?.trim();
  return firstSentence
    ? `${firstSentence}. EVA flagged this as useful executive context.`
    : "EVA has saved this item for future briefings.";
}

function createStyles({ colors, radii, spacing, type }, compact) {
  return StyleSheet.create({
    content: {
      paddingBottom: 24,
    },
    padded: {
      paddingHorizontal: compact ? spacing.lg : spacing.xl,
    },
    transcriptionCard: {
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    transcriptionTop: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.md,
    },
    transcriptionIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.glassButton,
    },
    transcriptionCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    helperText: {
      ...type.caption,
      color: colors.textSoft,
    },
    startButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      minHeight: 48,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
      backgroundColor: colors.glassButton,
    },
    startButtonText: {
      color: colors.electric,
      fontSize: 14,
      fontWeight: "800",
    },
    recordingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 48,
    },
    recordingIndicator: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    recordingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#EF4444",
    },
    recordingLabel: {
      ...type.body,
      color: colors.text,
      fontWeight: "700",
    },
    stopButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      minHeight: 44,
      borderRadius: radii.lg,
      backgroundColor: "#EF4444",
    },
    stopButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: "800",
    },
    transcriptPanel: {
      minHeight: 154,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.input,
      padding: spacing.md,
    },
    transcriptInput: {
      ...type.body,
      color: colors.text,
      textAlignVertical: "top",
    },
    form: {
      gap: spacing.md,
    },
    formTitle: {
      ...type.h2,
    },
    field: {
      minHeight: 48,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.input,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    noteField: {
      minHeight: 120,
    },
    buttonRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    primaryButton: {
      flexGrow: 1,
      flexBasis: compact ? "100%" : 0,
      minHeight: 52,
      borderRadius: radii.lg,
      backgroundColor: colors.blue,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: "800",
    },
    secondaryButton: {
      minHeight: 52,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.glassButton,
    },
    secondaryButtonWide: {
      flexGrow: 1,
      flexBasis: compact ? "100%" : 0,
      minHeight: 48,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: spacing.sm,
      backgroundColor: colors.glassSurface,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    stack: {
      gap: spacing.md,
    },
    docCard: {
      gap: spacing.md,
    },
    docTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    docIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.glassButton,
    },
    docCopy: {
      flex: 1,
    },
    docTitle: {
      ...type.h2,
    },
    docMeta: {
      ...type.caption,
      marginTop: spacing.xs,
    },
    docSummary: {
      ...type.body,
      color: colors.text,
    },
    docContent: {
      ...type.caption,
      color: colors.textSoft,
    },
  });
}
