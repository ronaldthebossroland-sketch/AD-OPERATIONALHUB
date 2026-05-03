import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";

export function ScreenHeader({ title, subtitle, eyebrow }) {
  return (
    <View style={styles.wrap}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
  },
  eyebrow: {
    ...type.micro,
    marginBottom: spacing.sm,
    color: colors.electric,
  },
  title: {
    ...type.display,
  },
  subtitle: {
    ...type.body,
    marginTop: spacing.xs,
  },
});
