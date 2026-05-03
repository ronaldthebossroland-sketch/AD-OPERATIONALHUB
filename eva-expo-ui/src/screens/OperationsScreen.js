import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { GlowCard } from "../components/GlowCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionTitle } from "../components/SectionTitle";
import { StatusPill } from "../components/StatusPill";
import { getOperations, getTasks } from "../lib/api";
import { colors, spacing, type } from "../theme";

const borderForStatus = {
  high: colors.high,
  attention: colors.amber,
  stable: colors.green,
};

export function OperationsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadOperations() {
      try {
        const [operationsData, tasksData] = await Promise.all([
          getOperations().catch(() => ({ operations: [] })),
          getTasks().catch(() => ({ tasks: [] })),
        ]);
        const combined = [
          ...(operationsData.operations || []),
          ...(tasksData.tasks || []),
        ];

        if (mounted) {
          setItems(combined);
          setError("");
        }
      } catch (loadError) {
        if (mounted) {
          setItems([]);
          setError(loadError.message || "Could not load operations.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadOperations();
    return () => {
      mounted = false;
    };
  }, []);

  const counts = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const status = normalizeStatus(item);
        acc[status] += 1;
        return acc;
      },
      { high: 0, attention: 0, stable: 0 }
    );
  }, [items]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ScreenHeader title="Operations" subtitle="Execution layer for decisions and follow-through" eyebrow="Execution Layer" />
      <View style={styles.padded}>
        <View style={styles.summaryRow}>
          <SummaryMetric label="High" value={String(counts.high)} color={colors.high} />
          <SummaryMetric label="Attention" value={String(counts.attention)} color={colors.amber} />
          <SummaryMetric label="Stable" value={String(counts.stable)} color={colors.green} />
        </View>

        <SectionTitle title="Priority Stack" action="EVA ranked" />
        <View style={styles.stack}>
          {loading ? (
            <GlowCard>
              <ActivityIndicator color={colors.electric} />
            </GlowCard>
          ) : items.length ? (
            items.slice(0, 12).map((item, index) => {
              const status = normalizeStatus(item);
              return (
                <GlowCard
                  key={String(item.id || index)}
                  style={[styles.operationCard, { borderColor: borderForStatus[status] }]}
                >
                  <StatusPill status={status} />
                  <Text style={styles.operationTitle}>{item.title || item.name || "Untitled operation"}</Text>
                  <Text style={styles.operationMeta}>
                    {item.detail || item.description || item.meta || item.status || "No details added yet."}
                  </Text>
                </GlowCard>
              );
            })
          ) : (
            <GlowCard style={styles.operationCard}>
              <Text style={styles.operationTitle}>No operations yet</Text>
              <Text style={styles.operationMeta}>Ask EVA to create the first operation or task.</Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </GlowCard>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function normalizeStatus(item) {
  const text = [
    item.severity,
    item.priority,
    item.status,
    item.risk,
    item.title,
    item.detail,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(high|critical|urgent|overdue|risk)\b/.test(text)) {
    return "high";
  }

  if (/\b(medium|attention|waiting|pending|review)\b/.test(text)) {
    return "attention";
  }

  return "stable";
}

function SummaryMetric({ label, value, color }) {
  return (
    <GlowCard style={styles.metric}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
  padded: {
    paddingHorizontal: spacing.xl,
  },
  summaryRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  metric: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  metricValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  metricLabel: {
    ...type.caption,
    marginTop: spacing.xs,
  },
  stack: {
    gap: spacing.md,
  },
  operationCard: {
    gap: spacing.sm,
  },
  operationTitle: {
    ...type.h2,
  },
  operationMeta: {
    ...type.body,
  },
  errorText: {
    ...type.caption,
    color: colors.amber,
  },
});
