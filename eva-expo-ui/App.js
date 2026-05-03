import { useEffect, useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AuthScreen } from "./src/components/AuthScreen";
import { BottomNav } from "./src/components/BottomNav";
import { LoadingScreen } from "./src/components/LoadingScreen";
import { syncBackendSession } from "./src/lib/api";
import { isSupabaseConfigured, supabase } from "./src/lib/supabase";
import { AssistantScreen } from "./src/screens/AssistantScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { OperationsScreen } from "./src/screens/OperationsScreen";
import { TranscriptsScreen } from "./src/screens/TranscriptsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { colors, spacing, type } from "./src/theme";

export default function App() {
  const [activeTab, setActiveTab] = useState("eva");
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [sessionWarning, setSessionWarning] = useState("");

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (!isSupabaseConfigured || !supabase) {
        setBooting(false);
        return;
      }

      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        setSession(currentSession || null);

        if (currentSession?.access_token) {
          try {
            const synced = await syncBackendSession(currentSession.access_token);
            if (mounted) {
              setAppUser(synced?.user || null);
              setSessionWarning("");
            }
          } catch (error) {
            if (mounted) {
              setSessionWarning(error.message || "Backend session sync failed.");
            }
          }
        }
      } finally {
        if (mounted) {
          setBooting(false);
        }
      }
    }

    bootstrap();

    const { data } =
      supabase?.auth.onAuthStateChange(async (_event, nextSession) => {
        setSession(nextSession || null);

        if (!nextSession?.access_token) {
          setAppUser(null);
          setSessionWarning("");
          return;
        }

        try {
          const synced = await syncBackendSession(nextSession.access_token);
          setAppUser(synced?.user || null);
          setSessionWarning("");
        } catch (error) {
          setSessionWarning(error.message || "Backend session sync failed.");
        }
      }) || {};

    return () => {
      mounted = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  const screen = useMemo(() => {
    switch (activeTab) {
      case "calendar":
        return <CalendarScreen />;
      case "operations":
        return <OperationsScreen />;
      case "transcripts":
        return <TranscriptsScreen />;
      case "settings":
        return <SettingsScreen appUser={appUser} session={session} />;
      case "eva":
      default:
        return <AssistantScreen />;
    }
  }, [activeTab, appUser, session]);

  if (booting) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthScreen onAuthenticated={setSession} />;
  }

  return (
    <LinearGradient
      colors={[colors.bgTop, colors.bg, colors.bgDeep]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
        {sessionWarning ? (
          <View style={styles.warning}>
            <Text style={styles.warningText}>{sessionWarning}</Text>
          </View>
        ) : null}
        <View style={styles.screen}>{screen}</View>
        <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  screen: {
    flex: 1,
    paddingBottom: 86,
  },
  warning: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.26)",
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    padding: spacing.md,
  },
  warningText: {
    ...type.caption,
    color: colors.textSoft,
  },
  glowTop: {
    position: "absolute",
    top: -90,
    right: -80,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(56, 189, 248, 0.16)",
  },
  glowBottom: {
    position: "absolute",
    bottom: 40,
    left: -100,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(124, 58, 237, 0.1)",
  },
});
