import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlowCard } from "../components/GlowCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionTitle } from "../components/SectionTitle";
import { StatusPill } from "../components/StatusPill";
import { getCalendarEvents } from "../lib/api";
import { colors, spacing, type } from "../theme";

export function CalendarScreen() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadEvents() {
      try {
        const data = await getCalendarEvents();
        if (mounted) {
          setEvents(data.events || data.calendarEvents || []);
          setError("");
        }
      } catch (loadError) {
        if (mounted) {
          setEvents([]);
          setError(loadError.message || "Could not load calendar.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadEvents();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleEvents = useMemo(() => events.slice(0, 8), [events]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ScreenHeader title="Calendar" subtitle="Time intelligence for your day" eyebrow="Time Layer" />
      <View style={styles.padded}>
        <GlowCard elevated style={styles.aiHint}>
          <View style={styles.hintIcon}>
            <Ionicons name="time-outline" size={22} color={colors.electric} />
          </View>
          <View style={styles.hintCopy}>
            <Text style={styles.hintTitle}>You have a 2-hour gap available</Text>
            <Text style={styles.hintText}>Best window for preparation or a focused decision block.</Text>
          </View>
        </GlowCard>

        <SectionTitle title="Today Timeline" action="Smart view" />
        <GlowCard style={styles.timeline}>
          {loading ? (
            <ActivityIndicator color={colors.electric} />
          ) : visibleEvents.length ? (
            visibleEvents.map((event, index) => (
              <View key={String(event.id || index)} style={styles.eventRow}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeText}>{formatEventTime(event)}</Text>
                  {index < visibleEvents.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={styles.eventCard}>
                  <Text style={styles.eventTitle}>{event.title || "Untitled event"}</Text>
                  <Text style={styles.eventMeta}>
                    {event.detail || event.meta || event.location || event.eventType || "Scheduled item"}
                  </Text>
                  <StatusPill status="neutral" label={event.sourceType || event.eventType || "Event"} />
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No calendar events yet</Text>
              <Text style={styles.emptyText}>
                Ask EVA to schedule your first meeting.
              </Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          )}
        </GlowCard>

        <SectionTitle title="Upcoming Meetings" />
        <GlowCard>
          <Text style={styles.upcomingTitle}>Tomorrow's leadership review</Text>
          <Text style={styles.upcomingText}>EVA recommends preparing decisions, risks, and follow-up owners tonight.</Text>
        </GlowCard>
      </View>
    </ScrollView>
  );
}

function formatEventTime(event) {
  const value = event.startAt || event.start_at || event.time || event.created_at;
  const date = value ? new Date(value) : null;

  if (date && !Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return typeof value === "string" && value.length <= 8 ? value : "--:--";
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
  padded: {
    paddingHorizontal: spacing.xl,
  },
  aiHint: {
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
    backgroundColor: "rgba(56, 189, 248, 0.12)",
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
  timeline: {
    gap: spacing.md,
  },
  eventRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  timeColumn: {
    width: 52,
    alignItems: "center",
  },
  timeText: {
    ...type.caption,
    color: colors.electric,
  },
  line: {
    flex: 1,
    width: 1,
    marginTop: spacing.sm,
    backgroundColor: colors.border,
  },
  eventCard: {
    flex: 1,
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    gap: spacing.sm,
  },
  eventTitle: {
    ...type.h2,
  },
  eventMeta: {
    ...type.caption,
    color: colors.textSoft,
  },
  upcomingTitle: {
    ...type.h2,
  },
  upcomingText: {
    ...type.body,
    marginTop: spacing.sm,
  },
  emptyState: {
    gap: spacing.sm,
  },
  emptyTitle: {
    ...type.h2,
  },
  emptyText: {
    ...type.body,
  },
  errorText: {
    ...type.caption,
    color: colors.amber,
  },
});
