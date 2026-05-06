import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useEVAApp } from "../state/EVAAppContext";

export function StatusPill({ status = "neutral", label }) {
  const { theme } = useEVAApp();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const statusMap = useMemo(
    () => ({
      high: { color: colors.high, label: "High risk" },
      attention: { color: colors.amber, label: "Needs attention" },
      stable: { color: colors.green, label: "Stable" },
      neutral: { color: colors.electric, label: "Ready" },
    }),
    [colors]
  );
  const mapped = statusMap[status] || statusMap.neutral;

  return (
    <View style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: mapped.color }]} />
      <Text style={styles.label}>{label || mapped.label}</Text>
    </View>
  );
}

function createStyles({ colors, radii, spacing }) {
  return StyleSheet.create({
    pill: {
      alignSelf: "flex-start",
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassButton,
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
}
