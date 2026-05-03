import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { signInWithEmail, signUpWithEmail } from "../lib/api";
import { isSupabaseConfigured } from "../lib/supabase";
import { colors, radii, shadows, spacing, type } from "../theme";

export function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function submit() {
    setStatus("");
    setLoading(true);

    try {
      const result = isSignup
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);

      if (result.session) {
        onAuthenticated?.(result.session);
        return;
      }

      setStatus("Check your email to confirm the account, then sign in.");
    } catch (error) {
      setStatus(error.message || "Could not complete authentication.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={[colors.bgTop, colors.bg, colors.bgDeep]}
      style={styles.root}
    >
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.panel}>
          <View style={styles.logo}>
            <Ionicons name="sparkles" size={30} color={colors.electric} />
          </View>
          <Text style={styles.title}>Executive Virtual Assistant</Text>
          <Text style={styles.subtitle}>Secure executive command access</Text>

          {!isSupabaseConfigured ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Supabase auth is not configured. Add EXPO_PUBLIC_SUPABASE_ANON_KEY
                to eva-expo-ui/.env.
              </Text>
            </View>
          ) : null}

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          {status ? <Text style={styles.status}>{status}</Text> : null}

          <TouchableOpacity
            activeOpacity={0.86}
            disabled={loading || !email || !password || !isSupabaseConfigured}
            style={[
              styles.primaryButton,
              (loading || !email || !password || !isSupabaseConfigured) &&
                styles.disabledButton,
            ]}
            onPress={submit}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryText}>
                {isSignup ? "Create Account" : "Sign In"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            style={styles.secondaryButton}
            onPress={() => {
              setStatus("");
              setMode(isSignup ? "signin" : "signup");
            }}
          >
            <Text style={styles.secondaryText}>
              {isSignup ? "Use existing account" : "Create an account"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            style={styles.googleButton}
            onPress={() =>
              setStatus(
                "Google sign-in is being finalized. Use email/password for now."
              )
            }
          >
            <Ionicons name="logo-google" size={18} color={colors.textSoft} />
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  panel: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(17, 30, 56, 0.86)",
    padding: spacing.xl,
    ...shadows.card,
  },
  logo: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  title: {
    ...type.h1,
    marginTop: spacing.xl,
  },
  subtitle: {
    ...type.body,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  input: {
    minHeight: 54,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(6, 11, 24, 0.5)",
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    fontSize: 15,
    fontWeight: "600",
  },
  notice: {
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.22)",
    marginBottom: spacing.md,
  },
  noticeText: {
    ...type.caption,
    color: colors.textSoft,
  },
  status: {
    ...type.caption,
    color: colors.amber,
    marginBottom: spacing.md,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.blue,
  },
  disabledButton: {
    opacity: 0.48,
  },
  primaryText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  secondaryText: {
    color: colors.electric,
    fontSize: 13,
    fontWeight: "800",
  },
  googleButton: {
    minHeight: 50,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  googleText: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: "800",
  },
});
