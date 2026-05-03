import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, shadows, spacing, type } from "../theme";

export function CommandInput({
  placeholder = "Command or ask EVA...",
  value,
  onChangeText,
  onSubmit,
  disabled = false,
}) {
  return (
    <View style={styles.inputShell}>
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
        <Ionicons name="arrow-up" size={18} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  inputShell: {
    minHeight: 58,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(17, 30, 56, 0.86)",
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.blue,
  },
  disabled: {
    opacity: 0.42,
  },
});
