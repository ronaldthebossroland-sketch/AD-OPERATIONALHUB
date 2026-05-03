import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, shadows, spacing } from "../theme";

const items = [
  { id: "eva", label: "EVA", icon: "sparkles-outline", activeIcon: "sparkles" },
  { id: "calendar", label: "Calendar", icon: "calendar-outline", activeIcon: "calendar" },
  { id: "operations", label: "Operations", icon: "layers-outline", activeIcon: "layers" },
  { id: "transcripts", label: "Transcripts", icon: "document-text-outline", activeIcon: "document-text" },
  { id: "settings", label: "Settings", icon: "settings-outline", activeIcon: "settings" },
];

export function BottomNav({ activeTab, onChange }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        {items.map((item) => {
          const active = item.id === activeTab;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.82}
              style={[styles.item, active && styles.activeItem]}
              onPress={() => onChange(item.id)}
            >
              <Ionicons
                name={active ? item.activeIcon : item.icon}
                size={20}
                color={active ? colors.electric : colors.textMuted}
              />
              <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  nav: {
    minHeight: 72,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(9, 18, 37, 0.92)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    ...shadows.card,
  },
  item: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.lg,
  },
  activeItem: {
    backgroundColor: "rgba(56, 189, 248, 0.1)",
  },
  label: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  activeLabel: {
    color: colors.text,
  },
});
