import { useMemo, useState } from "react";
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
import { CommandInput } from "../components/CommandInput";
import { GlowCard } from "../components/GlowCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionTitle } from "../components/SectionTitle";
import { StatusPill } from "../components/StatusPill";
import { quickActions } from "../data/mockData";
import { useEVAApp } from "../state/EVAAppContext";

export function HomeScreen({ onNavigate }) {
  const {
    theme,
    activeTasks,
    meetings,
    documents,
    reminders,
    handleAssistantCommand,
    profile,
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    workspaceMode,
    workspaceStatus,
    selectWorkspace,
    createWorkspace,
    joinWorkspace,
  } = useEVAApp();
  const { width } = useWindowDimensions();
  const layout = useMemo(() => getHomeLayout(width), [width]);
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme, layout), [theme, layout]);
  const [command, setCommand] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);

  async function submitWorkspace() {
    if (!workspaceName.trim()) return;
    setWorkspaceBusy(true);
    try {
      const workspace = await createWorkspace(workspaceName.trim());
      if (workspace?.id) setWorkspaceName("");
    } finally {
      setWorkspaceBusy(false);
    }
  }

  async function submitInviteCode() {
    if (!inviteCode.trim()) return;
    setWorkspaceBusy(true);
    try {
      const workspace = await joinWorkspace(inviteCode.trim());
      if (workspace?.id) setInviteCode("");
    } finally {
      setWorkspaceBusy(false);
    }
  }
  const highTasks = activeTasks.filter((task) => task.priority === "High");
  const nextMeeting = meetings[0];
  const greetingName = getGreetingName(profile?.fullName);

  function runCommand(text = command) {
    const value = text.trim();
    if (!value) {
      return;
    }
    handleAssistantCommand(value);
    setCommand("");
    onNavigate("assistant");
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ScreenHeader
        eyebrow="Command Center"
        title={`${dayGreeting()}${greetingName ? `, ${greetingName}` : ""}`}
        subtitle="Ready when you are"
      />
      <View style={styles.padded}>
        <CommandInput
          placeholder="Command or ask anything..."
          value={command}
          onChangeText={setCommand}
          onSubmit={() => runCommand()}
        />

        <View style={styles.quickGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.title}
              activeOpacity={0.84}
              style={styles.quickAction}
              onPress={() => runCommand(action.prompt)}
            >
              <Ionicons name={action.icon} size={18} color={colors.electric} />
              <Text style={styles.quickText}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionTitle title="Workspace" />
        <GlowCard elevated style={styles.workspacePanel}>
          <View style={styles.workspaceHeader}>
            <View style={styles.workspaceHeaderCopy}>
              <Text style={styles.workspaceTitle}>
                {workspaceMode ? activeWorkspace.name : "Personal"}
              </Text>
              <Text style={styles.workspaceSubtext}>
                {workspaceMode
                  ? "Shared tasks, meetings, and reminders with your team."
                  : "Your tasks, meetings, and reminders stay private."}
              </Text>
            </View>
            <StatusPill
              status={workspaceMode ? "stable" : "neutral"}
              label={workspaceMode ? activeWorkspace.role : "Personal"}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.workspaceChips}
          >
            {workspaces.map((workspace) => (
              <TouchableOpacity
                key={workspace.id}
                activeOpacity={0.84}
                style={[
                  styles.workspaceChip,
                  activeWorkspaceId === workspace.id && styles.workspaceChipActive,
                ]}
                onPress={() => selectWorkspace(workspace.id)}
              >
                <Ionicons
                  name={workspace.type === "team" ? "people-outline" : "person-outline"}
                  size={15}
                  color={activeWorkspaceId === workspace.id ? colors.white : colors.text}
                />
                <Text
                  style={[
                    styles.workspaceChipText,
                    activeWorkspaceId === workspace.id && styles.workspaceChipTextActive,
                  ]}
                >
                  {workspace.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {workspaceMode && activeWorkspace.inviteCode ? (
            <Text style={styles.workspaceCode}>
              Invite code: {activeWorkspace.inviteCode}
            </Text>
          ) : null}
          <View style={styles.workspaceActions}>
            <WorkspaceField
              colors={colors}
              styles={styles}
              placeholder="New workspace name"
              value={workspaceName}
              onChangeText={setWorkspaceName}
            />
            <TouchableOpacity
              activeOpacity={0.86}
              disabled={workspaceBusy}
              style={[styles.workspaceButton, workspaceBusy && styles.workspaceButtonDisabled]}
              onPress={submitWorkspace}
            >
              <Ionicons name="briefcase-outline" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.workspaceActions}>
            <WorkspaceField
              colors={colors}
              styles={styles}
              placeholder="Invite code"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              activeOpacity={0.86}
              disabled={workspaceBusy}
              style={[styles.workspaceButton, workspaceBusy && styles.workspaceButtonDisabled]}
              onPress={submitInviteCode}
            >
              <Ionicons name="enter-outline" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
          {workspaceStatus &&
          !["personal", "connected", "loading"].includes(String(workspaceStatus)) ? (
            <Text style={styles.workspaceStatusText}>{workspaceStatus}</Text>
          ) : null}
        </GlowCard>

        <SectionTitle title="Today" />
        <View style={styles.metricGrid}>
          <MetricCard
            label="Open tasks"
            value={String(activeTasks.length)}
            icon="checkbox-outline"
            onPress={() => onNavigate("tasks")}
            colors={colors}
            styles={styles}
          />
          <MetricCard
            label="Meetings"
            value={String(meetings.length)}
            icon="calendar-outline"
            onPress={() => onNavigate("calendar")}
            colors={colors}
            styles={styles}
          />
          <MetricCard
            label="Knowledge"
            value={String(documents.length)}
            icon="folder-open-outline"
            onPress={() => onNavigate("documents")}
            colors={colors}
            styles={styles}
          />
          <MetricCard
            label="Reminders"
            value={String(reminders.length)}
            icon="alarm-outline"
            onPress={() => onNavigate("assistant")}
            colors={colors}
            styles={styles}
          />
        </View>

        <SectionTitle title="Next Move" />
        <GlowCard elevated style={styles.nextCard}>
          <StatusPill status={highTasks.length ? "high" : "stable"} />
          <Text style={styles.cardTitle}>
            {highTasks.length ? highTasks[0].title : "Your priority stack is stable"}
          </Text>
          <Text style={styles.cardText}>
            {highTasks.length
              ? `${highTasks[0].detail} Due ${highTasks[0].due}.`
              : "EVA recommends using the next open block for preparation."}
          </Text>
        </GlowCard>

        <SectionTitle title="Upcoming" />
        <GlowCard style={styles.meetingCard}>
          <View style={styles.meetingIcon}>
            <Ionicons name="calendar" size={20} color={colors.electric} />
          </View>
          <View style={styles.meetingCopy}>
            <Text style={styles.cardTitle}>{nextMeeting?.title || "No meeting scheduled"}</Text>
            <Text style={styles.cardText}>
              {nextMeeting
                ? `${nextMeeting.date} at ${nextMeeting.time}. ${nextMeeting.briefing}`
                : "Ask EVA to schedule your next meeting."}
            </Text>
          </View>
        </GlowCard>
      </View>
    </ScrollView>
  );
}

function WorkspaceField({ colors, styles, ...props }) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      style={[styles.workspaceField]}
      {...props}
    />
  );
}

