import { useMemo } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useEVAApp } from "../state/EVAAppContext";

export function ScreenHeader({ title, subtitle, eyebrow }) {
  const { theme } = useEVAApp();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const styles = useMemo(() => createStyles(theme, compact), [compact, theme]);

  return (
    <View style={styles.wrap}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function createStyles({ colors, spacing, type }, compact) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: compact ? spacing.lg : spacing.xl,
      paddingTop: compact ? spacing.xxl : spacing.xxxl,
      paddingBottom: compact ? spacing.lg : spacing.xl,
    },
    eyebrow: {
      ...type.micro,
      marginBottom: spacing.sm,
      color: colors.electric,
    },
    title: {
      ...type.display,
      fontSize: compact ? 26 : type.display.fontSize,
      lineHeight: compact ? 32 : type.display.lineHeight,
    },
    subtitle: {
      ...type.body,
      marginTop: spacing.xs,
    },
  });
}
