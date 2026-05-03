import { StyleSheet, View } from "react-native";
import { colors, radii, shadows, spacing } from "../theme";

export function GlowCard({ children, style, elevated = false }) {
  return <View style={[styles.card, elevated && styles.elevated, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(17, 30, 56, 0.82)",
    padding: spacing.lg,
    ...shadows.card,
  },
  elevated: {
    backgroundColor: "rgba(22, 38, 69, 0.9)",
    borderColor: "rgba(56, 189, 248, 0.16)",
  },
});
