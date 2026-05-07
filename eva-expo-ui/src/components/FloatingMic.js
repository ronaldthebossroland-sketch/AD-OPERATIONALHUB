import { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useEVAApp } from "../state/EVAAppContext";

export function FloatingMic({ disabled = false, onPressIn, onPressOut, state = "idle" }) {
  const { theme } = useEVAApp();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const listening = state === "listening";
  const working = state === "transcribing" || state === "processing";
  const iconName = working ? "sync" : "mic";
  const gradientColors = listening
    ? [colors.high, colors.amber, colors.electric]
    : working
      ? [colors.electric, colors.blue, colors.green]
      : [colors.electric, colors.blue, colors.violet];

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      disabled={disabled}
      style={[styles.wrap, disabled && styles.disabled]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.button}
      >
        <View style={[styles.inner, listening && styles.innerListening]}>
          <Ionicons name={iconName} size={working ? 27 : 30} color={colors.white} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function createStyles({ colors, shadows }) {
  return StyleSheet.create({
    wrap: {
      position: "absolute",
      right: 22,
      bottom: 104,
      width: 76,
      height: 76,
      borderRadius: 38,
      zIndex: 40,
      elevation: 40,
      ...shadows.glow,
    },
    button: {
      flex: 1,
      borderRadius: 38,
      padding: 2,
    },
    inner: {
      flex: 1,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
    },
    innerListening: {
      backgroundColor: colors.high + "38",
    },
    disabled: {
      opacity: 0.72,
    },
  });
}
