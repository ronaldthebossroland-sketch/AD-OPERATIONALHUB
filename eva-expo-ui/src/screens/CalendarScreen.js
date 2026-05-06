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

export function CalendarScreen() {
  const {
    theme,
    meetings,
    addMeeting,
    rescheduleMeeting,
    handleAssistantCommand,
    phoneCalendarSyncEnabled,
    defaultMeetingReminderMinutes,
  } = useEVAApp();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme, compact), [compact, theme]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("Today");
  const [time, setTime] = useState("");
  const [attendees, setAttendees] = useState("");
  const [creating, setCreating] = useState(false);
  const [formStatus, setFormStatus] = useState("");

  async function submitMeeting() {
    if (!title.trim()) {
      return;
    }

    setCreating(true);
    setFormStatus("Creating meeting...");

    try {
      const meeting = await addMeeting({
        title: title.trim(),
        date: date.trim() || "Today",
        time: time.trim() || "10:00 AM",
        attendees: attendees.trim() || "Team",
        briefing: "EVA will prepare context, decisions, and follow-up owners.",
        reminder: `${defaultMeetingReminderMinutes} minutes before`,
      });

      setFormStatus(calendarStatusCopy(meeting, phoneCalendarSyncEnabled));
      setTitle("");
      setDate("Today");
      setTime("");
      setAttendees("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ScreenHeader title="Calendar / Meetings" subtitle="Time intelligence and scheduling" eyebrow="Time Layer" />
      <View style={styles.padded}>
        <GlowCard elevated style={styles.hintCard}>
          <View style={styles.hintIcon}>
            <Ionicons name="time-outline" size={22} color={colors.electric} />
          </View>
          <View style={styles.hintCopy}>
            <Text style={styles.hintTitle}>Schedule overview</Text>
            <Text style={styles.hintText}>{schedulingHint(meetings)}</Text>
          </View>
        </GlowCard>

        <SectionTitle title="Create Meeting" />
        <GlowCard style={styles.form}>
          <Field styles={styles} colors={colors} placeholder="Meeting title" value={title} onChangeText={setTitle} />
          <View style={styles.twoColumn}>
            <Field styles={styles} colors={colors} placeholder="Day" value={date} onChangeText={setDate} style={styles.halfField} />
            <Field styles={styles} colors={colors} placeholder="Time" value={time} onChangeText={setTime} style={styles.halfField} />
          </View>
          <Field styles={styles} colors={colors} placeholder="Attendees" value={attendees} onChangeText={setAttendees} />
          <TouchableOpacity
            activeOpacity={0.86}
            disabled={creating}
            style={[styles.primaryButton, creating && styles.primaryButtonDisabled]}
            onPress={submitMeeting}
          >
            <Ionicons name="calendar" size={18} color={colors.white} />
            <Text style={styles.primaryButtonText}>
              {creating ? "Adding Meeting" : "Add Meeting"}
            </Text>
          </TouchableOpacity>
          {formStatus ? <Text style={styles.formStatus}>{formStatus}</Text> : null}
        </GlowCard>

        <SectionTitle title="Upcoming Meetings" action={`${meetings.length} scheduled`} />
        <View style={styles.stack}>
          {meetings.map((meeting) => {
            const badges = meetingBadges(meeting);

            return (
              <GlowCard key={meeting.id} style={styles.meetingCard}>
                <View style={styles.meetingTop}>
                  <StatusPill label={meeting.reminder} />
                  <Text style={styles.timeText}>{meeting.date} - {meeting.time}</Text>
                </View>
                {badges.length ? (
                  <View style={styles.statusRow}>
                    {badges.map((badge) => (
                      <StatusPill
                        key={badge.label}
                        status={badge.status}
                        label={badge.label}
                      />
                    ))}
                  </View>
                ) : null}
                <Text style={styles.meetingTitle}>{meeting.title}</Text>
                <Text style={styles.meetingMeta}>{meeting.attendees}</Text>
                <Text style={styles.meetingBrief}>{meeting.briefing}</Text>
                <View style={styles.actionRow}>
                  <ActionButton
                    label="Move 30m"
                    onPress={() => rescheduleMeeting(meeting.id, { time: addMinutesToTimeString(meeting.time, 30) })}
                    styles={styles}
                  />
                  <ActionButton
                    label="Prepare brief"
                    onPress={() => handleAssistantCommand(`Prepare a meeting briefing for ${meeting.title}`)}
                    styles={styles}
                  />
                </View>
              </GlowCard>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function calendarStatusCopy(meeting, syncEnabled) {
  if (!syncEnabled) {
    return "Meeting created in EVA.";
  }
  if (meeting.calendarSyncStatus === "synced") {
    return `Meeting created in EVA and added to ${meeting.calendarName || "phone calendar"}.`;
  }
  if (meeting.calendarSyncStatus === "permission_denied") {
    return "Meeting created in EVA, but calendar access was not granted.";
  }
  return "Meeting created in EVA. Phone calendar sync did not complete.";
}

function meetingBadges(meeting) {
  const badges = [];

  if (meeting.calendarSyncStatus === "synced") {
    badges.push({
      status: "stable",
      label: meeting.calendarName
        ? `On ${meeting.calendarName}`
        : "On phone calendar",
    });
  } else if (meeting.calendarSyncStatus === "permission_denied") {
    badges.push({ status: "attention", label: "Calendar access needed" });
  } else if (
    meeting.calendarSyncEnabled &&
    meeting.calendarSyncStatus &&
    meeting.calendarSyncStatus !== "not_synced"
  ) {
    badges.push({ status: "neutral", label: "Saved in EVA" });
  }

  if (meeting.reminderStatus === "scheduled") {
    badges.push({ status: "stable", label: "Reminder set" });
  } else if (meeting.reminderStatus === "permission_denied") {
    badges.push({ status: "attention", label: "Reminder access needed" });
  } else if (meeting.reminderStatus === "skipped_past_due") {
    badges.push({ status: "neutral", label: "Reminder time passed" });
  }

  return badges;
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

function schedulingHint(meetings) {
  if (meetings.length === 0) {
    return "No upcoming meetings. A good time for focused work or preparation.";
  }
  if (meetings.length === 1) {
    return "1 upcoming meeting on your schedule. EVA is ready to help you prepare.";
  }
  return `${meetings.length} upcoming meetings. Review priorities and prep before each one.`;
}

function addMinutesToTimeString(timeStr, minutes) {
  if (!timeStr) return timeStr;
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const mins = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    const totalMins = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMins / 60) % 24;
    const newMins = totalMins % 60;
    const newPeriod = newHours >= 12 ? "PM" : "AM";
    const display12 = newHours % 12 === 0 ? 12 : newHours % 12;
    return `${display12}:${String(newMins).padStart(2, "0")} ${newPeriod}`;
  }
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const mins = parseInt(match24[2], 10);
    const totalMins = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMins / 60) % 24;
    const newMins = totalMins % 60;
    return `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;
  }
  return timeStr;
}

function createStyles({ colors, radii, spacing, type }, compact) {
  return StyleSheet.create({
    content: {
      paddingBottom: 24,
    },
    padded: {
      paddingHorizontal: compact ? spacing.lg : spacing.xl,
    },
    hintCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    hintIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.glassButton,
    },
    hintCopy: {
      flex: 1,
    },
    hintTitle: {
      ...type.h2,
    },
    hintText: {
      ...type.caption,
      marginTop: spacing.xs,
      color: colors.textSoft,
    },
    form: {
      gap: spacing.md,
    },
    field: {
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
    twoColumn: {
      flexDirection: compact ? "column" : "row",
      gap: spacing.md,
    },
    halfField: {
      flex: 1,
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
    primaryButtonDisabled: {
      opacity: 0.64,
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: "800",
    },
    formStatus: {
      ...type.caption,
      color: colors.textSoft,
    },
    stack: {
      gap: spacing.md,
    },
    meetingCard: {
      gap: spacing.sm,
    },
    meetingTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    statusRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    timeText: {
      ...type.caption,
      color: colors.textSoft,
    },
    meetingTitle: {
      ...type.h2,
    },
    meetingMeta: {
      ...type.caption,
      color: colors.electric,
    },
    meetingBrief: {
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
  });
}
