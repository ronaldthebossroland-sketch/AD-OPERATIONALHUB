import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useEVAApp } from "../state/EVAAppContext";

export function GlowCard({ children, style, elevated = false }) {
  const { theme } = useEVAApp();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const gradientColors = elevated
    ? [colors.glassHighlight, colors.glassSurfaceElevated, colors.cardElevated]
    : [colors.glassHighlight, colors.glassSurface, colors.card];

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, elevated && styles.elevated, style]}
    >
      <View pointerEvents="none" style={styles.sheen} />
      {children}
    </LinearGradient>
  );
}

function createStyles({ colors, radii, shadows, spacing }) {
  return StyleSheet.create({
    card: {
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.lg,
      ...shadows.card,
    },
    elevated: {
      borderColor: colors.glassBorderStrong,
    },
    sheen: {
      position: "absolute",
      top: 0,
      left: spacing.lg,
      right: spacing.lg,
      height: 1,
      backgroundColor: colors.glassHighlight,
      opacity: colors.isDark ? 0.62 : 0.78,
    },
  });
}
