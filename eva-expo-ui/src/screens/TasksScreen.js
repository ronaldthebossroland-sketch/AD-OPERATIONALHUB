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
  const { theme, activeTasks, completedTasks, addTask, updateTaskStatus } = useEVAApp();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme, compact), [compact, theme]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [priority, setPriority] = useState("High");
  const [showCompleted, setShowCompleted] = useState(false);

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

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ScreenHeader title="Tasks" subtitle="Execution items and follow-up actions" eyebrow="Action Layer" />
      <View style={styles.padded}>
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

        <SectionTitle title="Task Board" action={`${activeTasks.length} active`} />
        <View style={styles.stack}>
          {activeTasks.length ? activeTasks.map((task) => (
            <GlowCard key={task.id} style={styles.taskCard}>
              <View style={styles.taskTop}>
                <StatusPill status={statusForPriority(task.priority)} label={task.priority} />
                <Text style={styles.dueText}>{task.due}</Text>
              </View>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.taskDetail}>{task.detail}</Text>
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
