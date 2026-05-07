import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNav } from "./src/components/BottomNav";
import { OnboardingTutorial } from "./src/components/OnboardingTutorial";
import {
  EVAAppProvider,
  EVA_TUTORIAL_COMPLETE_KEY,
  EVA_POST_TUTORIAL_PERMISSIONS_KEY,
  useEVAApp,
} from "./src/state/EVAAppContext";
import { AuthScreen } from "./src/screens/AuthScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { AssistantScreen } from "./src/screens/AssistantScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { DocumentsScreen } from "./src/screens/DocumentsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { spacing } from "./src/theme";

const TUTORIAL_COMPLETE_KEY = EVA_TUTORIAL_COMPLETE_KEY;
const POST_TUTORIAL_PERMISSIONS_KEY = EVA_POST_TUTORIAL_PERMISSIONS_KEY;

export default function App() {
  return (
    <SafeAreaProvider>
      <EVAAppProvider>
        <AppShell />
      </EVAAppProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const [activeTab, setActiveTab] = useState("home");
  const [showTutorial, setShowTutorial] = useState(false);
  const [assistantWakeSignal, setAssistantWakeSignal] = useState(0);
  const permissionFlowStartedRef = useRef(false);
  const {
    authLoading,
    currentUser,
    localPreviewUnlocked,
    consumeWakeWordActivation,
    requestPostTutorialPermissions,
    theme,
  } = useEVAApp();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const foldTaskbarOffset =
    Platform.OS === "android" && shortestSide >= 600 ? 68 : 0;
  const bottomSpace = Math.max(insets.bottom, spacing.lg) + foldTaskbarOffset;
  const isAuthenticated = Boolean(currentUser?.id) || localPreviewUnlocked;
  const completeTutorial = useCallback(async () => {
    setShowTutorial(false);
    await AsyncStorage.setItem(TUTORIAL_COMPLETE_KEY, "true").catch((error) => {
      console.warn("EVA tutorial completion could not be saved.", error?.message || error);
    });
    const alreadyAsked = await AsyncStorage.getItem(POST_TUTORIAL_PERMISSIONS_KEY).catch(
      () => null
    );

    if (alreadyAsked === "true") {
      return;
    }

    if (permissionFlowStartedRef.current) {
      return;
    }

    permissionFlowStartedRef.current = true;
    await requestPostTutorialPermissions?.().catch((error) => {
      console.warn("EVA post-tutorial permissions could not complete.", error?.message || error);
    });
    await AsyncStorage.setItem(POST_TUTORIAL_PERMISSIONS_KEY, "true").catch(() => {});
  }, [requestPostTutorialPermissions]);
  const handleTabChange = useCallback((nextTab) => {
    if (showTutorial) {
      completeTutorial();
    }
    setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
  }, [completeTutorial, showTutorial]);
  const handleTutorialNavigate = useCallback((nextTab) => {
    setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!isAuthenticated) {
      permissionFlowStartedRef.current = false;
      return () => {
        isMounted = false;
      };
    }

    AsyncStorage.getItem(TUTORIAL_COMPLETE_KEY)
      .then(async (value) => {
        if (!isMounted) {
          return;
        }

        const tutorialDone = value === "true";
        setShowTutorial(!tutorialDone);

        if (tutorialDone) {
          const permissionsAsked = await AsyncStorage.getItem(
            POST_TUTORIAL_PERMISSIONS_KEY
          ).catch(() => null);

          if (
            isMounted &&
            permissionsAsked !== "true" &&
            !permissionFlowStartedRef.current
          ) {
            permissionFlowStartedRef.current = true;
            await requestPostTutorialPermissions?.().catch((error) => {
              console.warn(
                "EVA post-tutorial permissions could not complete.",
                error?.message || error
              );
            });
            await AsyncStorage.setItem(
              POST_TUTORIAL_PERMISSIONS_KEY,
              "true"
            ).catch(() => {});
          }
        }
      })
      .catch((error) => {
        console.warn("EVA tutorial status could not be loaded.", error?.message || error);
      });

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let active = true;
    const checkWakeWord = async () => {
      const detected = await consumeWakeWordActivation?.();
      if (!active || !detected) {
        return;
      }
      setActiveTab("assistant");
      setAssistantWakeSignal(Date.now());
    };

    checkWakeWord();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        checkWakeWord();
      }
    });
    const interval = setInterval(checkWakeWord, 2000);

    return () => {
      active = false;
      subscription.remove();
      clearInterval(interval);
    };
  }, [consumeWakeWordActivation, isAuthenticated]);

  const screen = useMemo(() => {
    if (authLoading) {
      return <AuthLoading colors={colors} />;
    }

    if (!isAuthenticated) {
      return <AuthScreen />;
    }

    switch (activeTab) {
      case "assistant":
        return <AssistantScreen wakeSignal={assistantWakeSignal} />;
      case "tasks":
        return <TasksScreen />;
      case "calendar":
        return <CalendarScreen />;
      case "documents":
        return <DocumentsScreen />;
      case "settings":
        return <SettingsScreen />;
      case "home":
      default:
        return <HomeScreen onNavigate={handleTabChange} />;
    }
  }, [activeTab, assistantWakeSignal, authLoading, colors, handleTabChange, isAuthenticated]);

  return (
    <LinearGradient
      colors={colors.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bgTop} />
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <View pointerEvents="none" style={[styles.glowTop, { backgroundColor: colors.glowTop }]} />
        <View pointerEvents="none" style={[styles.glowBottom, { backgroundColor: colors.glowBottom }]} />
        <View
          style={[
            styles.screen,
            { paddingBottom: isAuthenticated ? 86 + bottomSpace : 0 },
          ]}
        >
          {screen}
        </View>
        {isAuthenticated ? (
          <>
            <BottomNav
              activeTab={activeTab}
              onChange={handleTabChange}
              bottomInset={insets.bottom}
              bottomOffset={foldTaskbarOffset}
            />
            {showTutorial ? (
              <OnboardingTutorial
                visible={showTutorial}
                onComplete={completeTutorial}
                onNavigate={handleTutorialNavigate}
              />
            ) : null}
          </>
        ) : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

function AuthLoading({ colors }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.electric} />
      <Text style={[styles.loadingText, { color: colors.textSoft }]}>
        Restoring EVA session
      </Text>
    </View>
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
    zIndex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
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
