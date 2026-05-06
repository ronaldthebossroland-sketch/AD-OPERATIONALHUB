import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useEVAApp } from "../state/EVAAppContext";

export function PromptChip({ label, onPress }) {
  const { theme } = useEVAApp();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity activeOpacity={0.8} style={styles.chip} onPress={onPress}>
      <LinearGradient
        colors={[colors.glassHighlight, colors.chip, colors.glassButton]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.inner}
      >
        <Ionicons name="flash-outline" size={14} color={colors.electric} />
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function createStyles({ colors, radii, spacing }) {
  return StyleSheet.create({
    chip: {
      alignSelf: "flex-start",
      minHeight: 36,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      overflow: "hidden",
    },
    inner: {
      minHeight: 36,
      paddingHorizontal: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    label: {
      color: colors.textSoft,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
    },
  });
}
