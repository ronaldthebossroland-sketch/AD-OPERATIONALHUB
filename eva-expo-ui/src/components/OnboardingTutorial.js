import { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEVAApp } from "../state/EVAAppContext";

const tutorialSteps = [
  {
    tab: "home",
    icon: "sparkles",
    eyebrow: "Welcome",
    title: "Meet EVA",
    body: "EVA is your AI executive assistant. She handles briefings, tasks, meetings, and reminders — so you can stay focused on what matters. This tour takes less than a minute.",
    action: "Get started",
  },
  {
    tab: "home",
    icon: "home-outline",
    eyebrow: "Command Center",
    title: "Start here",
    body: "This is the executive overview. Use the command bar for quick requests, or tap the cards to jump into tasks, meetings, knowledge, and reminders.",
    action: "Open Home",
  },
  {
    tab: "assistant",
    icon: "sparkles-outline",
    eyebrow: "Briefing",
    title: "Ask EVA for your briefing",
    body: "Type Brief me for today, What needs attention, or Prepare my next move. EVA will answer and create tasks, meetings, or reminders when the command is clear.",
    action: "Open EVA",
  },
  {
    tab: "tasks",
    icon: "checkbox-outline",
    eyebrow: "Execution",
    title: "Track work without clutter",
    body: "Tasks created manually or through EVA appear here. Mark items done when they are complete, and they move out of the active list.",
    action: "Open Tasks",
  },
  {
    tab: "tasks",
    icon: "people-outline",
    eyebrow: "Workspace",
    title: "Switch between personal and team work",
    body: "Use the Workspace panel in Tasks to keep private work in Personal EVA or share task plans with a team workspace.",
    action: "Open Tasks",
  },
  {
    tab: "calendar",
    icon: "calendar-outline",
    eyebrow: "Time",
    title: "Create and review meetings",
    body: "Meetings created from the form or from EVA stay in the Meetings tab and can be added to your phone calendar when you enable it.",
    action: "Open Meetings",
  },
  {
    tab: "documents",
    icon: "folder-open-outline",
    eyebrow: "Memory",
    title: "Keep notes and transcripts together",
    body: "Documents is where notes, knowledge, and future transcript summaries live. This keeps EVA's memory separate from tasks and meetings.",
    action: "Open Docs",
  },
  {
    tab: "settings",
    icon: "settings-outline",
    eyebrow: "Control",
    title: "Tune EVA for you",
    body: "Settings lets you update your profile, manage workspace members, adjust calendar behavior, reminders, and voice preferences.",
    action: "Open Settings",
  },
];

export function OnboardingTutorial({ visible, onComplete, onNavigate }) {
  const { theme } = useEVAApp();
  const { width, height } = useWindowDimensions();
  const layout = useMemo(
    () => ({
      compact: width < 390,
      maxCardHeight: Math.max(420, Math.round(height * 0.82)),
    }),
    [height, width]
  );
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme, layout), [theme, layout]);
  const [stepIndex, setStepIndex] = useState(0);
  const step = tutorialSteps[stepIndex];
  const isLastStep = stepIndex === tutorialSteps.length - 1;

  function openStepTab() {
    onNavigate(step.tab);
  }

  function nextStep() {
    if (isLastStep) {
      setStepIndex(0);
      onComplete?.();
      return;
    }

    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    onNavigate(tutorialSteps[nextIndex].tab);
  }

  function closeTutorial() {
    setStepIndex(0);
    onComplete();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeTutorial}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.cardContent}
          >
          <View style={styles.topRow}>
            <View style={styles.iconWrap}>
              <Ionicons name={step.icon} size={24} color={colors.electric} />
            </View>
            <View style={styles.stepCopy}>
              <Text style={styles.eyebrow}>{step.eyebrow}</Text>
              <Text style={styles.count}>
                {stepIndex + 1} of {tutorialSteps.length}
              </Text>
            </View>
            <TouchableOpacity activeOpacity={0.84} style={styles.closeButton} onPress={closeTutorial}>
              <Ionicons name="close" size={20} color={colors.textSoft} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>

          <View style={styles.dots}>
            {tutorialSteps.map((item, index) => (
              <View
                key={index}
                style={[styles.dot, index === stepIndex && styles.activeDot]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity activeOpacity={0.84} style={styles.secondaryButton} onPress={openStepTab}>
              <Text style={styles.secondaryText}>{step.action}</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.86} style={styles.primaryButton} onPress={nextStep}>
              <Text style={styles.primaryText}>{isLastStep ? "Finish" : "Next"}</Text>
              <Ionicons
                name={isLastStep ? "checkmark" : "arrow-forward"}
                size={18}
                color={colors.white}
              />
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles({ colors, radii, shadows, spacing, type }, layout) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      paddingHorizontal: layout.compact ? spacing.md : spacing.xl,
      paddingBottom: layout.compact ? spacing.lg : spacing.xxl,
      backgroundColor: colors.isDark ? "rgba(3, 7, 18, 0.62)" : "rgba(15, 23, 42, 0.26)",
      zIndex: 90,
      elevation: 90,
    },
    card: {
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
      overflow: "hidden",
      maxHeight: layout.maxCardHeight,
      backgroundColor: colors.isDark ? colors.surface : colors.white,
      ...shadows.glow,
    },
    cardContent: {
      padding: layout.compact ? spacing.lg : spacing.xl,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    stepCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    eyebrow: {
      ...type.micro,
      color: colors.electric,
    },
    count: {
      ...type.caption,
      color: colors.textMuted,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    title: {
      ...type.h1,
      marginTop: spacing.xl,
      color: colors.text,
    },
    body: {
      ...type.body,
      marginTop: spacing.sm,
      color: colors.textSoft,
    },
    dots: {
      flexDirection: "row",
      gap: spacing.xs,
      marginTop: spacing.xl,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.textMuted,
      opacity: 0.42,
    },
    activeDot: {
      width: 22,
      backgroundColor: colors.electric,
      opacity: 1,
    },
    actions: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: radii.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    secondaryText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "800",
    },
    primaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: radii.lg,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: spacing.sm,
      backgroundColor: colors.blue,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
    },
    primaryText: {
      color: colors.white,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "800",
    },
  });
}
