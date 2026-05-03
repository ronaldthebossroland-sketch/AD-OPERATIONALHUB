import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../theme";

const statusMap = {
  high: { color: colors.high, label: "High risk" },
  attention: { color: colors.amber, label: "Needs attention" },
  stable: { color: colors.green, label: "Stable" },
  neutral: { color: colors.electric, label: "Ready" },
};

export function StatusPill({ status = "neutral", label }) {
  const mapped = statusMap[status] || statusMap.neutral;
  return (
    <View style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: mapped.color }]} />
      <Text style={styles.label}>{label || mapped.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    color: colors.textSoft,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
});
