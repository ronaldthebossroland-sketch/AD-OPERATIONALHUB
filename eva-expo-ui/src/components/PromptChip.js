import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "../theme";

export function PromptChip({ label, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.8} style={styles.chip} onPress={onPress}>
      <Ionicons name="flash-outline" size={14} color={colors.electric} />
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    minHeight: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(29, 49, 88, 0.62)",
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
