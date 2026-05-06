import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useEVAApp } from "../state/EVAAppContext";

export function SectionTitle({ title, action }) {
  const { theme } = useEVAApp();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action ? <Text style={styles.action}>{action}</Text> : null}
    </View>
  );
}

function createStyles({ colors, spacing, type }) {
  return StyleSheet.create({
    row: {
      marginTop: spacing.xl,
      marginBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      ...type.h2,
    },
    action: {
      ...type.caption,
      color: colors.electric,
    },
  });
}
