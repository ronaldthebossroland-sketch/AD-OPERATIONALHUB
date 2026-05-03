import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlowCard } from "../components/GlowCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionTitle } from "../components/SectionTitle";
import { settingsItems } from "../data/mockData";
import { supabase } from "../lib/supabase";
import { colors, radii, spacing, type } from "../theme";

export function SettingsScreen({ appUser, session }) {
  const email = appUser?.email || session?.user?.email || "Signed-in user";

  async function logout() {
    await supabase?.auth.signOut();
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ScreenHeader title="Settings" subtitle="Control layer for EVA preferences" eyebrow="Control" />
      <View style={styles.padded}>
        <GlowCard elevated style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>RR</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{appUser?.name || "EVA User"}</Text>
            <Text style={styles.profileMeta}>{email}</Text>
          </View>
        </GlowCard>

        <SectionTitle title="Preferences" />
        <GlowCard style={styles.list}>
          {settingsItems.map((item) => (
            <View key={item.title} style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Ionicons name={item.icon} size={20} color={colors.electric} />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>{item.title}</Text>
                <Text style={styles.settingDescription}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          ))}
        </GlowCard>

        <TouchableOpacity activeOpacity={0.86} style={styles.logout} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={colors.high} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
  padded: {
    paddingHorizontal: spacing.xl,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  avatarText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  profileCopy: {
    flex: 1,
  },
  profileName: {
    ...type.h2,
  },
  profileMeta: {
    ...type.caption,
    marginTop: spacing.xs,
    color: colors.textSoft,
  },
  list: {
    gap: spacing.md,
  },
  settingRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    ...type.body,
    color: colors.text,
    fontWeight: "800",
  },
  settingDescription: {
    ...type.caption,
    marginTop: spacing.xs,
    color: colors.textMuted,
  },
  logout: {
    marginTop: spacing.xl,
    minHeight: 54,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(251, 113, 133, 0.25)",
    backgroundColor: "rgba(251, 113, 133, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  logoutText: {
    color: colors.high,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
});
