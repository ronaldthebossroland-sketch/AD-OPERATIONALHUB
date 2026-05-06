import { useMemo } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useEVAApp } from "../state/EVAAppContext";

export function CommandInput({
  placeholder = "Command or ask EVA...",
  value,
  onChangeText,
  onSubmit,
  disabled = false,
}) {
  const { theme } = useEVAApp();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <LinearGradient
      colors={[colors.glassHighlight, colors.inputStrong, colors.glassSurface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.inputShell}
    >
      <View pointerEvents="none" style={styles.sheen} />
      <Ionicons name="sparkles-outline" size={18} color={colors.electric} />
      <TextInput
        autoCorrect
        multiline
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
      />
      <TouchableOpacity
        activeOpacity={0.82}
        disabled={disabled || !value?.trim()}
        onPress={onSubmit}
        style={[styles.sendButton, (disabled || !value?.trim()) && styles.disabled]}
      >
        <LinearGradient
          colors={[colors.electric, colors.blue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sendButtonGloss}
        >
          <Ionicons name="arrow-up" size={18} color={colors.white} />
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
}

function createStyles({ colors, radii, shadows, spacing, type }) {
  return StyleSheet.create({
    inputShell: {
      minHeight: 58,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
      paddingHorizontal: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      ...shadows.glow,
    },
    input: {
      ...type.body,
      flex: 1,
      maxHeight: 96,
      paddingVertical: spacing.sm,
      color: colors.text,
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      overflow: "hidden",
    },
    sendButtonGloss: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    disabled: {
      opacity: 0.42,
    },
    sheen: {
      position: "absolute",
      top: 0,
      left: spacing.lg,
      right: spacing.lg,
      height: 1,
      backgroundColor: colors.glassHighlight,
      opacity: colors.isDark ? 0.58 : 0.8,
    },
  });
}
