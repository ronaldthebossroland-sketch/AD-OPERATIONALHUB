import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useEVAApp } from "../state/EVAAppContext";

const items = [
  { id: "home", label: "Home", icon: "home-outline", activeIcon: "home" },
  { id: "assistant", label: "EVA", icon: "sparkles-outline", activeIcon: "sparkles" },
  { id: "tasks", label: "Tasks", icon: "checkbox-outline", activeIcon: "checkbox" },
  { id: "calendar", label: "Meetings", icon: "calendar-outline", activeIcon: "calendar" },
  { id: "documents", label: "Docs", icon: "folder-open-outline", activeIcon: "folder-open" },
  { id: "settings", label: "Settings", icon: "settings-outline", activeIcon: "settings" },
];

export function BottomNav({ activeTab, onChange, bottomInset = 0, bottomOffset = 0 }) {
  const { theme } = useEVAApp();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const safeBottom = Math.max(bottomInset, spacing.lg) + bottomOffset;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: safeBottom }]}>
      <LinearGradient
        colors={[colors.glassHighlight, colors.nav, colors.glassSurface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.nav}
      >
        <View pointerEvents="none" style={styles.sheen} />
        {items.map((item) => {
          const active = item.id === activeTab;
          return (
            <Pressable
              key={item.id}
              android_ripple={{
                color: colors.glassHighlight,
                borderless: false,
                radius: 34,
              }}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemPressed,
              ]}
              hitSlop={{ top: 16, bottom: 18, left: 8, right: 8 }}
              onPressIn={() => onChange(item.id)}
            >
              {active ? (
                <LinearGradient
                  pointerEvents="none"
                  colors={[colors.glassButton, colors.navActive]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activeGlass}
                />
              ) : null}
              <Ionicons
                name={active ? item.activeIcon : item.icon}
                size={20}
                color={active ? colors.electric : colors.textMuted}
              />
              <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </LinearGradient>
    </View>
  );
}

function createStyles({ colors, radii, shadows, spacing }) {
  return StyleSheet.create({
    wrap: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.md,
      zIndex: 60,
      elevation: 60,
    },
    nav: {
      minHeight: 78,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xs,
      zIndex: 61,
      elevation: 61,
      ...shadows.card,
    },
    item: {
      flex: 1,
      minHeight: 64,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      borderRadius: radii.lg,
      overflow: "hidden",
      paddingHorizontal: 2,
    },
    itemPressed: {
      transform: [{ scale: 0.98 }],
      opacity: 0.88,
    },
    activeGlass: {
      position: "absolute",
      top: 4,
      right: 2,
      bottom: 4,
      left: 2,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
    },
    label: {
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "700",
      color: colors.textMuted,
    },
    activeLabel: {
      color: colors.text,
    },
    sheen: {
      position: "absolute",
      top: 0,
      left: spacing.lg,
      right: spacing.lg,
      height: 1,
      backgroundColor: colors.glassHighlight,
      opacity: colors.isDark ? 0.5 : 0.76,
    },
  });
}
