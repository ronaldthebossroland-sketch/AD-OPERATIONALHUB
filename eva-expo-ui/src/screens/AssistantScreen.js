import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CommandInput } from "../components/CommandInput";
import { FloatingMic } from "../components/FloatingMic";
import { GlowCard } from "../components/GlowCard";
import { PromptChip } from "../components/PromptChip";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionTitle } from "../components/SectionTitle";
import { StatusPill } from "../components/StatusPill";
import { prompts } from "../data/mockData";
import { sendAssistantChat } from "../lib/api";
import { colors, radii, spacing, type } from "../theme";

const initialMessages = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Good evening, Ronald. EVA is ready to help with meetings, operations, transcripts, and daily decisions.",
  },
];

export function AssistantScreen() {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  const apiMessages = useMemo(
    () =>
      messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages]
  );

  async function submitMessage(text = draft) {
    const content = text.trim();

    if (!content || sending) {
      return;
    }

    const userMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setError("");
    setSending(true);

    try {
      const response = await sendAssistantChat([
        ...apiMessages,
        { role: "user", content },
      ]);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-eva`,
          role: "assistant",
          content: response.reply || "I am ready. What would you like to do next?",
          intent: response.intent,
          actions: response.actions || [],
        },
      ]);
    } catch (requestError) {
      setError(requestError.message || "EVA could not respond.");
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          content:
            "I could not reach the assistant backend. Please check your connection and try again.",
        },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd?.({ animated: true }));
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
      >
        <ScreenHeader title="Good evening, Ronald" subtitle="EVA is ready" eyebrow="Executive Virtual Assistant" />
        <View style={styles.padded}>
          <CommandInput
            value={draft}
            onChangeText={setDraft}
            onSubmit={() => submitMessage()}
            disabled={sending}
          />
          <View style={styles.promptWrap}>
            {prompts.map((prompt) => (
              <PromptChip key={prompt} label={prompt} onPress={() => submitMessage(prompt)} />
            ))}
          </View>

          <SectionTitle title="Command Thread" action="Live" />
          <GlowCard elevated style={styles.thread}>
            {messages.map((item) => (
              <View key={item.id} style={[styles.bubble, item.role === "user" && styles.userBubble]}>
                <Text style={styles.bubbleLabel}>{item.role === "assistant" ? "EVA" : "You"}</Text>
                <Text style={styles.bubbleText}>{item.content}</Text>
              </View>
            ))}
            {sending ? (
              <View style={styles.typingRow}>
                <Ionicons name="pulse-outline" size={16} color={colors.electric} />
                <Text style={styles.typingText}>EVA is thinking</Text>
                <ActivityIndicator color={colors.electric} size="small" />
              </View>
            ) : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </GlowCard>

          <SectionTitle title="System Status" />
          <GlowCard style={styles.statusCard}>
            <StatusPill label="All systems operational" />
            <Text style={styles.statusText}>Calendar, transcripts, and operations are synchronized for today's workflow.</Text>
          </GlowCard>
        </View>
      </ScrollView>
      <FloatingMic onPress={() => setError("Voice chat is being prepared. Use typed commands for this phase.")} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  padded: {
    paddingHorizontal: spacing.xl,
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
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    padding: spacing.md,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(124, 58, 237, 0.16)",
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
    backgroundColor: "rgba(255, 255, 255, 0.05)",
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
  errorText: {
    ...type.caption,
    color: colors.amber,
  },
  statusCard: {
    gap: spacing.md,
  },
  statusText: {
    ...type.body,
  },
});
