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
import { GlowCard } from "../components/GlowCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionTitle } from "../components/SectionTitle";
import { StatusPill } from "../components/StatusPill";
import { useEVAApp } from "../state/EVAAppContext";

const priorities = ["High", "Medium", "Low"];

export function TasksScreen() {
  const {
    theme,
    activeTasks,
    completedTasks,
    addTask,
    updateTaskStatus,
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
  const compact = width < 390;
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme, compact), [compact, theme]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [priority, setPriority] = useState("High");
  const [showCompleted, setShowCompleted] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);

  function submitTask() {
    if (!title.trim()) {
      return;
    }
    addTask({
      title: title.trim(),
      detail: detail.trim() || "Manual task from preview.",
      priority,
      due: "Today",
    });
    setTitle("");
    setDetail("");
    setPriority("High");
  }

  async function submitWorkspace() {
    if (!workspaceName.trim()) {
      return;
    }

    setWorkspaceBusy(true);
    try {
      const workspace = await createWorkspace(workspaceName.trim());
      if (workspace?.id) {
        setWorkspaceName("");
      }
    } finally {
      setWorkspaceBusy(false);
    }
  }

  async function submitInviteCode() {
    if (!inviteCode.trim()) {
      return;
    }

    setWorkspaceBusy(true);
    try {
      const workspace = await joinWorkspace(inviteCode.trim());
      if (workspace?.id) {
        setInviteCode("");
      }
    } finally {
      setWorkspaceBusy(false);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ScreenHeader title="Tasks" subtitle="Execution items and follow-up actions" eyebrow="Action Layer" />
      <View style={styles.padded}>
        <GlowCard elevated style={styles.workspacePanel}>
          <View style={styles.workspaceHeader}>
            <View>
              <Text style={styles.formTitle}>Workspace</Text>
              <Text style={styles.workspaceSubtext}>
                {workspaceMode
                  ? `${activeWorkspace.name} tasks are shared with the team.`
                  : "Personal EVA tasks stay private to you."}
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
            <Field
              styles={styles}
              colors={colors}
              placeholder="New workspace name"
              value={workspaceName}
              onChangeText={setWorkspaceName}
              style={styles.workspaceField}
            />
            <TouchableOpacity
              activeOpacity={0.86}
              disabled={workspaceBusy}
              style={[styles.secondaryButton, workspaceBusy && styles.secondaryButtonDisabled]}
              onPress={submitWorkspace}
            >
              <Ionicons name="briefcase-outline" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.workspaceActions}>
            <Field
              styles={styles}
              colors={colors}
              placeholder="Invite code"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              style={styles.workspaceField}
            />
            <TouchableOpacity
              activeOpacity={0.86}
              disabled={workspaceBusy}
              style={[styles.secondaryButton, workspaceBusy && styles.secondaryButtonDisabled]}
              onPress={submitInviteCode}
            >
              <Ionicons name="enter-outline" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
          {workspaceStatus &&
          !["personal", "connected", "loading"].includes(String(workspaceStatus)) ? (
            <Text style={styles.workspaceStatus}>{workspaceStatus}</Text>
          ) : null}
        </GlowCard>

        <GlowCard elevated style={styles.form}>
          <Text style={styles.formTitle}>Create task</Text>
          <Field styles={styles} colors={colors} placeholder="Task title" value={title} onChangeText={setTitle} />
          <Field
            styles={styles}
            colors={colors}
            placeholder="Details or owner"
            value={detail}
            onChangeText={setDetail}
            multiline
          />
          <View style={styles.priorityRow}>
            {priorities.map((item) => (
              <TouchableOpacity
                key={item}
                activeOpacity={0.84}
                style={[styles.priorityChip, priority === item && styles.priorityChipActive]}
                onPress={() => setPriority(item)}
              >
                <Text style={[styles.priorityText, priority === item && styles.priorityTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity activeOpacity={0.86} style={styles.primaryButton} onPress={submitTask}>
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.primaryButtonText}>Add Task</Text>
          </TouchableOpacity>
        </GlowCard>

        <SectionTitle
          title={workspaceMode ? "Shared Task Board" : "Task Board"}
          action={`${activeTasks.length} active`}
        />
        <View style={styles.stack}>
          {activeTasks.length ? activeTasks.map((task) => (
            <GlowCard key={task.id} style={styles.taskCard}>
              <View style={styles.taskTop}>
                <StatusPill status={statusForPriority(task.priority)} label={task.priority} />
                <Text style={styles.dueText}>{task.due}</Text>
              </View>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.taskDetail}>{task.detail}</Text>
              {task.workspaceId ? (
                <Text style={styles.workspaceMeta}>
                  Shared in {activeWorkspace.name}
                  {task.owner ? ` by ${task.owner}` : ""}
                </Text>
              ) : null}
              <View style={styles.actionRow}>
                <ActionButton label="In progress" onPress={() => updateTaskStatus(task.id, "In progress")} styles={styles} />
                <ActionButton label="Done" onPress={() => updateTaskStatus(task.id, "Done")} styles={styles} />
              </View>
              <Text style={styles.statusText}>Status: {task.status}</Text>
            </GlowCard>
          )) : (
            <GlowCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No active tasks</Text>
              <Text style={styles.emptyText}>Completed tasks are moved out of the board so today stays clean.</Text>
            </GlowCard>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.84}
          style={styles.completedToggle}
          onPress={() => setShowCompleted((current) => !current)}
        >
          <Ionicons name="checkmark-done-outline" size={18} color={colors.electric} />
          <Text style={styles.completedToggleText}>
            {showCompleted ? "Hide completed" : `Show completed (${completedTasks.length})`}
          </Text>
        </TouchableOpacity>

        {showCompleted ? (
          <>
            <SectionTitle title="Completed" action={`${completedTasks.length} done`} />
            <View style={styles.stack}>
              {completedTasks.length ? completedTasks.map((task) => (
                <GlowCard key={task.id} style={styles.completedCard}>
                  <View style={styles.taskTop}>
                    <StatusPill status="stable" label="Done" />
                    <Text style={styles.dueText}>{task.due}</Text>
                  </View>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskDetail}>{task.detail}</Text>
                  <View style={styles.actionRow}>
                    <ActionButton label="Reopen" onPress={() => updateTaskStatus(task.id, "To do")} styles={styles} />
                  </View>
                </GlowCard>
              )) : (
                <GlowCard style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nothing completed yet</Text>
                  <Text style={styles.emptyText}>When you mark tasks Done, they will appear here instead of crowding the active board.</Text>
                </GlowCard>
              )}
            </View>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Field({ styles, colors, style, ...props }) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      style={[styles.field, style]}
      {...props}
    />
  );
}

function ActionButton({ label, onPress, styles }) {
  return (
    <TouchableOpacity activeOpacity={0.84} style={styles.actionButton} onPress={onPress}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function statusForPriority(priority) {
  if (priority === "High") {
    return "high";
  }
  if (priority === "Low") {
    return "stable";
  }
  return "attention";
}

function createStyles({ colors, radii, spacing, type }, compact) {
  return StyleSheet.create({
    content: {
      paddingBottom: 24,
    },
    padded: {
      paddingHorizontal: compact ? spacing.lg : spacing.xl,
    },
    workspacePanel: {
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    workspaceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.md,
      alignItems: "flex-start",
    },
    workspaceSubtext: {
      ...type.body,
      marginTop: spacing.xs,
      maxWidth: compact ? 230 : 520,
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
    },
    secondaryButton: {
      width: 48,
      minHeight: 48,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryButtonDisabled: {
      opacity: 0.7,
    },
    workspaceStatus: {
      ...type.caption,
      color: colors.amber,
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
    priorityRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    priorityChip: {
      flexGrow: 1,
      flexBasis: compact ? "100%" : 0,
      minHeight: 40,
      borderRadius: radii.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.glassSurface,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    priorityChipActive: {
      borderColor: colors.glassBorderStrong,
      backgroundColor: colors.glassButton,
    },
    priorityText: {
      ...type.caption,
    },
    priorityTextActive: {
      color: colors.text,
    },
    primaryButton: {
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
    stack: {
      gap: spacing.md,
    },
    taskCard: {
      gap: spacing.sm,
    },
    completedCard: {
      gap: spacing.sm,
      opacity: 0.88,
    },
    taskTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    dueText: {
      ...type.caption,
      color: colors.textSoft,
    },
    taskTitle: {
      ...type.h2,
    },
    taskDetail: {
      ...type.body,
    },
    workspaceMeta: {
      ...type.caption,
      color: colors.electric,
    },
    actionRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    actionButton: {
      minHeight: 36,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
    },
    actionButtonText: {
      ...type.caption,
      color: colors.text,
    },
    statusText: {
      ...type.caption,
    },
    emptyCard: {
      gap: spacing.xs,
    },
    emptyTitle: {
      ...type.h2,
    },
    emptyText: {
      ...type.body,
    },
    completedToggle: {
      marginTop: spacing.lg,
      minHeight: 48,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    completedToggleText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "800",
    },
  });
}