function MetricCard({ label, value, icon, onPress, colors, styles }) {
  return (
    <TouchableOpacity activeOpacity={0.84} style={styles.metric} onPress={onPress}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={20} color={colors.electric} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function getHomeLayout(width) {
  const compact = width < 390;
  const wide = width >= 700;
  return { compact, wide };
}

function dayGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getGreetingName(fullName) {
  const cleaned = String(fullName || "").trim();
  if (!cleaned || /^eva user$/i.test(cleaned)) {
    return "";
  }
  return cleaned.split(/\s+/)[0];
}

function createStyles({ colors, radii, spacing, type }, layout) {
  const quickBasis = layout.compact ? "100%" : layout.wide ? "31%" : "47%";
  const metricBasis = layout.compact ? "100%" : layout.wide ? "22%" : "47%";

  return StyleSheet.create({
    content: {
      paddingBottom: 24,
    },
    padded: {
      paddingHorizontal: layout.compact ? spacing.lg : spacing.xl,
    },
    quickGrid: {
      marginTop: spacing.lg,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    quickAction: {
      flexGrow: 1,
      flexBasis: quickBasis,
      minHeight: 48,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
      paddingHorizontal: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    quickText: {
      ...type.caption,
      flex: 1,
      color: colors.textSoft,
    },
    metricGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    metric: {
      flexGrow: 1,
      flexBasis: metricBasis,
      minHeight: 132,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
      padding: spacing.lg,
    },
    metricIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.glassButton,
    },
    metricValue: {
      marginTop: spacing.lg,
      fontSize: 30,
      lineHeight: 34,
      fontWeight: "800",
      color: colors.text,
    },
    metricLabel: {
      ...type.caption,
      marginTop: spacing.xs,
    },
    workspacePanel: {
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    workspaceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: spacing.md,
    },
    workspaceHeaderCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    workspaceTitle: {
      ...type.h2,
    },
    workspaceSubtext: {
      ...type.body,
    },
    workspaceChips: {
      gap: spacing.sm,
      paddingRight: spacing.md,
    },
    workspaceChip: {
      minHeight: 38,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    workspaceChipActive: {
      backgroundColor: colors.blue,
      borderColor: colors.glassBorderStrong,
    },
    workspaceChipText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
    },
    workspaceChipTextActive: {
      color: colors.white,
    },
    workspaceCode: {
      ...type.caption,
      color: colors.electric,
    },
    workspaceActions: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "center",
    },
    workspaceField: {
      flex: 1,
      minHeight: 48,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.input,
      paddingHorizontal: spacing.md,
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    workspaceButton: {
      width: 48,
      minHeight: 48,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    workspaceButtonDisabled: {
      opacity: 0.7,
    },
    workspaceStatusText: {
      ...type.caption,
      color: colors.amber,
    },
    nextCard: {
      gap: spacing.sm,
    },
    cardTitle: {
      ...type.h2,
    },
    cardText: {
      ...type.body,
    },
    meetingCard: {
      flexDirection: "row",
      gap: spacing.md,
    },
    meetingIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.glassButton,
    },
    meetingCopy: {
      flex: 1,
      gap: spacing.xs,
    },
  });
}
