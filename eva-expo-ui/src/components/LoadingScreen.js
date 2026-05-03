import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, type } from "../theme";

export function LoadingScreen() {
  return (
    <LinearGradient colors={[colors.bgTop, colors.bg, colors.bgDeep]} style={styles.root}>
      <ActivityIndicator color={colors.electric} size="large" />
      <Text style={styles.text}>Preparing EVA...</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  text: {
    ...type.body,
    color: colors.textSoft,
  },
});
