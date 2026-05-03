import { StyleSheet, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, shadows } from "../theme";

export function FloatingMic({ onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.86} style={styles.wrap} onPress={onPress}>
      <LinearGradient
        colors={[colors.electric, colors.blue, colors.violet]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.button}
      >
        <View style={styles.inner}>
          <Ionicons name="mic" size={30} color={colors.white} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 22,
    bottom: 104,
    width: 76,
    height: 76,
    borderRadius: 38,
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
    backgroundColor: "rgba(6, 11, 24, 0.32)",
  },
});
