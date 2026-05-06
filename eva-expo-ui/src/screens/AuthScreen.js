import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlowCard } from "../components/GlowCard";
import { StatusPill } from "../components/StatusPill";
import { useEVAApp } from "../state/EVAAppContext";

export function AuthScreen() {
  const {
    theme,
    authError,
    authStatus,
    continueLocalPreview,
    signIn,
    signUp,
    resetPassword,
  } = useEVAApp();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [mode, setMode] = useState("welcome");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localMessage, setLocalMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitSignIn() {
    if (!email.trim() || !password.trim()) {
      setLocalMessage("Enter your email and password to continue.");
      return;
    }

    setBusy(true);
    setLocalMessage("");
    try {
      await signIn(email, password);
    } catch (error) {
      setLocalMessage(error?.message || "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitSignUp() {
    if (!email.trim() || !password.trim()) {
      setLocalMessage("Add an email and password for the new account.");
      return;
    }

    setBusy(true);
    setLocalMessage("");
    try {
      const data = await signUp(email, password, fullName);
      if (!data?.session) {
        setLocalMessage("Account created. Check your email if confirmation is required.");
      }
    } catch (error) {
      setLocalMessage(error?.message || "Account creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitResetPassword() {
    if (!email.trim()) {
      setLocalMessage("Enter the email for your EVA account.");
      return;
    }

    setBusy(true);
    setLocalMessage("");
    try {
      await resetPassword(email);
      setLocalMessage("Password reset email sent if that account exists.");
    } catch (error) {
      setLocalMessage(error?.message || "Password reset could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  const message = localMessage || authError;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          <View style={styles.mark}>
            <Ionicons name="sparkles-outline" size={28} color={colors.electric} />
          </View>
          <Text style={styles.title}>EVA</Text>
          <Text style={styles.subtitle}>
            Your workspace, memory, meetings, reminders, and assistant actions now stay tied to your account.
          </Text>
          <StatusPill
            status={authStatus === "unconfigured" ? "attention" : "neutral"}
            label={
              authStatus === "unconfigured"
                ? "Sign-in Setup Needed"
                : "Secure Account Access"
            }
          />
        </View>

        <GlowCard elevated style={styles.card}>
          {mode === "welcome" ? (
            <WelcomeMode
              busy={busy}
              styles={styles}
              colors={colors}
              onSignIn={() => {
                setLocalMessage("");
                setMode("signin");
              }}
              onSignUp={() => {
                setLocalMessage("");
                setMode("signup");
              }}
              onLocalPreview={
                authStatus === "unconfigured" ? continueLocalPreview : null
              }
            />
          ) : null}

          {mode === "signin" ? (
            <AuthForm
              busy={busy}
              colors={colors}
              email={email}
              password={password}
              setEmail={setEmail}
              setPassword={setPassword}
              styles={styles}
              submitLabel="Sign in"
              title="Sign in"
              onSubmit={submitSignIn}
              footer={
                <>
                  <LinkButton label="Forgot password" onPress={() => setMode("forgot")} styles={styles} />
                  <LinkButton label="Create account" onPress={() => setMode("signup")} styles={styles} />
                </>
              }
            />
          ) : null}

          {mode === "signup" ? (
            <AuthForm
              busy={busy}
              colors={colors}
              email={email}
              fullName={fullName}
              password={password}
              setEmail={setEmail}
              setFullName={setFullName}
              setPassword={setPassword}
              showFullName
              styles={styles}
              submitLabel="Create account"
              title="Create account"
              onSubmit={submitSignUp}
              footer={
                <LinkButton label="Already have an account" onPress={() => setMode("signin")} styles={styles} />
              }
            />
          ) : null}

          {mode === "forgot" ? (
            <ForgotMode
              busy={busy}
              colors={colors}
              email={email}
              setEmail={setEmail}
              styles={styles}
              onBack={() => setMode("signin")}
              onSubmit={submitResetPassword}
            />
          ) : null}

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </GlowCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function WelcomeMode({
  busy,
  colors,
  onLocalPreview,
  onSignIn,
  onSignUp,
  styles,
}) {
  return (
    <View style={styles.stack}>
      <Text style={styles.cardTitle}>Welcome back</Text>
      <Text style={styles.cardText}>
        Sign in to keep EVA's tasks, meetings, reminders, chats, preferences, and documents under your account.
      </Text>
      <PrimaryButton
        busy={busy}
        icon="log-in-outline"
        label="Sign in"
        onPress={onSignIn}
        styles={styles}
        colors={colors}
      />
      <SecondaryButton
        icon="person-add-outline"
        label="Create account"
        onPress={onSignUp}
        styles={styles}
        colors={colors}
      />
      {onLocalPreview ? (
        <SecondaryButton
          icon="phone-portrait-outline"
          label="Continue local preview"
          onPress={onLocalPreview}
          styles={styles}
          colors={colors}
        />
      ) : null}
    </View>
  );
}

function AuthForm({
  busy,
  colors,
  email,
  footer,
  fullName,
  password,
  setEmail,
  setFullName,
  setPassword,
  showFullName = false,
  styles,
  submitLabel,
  title,
  onSubmit,
}) {
  return (
    <View style={styles.stack}>
      <Text style={styles.cardTitle}>{title}</Text>
      {showFullName ? (
        <Field
          autoCapitalize="words"
          colors={colors}
          icon="person-outline"
          placeholder="Full name"
          styles={styles}
          value={fullName}
          onChangeText={setFullName}
        />
      ) : null}
      <Field
        autoCapitalize="none"
        autoComplete="email"
        colors={colors}
        icon="mail-outline"
        keyboardType="email-address"
        placeholder="Email"
        styles={styles}
        value={email}
        onChangeText={setEmail}
      />
      <Field
        autoCapitalize="none"
        autoComplete="password"
        colors={colors}
        icon="lock-closed-outline"
        placeholder="Password"
        secureTextEntry
        styles={styles}
        value={password}
        onChangeText={setPassword}
      />
      <PrimaryButton
        busy={busy}
        icon="arrow-forward-outline"
        label={submitLabel}
        onPress={onSubmit}
        styles={styles}
        colors={colors}
      />
      <View style={styles.footerLinks}>{footer}</View>
    </View>
  );
}

function ForgotMode({ busy, colors, email, onBack, onSubmit, setEmail, styles }) {
  return (
    <View style={styles.stack}>
      <Text style={styles.cardTitle}>Reset password</Text>
      <Text style={styles.cardText}>
        EVA will send a password reset email for this account.
      </Text>
      <Field
        autoCapitalize="none"
        autoComplete="email"
        colors={colors}
        icon="mail-outline"
        keyboardType="email-address"
        placeholder="Email"
        styles={styles}
        value={email}
        onChangeText={setEmail}
      />
      <PrimaryButton
        busy={busy}
        icon="mail-unread-outline"
        label="Send reset email"
        onPress={onSubmit}
        styles={styles}
        colors={colors}
      />
      <View style={styles.footerLinks}>
        <LinkButton label="Back to sign in" onPress={onBack} styles={styles} />
      </View>
    </View>
  );
}

function Field({ colors, icon, styles, ...props }) {
  return (
    <View style={styles.fieldWrap}>
      <Ionicons name={icon} size={18} color={colors.electric} />
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={styles.field}
        {...props}
      />
    </View>
  );
}

function PrimaryButton({ busy, colors, icon, label, onPress, styles }) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      disabled={busy}
      style={[styles.primaryButton, busy && styles.disabledButton]}
      onPress={onPress}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.white} />
      ) : (
        <Ionicons name={icon} size={18} color={colors.white} />
      )}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ colors, icon, label, onPress, styles }) {
  return (
    <TouchableOpacity activeOpacity={0.86} style={styles.secondaryButton} onPress={onPress}>
      <Ionicons name={icon} size={18} color={colors.electric} />
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function LinkButton({ label, onPress, styles }) {
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress}>
      <Text style={styles.linkText}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles({ colors, radii, spacing, type }) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxxl,
      gap: spacing.xl,
    },
    hero: {
      alignItems: "flex-start",
      gap: spacing.md,
    },
    mark: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.glassButton,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
    },
    title: {
      ...type.display,
      fontSize: 34,
      lineHeight: 40,
    },
    subtitle: {
      ...type.body,
      maxWidth: 520,
    },
    card: {
      gap: spacing.md,
    },
    stack: {
      gap: spacing.md,
    },
    cardTitle: {
      ...type.h1,
    },
    cardText: {
      ...type.body,
    },
    fieldWrap: {
      minHeight: 52,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.input,
      paddingHorizontal: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    field: {
      flex: 1,
      minHeight: 50,
      color: colors.text,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "700",
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: radii.lg,
      backgroundColor: colors.blue,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    disabledButton: {
      opacity: 0.72,
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
    },
    secondaryButton: {
      minHeight: 52,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
      backgroundColor: colors.glassButton,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
    },
    footerLinks: {
      minHeight: 34,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.lg,
    },
    linkText: {
      ...type.caption,
      color: colors.electric,
      fontWeight: "900",
    },
    message: {
      ...type.caption,
      color: colors.amber,
    },
  });
}
