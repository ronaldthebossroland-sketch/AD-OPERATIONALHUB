import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlowCard } from "../components/GlowCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionTitle } from "../components/SectionTitle";
import { previewEvaVoice } from "../lib/evaSpeech";
import { useEVAApp } from "../state/EVAAppContext";

export function SettingsScreen() {
  const {
    theme,
    themeMode,
    toggleThemeMode,
    aiBehavior,
    aiBehaviorOptions,
    setAiBehavior,
    voiceMode,
    voiceModeOptions,
    setVoiceMode,
    notificationEnabled,
    toggleNotifications,
    wakeWordEnabled,
    wakeWordStatus,
    toggleWakeWord,
    phoneCalendarSyncEnabled,
    togglePhoneCalendarSync,
    defaultMeetingReminderMinutes,
    setDefaultMeetingReminderMinutes,
    deviceIntegrationWarning,
    testCalendarPermission,
    testMicrophonePermission,
    sendTestNotification,
    createTestCalendarEvent,
    clearLocalPreviewData,
    profile,
    updateProfile,
    currentUser,
    accountEmail,
    signOut,
    activeWorkspace,
    workspaceMode,
    workspaceMembers,
    workspaceMemberStatus,
    canManageWorkspace,
    refreshWorkspaceMembers,
    updateWorkspaceMemberRole,
  } = useEVAApp();
  const { width } = useWindowDimensions();
  const layout = useMemo(
    () => ({ compact: width < 390, wide: width >= 700 }),
    [width]
  );
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme, layout), [theme, layout]);
  const [integrationStatus, setIntegrationStatus] = useState("");

  async function runIntegrationAction(action, successCopy) {
    setIntegrationStatus("Checking...");
    try {
      const result = await action();
      setIntegrationStatus(
        result?.ok || result?.granted
          ? successCopy
          : result?.message || "Permission was not granted."
      );
    } catch (error) {
      setIntegrationStatus(error?.message || "Something went wrong. Please try again.");
    }
  }

  function selectVoiceMode(optionId) {
    setVoiceMode(optionId);
    previewEvaVoice(optionId).catch((error) => {
      setIntegrationStatus(error?.message || "Voice preview is unavailable.");
    });
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ScreenHeader title="Settings" subtitle="Preferences, account, calendar, and voice" eyebrow="Control" />
      <View style={styles.padded}>
        <ProfileSettingsCard
          key={`${profile.fullName}:${profile.role}`}
          colors={colors}
          accountEmail={accountEmail}
          profile={profile}
          styles={styles}
          updateProfile={updateProfile}
        />

        <SectionTitle title="Account" />
        <GlowCard style={styles.accountCard}>
          <View style={styles.integrationRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="person-circle-outline" size={20} color={colors.electric} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Signed in account</Text>
              <Text style={styles.settingDescription}>
                {accountEmail || "No account email available"}
              </Text>
            </View>
          </View>
        </GlowCard>

        <SectionTitle title="Workspace Members" />
        <WorkspaceMembersCard
          activeWorkspace={activeWorkspace}
          canManageWorkspace={canManageWorkspace}
          colors={colors}
          currentUserId={currentUser?.id || ""}
          members={workspaceMembers}
          refreshWorkspaceMembers={refreshWorkspaceMembers}
          status={workspaceMemberStatus}
          styles={styles}
          updateWorkspaceMemberRole={updateWorkspaceMemberRole}
          workspaceMode={workspaceMode}
        />

        <SectionTitle title="Preferences" />
        <GlowCard style={styles.appearanceCard}>
          <View style={styles.settingIcon}>
            <Ionicons name={themeMode === "dark" ? "moon-outline" : "sunny-outline"} size={20} color={colors.electric} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Appearance</Text>
            <Text style={styles.settingDescription}>
              {themeMode === "dark" ? "Dark executive command mode" : "Light executive clarity mode"}
            </Text>
          </View>
          <TouchableOpacity activeOpacity={0.84} style={styles.modeButton} onPress={toggleThemeMode}>
            <Text style={styles.modeButtonText}>{themeMode === "dark" ? "Light" : "Dark"}</Text>
          </TouchableOpacity>
        </GlowCard>

        <GlowCard style={styles.notificationCard}>
          <View style={styles.settingIcon}>
            <Ionicons
              name={notificationEnabled ? "notifications-outline" : "notifications-off-outline"}
              size={20}
              color={colors.electric}
            />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Notifications</Text>
            <Text style={styles.settingDescription}>
              {notificationEnabled
                ? "EVA can remind you about meetings and tasks when permission is granted."
                : "Reminder alerts are muted."}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.84}
            style={[styles.toggle, notificationEnabled && styles.toggleActive]}
            onPress={toggleNotifications}
          >
            <View style={[styles.toggleKnob, notificationEnabled && styles.toggleKnobActive]} />
          </TouchableOpacity>
        </GlowCard>

        <GlowCard style={styles.notificationCard}>
          <View style={styles.settingIcon}>
            <Ionicons
              name={wakeWordEnabled ? "ear-outline" : "ear-outline"}
              size={20}
              color={colors.electric}
            />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Hi EVA hands-free</Text>
            <Text style={styles.settingDescription}>
              {wakeWordEnabled
                ? wakeWordStatus === "listening"
                  ? "EVA is listening for Hi EVA with a small phone notification."
                  : "Hi EVA is enabled and will resume when voice command is free."
                : "Say Hi EVA to open voice command when this is enabled."}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.84}
            style={[styles.toggle, wakeWordEnabled && styles.toggleActive]}
            onPress={() =>
              runIntegrationAction(
                toggleWakeWord,
                wakeWordEnabled ? "Hi EVA is off." : "Hi EVA is listening."
              )
            }
          >
            <View style={[styles.toggleKnob, wakeWordEnabled && styles.toggleKnobActive]} />
          </TouchableOpacity>
        </GlowCard>

        <SectionTitle title="Calendar & Reminders" />
        <GlowCard style={styles.integrationCard}>
          <View style={styles.integrationRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="phone-portrait-outline" size={20} color={colors.electric} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Add meetings to phone calendar</Text>
              <Text style={styles.settingDescription}>
                {phoneCalendarSyncEnabled
                  ? "New EVA meetings will also be added to a writable phone calendar."
                  : "EVA will keep meetings inside the app until this is enabled."}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.84}
              style={[styles.toggle, phoneCalendarSyncEnabled && styles.toggleActive]}
              onPress={togglePhoneCalendarSync}
            >
              <View
                style={[
                  styles.toggleKnob,
                  phoneCalendarSyncEnabled && styles.toggleKnobActive,
                ]}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.reminderBlock}>
            <Text style={styles.settingTitle}>Meeting reminder default</Text>
            <View style={styles.reminderOptions}>
              {[10, 15, 30].map((minutes) => {
                const active = minutes === defaultMeetingReminderMinutes;
                return (
                  <TouchableOpacity
                    key={minutes}
                    activeOpacity={0.84}
                    style={[styles.reminderOption, active && styles.reminderOptionActive]}
                    onPress={() => setDefaultMeetingReminderMinutes(minutes)}
                  >
                    <Text
                      style={[
                        styles.reminderOptionText,
                        active && styles.reminderOptionTextActive,
                      ]}
                    >
                      {minutes} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.integrationButtons}>
            <SmallButton
              icon="calendar-outline"
              label="Check calendar access"
              onPress={() =>
                runIntegrationAction(
                  testCalendarPermission,
                  "Calendar access is ready."
                )
              }
              styles={styles}
              colors={colors}
            />
            <SmallButton
              icon="notifications-outline"
              label="Try notification"
              onPress={() =>
                runIntegrationAction(sendTestNotification, "Notification scheduled.")
              }
              styles={styles}
              colors={colors}
            />
            <SmallButton
              icon="mic-outline"
              label="Check microphone"
              onPress={() =>
                runIntegrationAction(
                  testMicrophonePermission,
                  "Microphone access is ready."
                )
              }
              styles={styles}
              colors={colors}
            />
            <SmallButton
              icon="calendar-number-outline"
              label="Create sample event"
              onPress={() =>
                runIntegrationAction(
                  createTestCalendarEvent,
                  "Sample calendar event created."
                )
              }
              styles={styles}
              colors={colors}
            />
            <SmallButton
              icon="trash-outline"
              label="Reset this device"
              onPress={() => {
                clearLocalPreviewData();
                setIntegrationStatus("Local preview data cleared on this device.");
              }}
              styles={styles}
              colors={colors}
            />
          </View>

          {integrationStatus || deviceIntegrationWarning ? (
            <Text style={styles.integrationMessage}>
              {integrationStatus || deviceIntegrationWarning}
            </Text>
          ) : null}
        </GlowCard>

        <GlowCard style={styles.behaviorCard}>
          <View style={styles.behaviorHeader}>
            <View style={styles.settingIcon}>
              <Ionicons name="sparkles-outline" size={20} color={colors.electric} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>AI behavior</Text>
              <Text style={styles.settingDescription}>
                Choose how EVA should speak and act during commands.
              </Text>
            </View>
          </View>
          <View style={styles.behaviorOptions}>
            {aiBehaviorOptions.map((option) => {
              const active = option.id === aiBehavior;
              return (
                <TouchableOpacity
                  key={option.id}
                  activeOpacity={0.84}
                  style={[styles.behaviorOption, active && styles.behaviorOptionActive]}
                  onPress={() => setAiBehavior(option.id)}
                >
                  <View style={styles.behaviorOptionTop}>
                    <Text style={[styles.behaviorLabel, active && styles.behaviorLabelActive]}>
                      {option.label}
                    </Text>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.electric} />
                    ) : null}
                  </View>
                  <Text style={styles.behaviorDescription}>{option.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </GlowCard>

        <GlowCard style={styles.behaviorCard}>
          <View style={styles.behaviorHeader}>
            <View style={styles.settingIcon}>
              <Ionicons name="mic-outline" size={20} color={colors.electric} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Voice settings</Text>
              <Text style={styles.settingDescription}>
                Choose how EVA should sound during voice interactions.
              </Text>
            </View>
          </View>
          <View style={styles.behaviorOptions}>
            {voiceModeOptions.map((option) => {
              const active = option.id === voiceMode;
              return (
                <TouchableOpacity
                  key={option.id}
                  activeOpacity={0.84}
                  style={[styles.behaviorOption, active && styles.behaviorOptionActive]}
                  onPress={() => selectVoiceMode(option.id)}
                >
                  <View style={styles.behaviorOptionTop}>
                    <Text style={[styles.behaviorLabel, active && styles.behaviorLabelActive]}>
                      {option.label}
                    </Text>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.electric} />
                    ) : null}
                  </View>
                  <Text style={styles.behaviorDescription}>{option.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </GlowCard>

        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.logout}
          onPress={() =>
            signOut().catch((error) => {
              setIntegrationStatus(error?.message || "Logout could not complete.");
            })
          }
        >
          <Ionicons name="log-out-outline" size={18} color={colors.textSoft} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function SmallButton({ colors, icon, label, onPress, styles }) {
  return (
    <TouchableOpacity activeOpacity={0.84} style={styles.smallButton} onPress={onPress}>
      <Ionicons name={icon} size={16} color={colors.electric} />
      <Text style={styles.smallButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function WorkspaceMembersCard({
  activeWorkspace,
  canManageWorkspace,
  colors,
  currentUserId,
  members,
  refreshWorkspaceMembers,
  status,
  styles,
  updateWorkspaceMemberRole,
  workspaceMode,
}) {
  const [localStatus, setLocalStatus] = useState("");
  const roleOptions = ["viewer", "member", "admin"];

  async function changeRole(member, role) {
    setLocalStatus("Updating role...");
    const updated = await updateWorkspaceMemberRole(member.id, role);
    setLocalStatus(
      updated
        ? `${member.displayName} is now ${role}.`
        : "Role was not changed."
    );
  }

  async function refreshMembers() {
    setLocalStatus("Refreshing members...");
    const refreshed = await refreshWorkspaceMembers();
    setLocalStatus(`${refreshed.length} member${refreshed.length === 1 ? "" : "s"} loaded.`);
  }

  if (!workspaceMode) {
    return (
      <GlowCard style={styles.workspaceCard}>
        <View style={styles.integrationRow}>
          <View style={styles.settingIcon}>
            <Ionicons name="people-outline" size={20} color={colors.electric} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Personal EVA is active</Text>
            <Text style={styles.settingDescription}>
              Create or select a team workspace from Tasks, then manage its members here.
            </Text>
          </View>
        </View>
      </GlowCard>
    );
  }

  return (
    <GlowCard style={styles.workspaceCard}>
      <View style={styles.workspaceHeader}>
        <View style={styles.settingIcon}>
          <Ionicons name="people-outline" size={20} color={colors.electric} />
        </View>
        <View style={styles.settingCopy}>
          <Text style={styles.settingTitle}>{activeWorkspace.name}</Text>
          <Text style={styles.settingDescription}>
            Your role: {activeWorkspace.role}. Shared tasks stay visible to this workspace.
          </Text>
          {activeWorkspace.inviteCode ? (
            <Text style={styles.workspaceInvite}>
              Invite code: {activeWorkspace.inviteCode}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          activeOpacity={0.84}
          style={styles.iconButton}
          onPress={refreshMembers}
        >
          <Ionicons name="refresh" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.memberList}>
        {members.length ? (
          members.map((member) => {
            const locked = !canManageWorkspace || member.role === "owner";
            return (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {makeInitials(member.displayName)}
                  </Text>
                </View>
                <View style={styles.memberCopy}>
                  <Text style={styles.memberName}>
                    {member.displayName}
                    {member.userId === currentUserId ? " (you)" : ""}
                  </Text>
                  <Text style={styles.memberRole}>{member.role}</Text>
                </View>
                <View style={styles.roleOptions}>
                  {member.role === "owner" ? (
                    <Text style={styles.ownerBadge}>Owner</Text>
                  ) : (
                    roleOptions.map((role) => {
                      const active = member.role === role;
                      return (
                        <TouchableOpacity
                          key={role}
                          activeOpacity={0.84}
                          disabled={locked || active}
                          style={[
                            styles.roleChip,
                            active && styles.roleChipActive,
                            locked && !active && styles.roleChipDisabled,
                          ]}
                          onPress={() => changeRole(member, role)}
                        >
                          <Text
                            style={[
                              styles.roleChipText,
                              active && styles.roleChipTextActive,
                            ]}
                          >
                            {role}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.settingDescription}>
            {status === "loading"
              ? "Loading workspace members..."
              : "No members are visible yet. Share the invite code when you are ready."}
          </Text>
        )}
      </View>

      {localStatus ||
      (status && !["connected", "personal", "loading"].includes(String(status))) ? (
        <Text style={styles.integrationMessage}>{localStatus || status}</Text>
      ) : null}
    </GlowCard>
  );
}

function ProfileSettingsCard({
  accountEmail,
  colors,
  profile,
  styles,
  updateProfile,
}) {
  const [profileDraft, setProfileDraft] = useState(profile);
  const profileInitials = useMemo(
    () => makeInitials(profileDraft.fullName),
    [profileDraft.fullName]
  );
  const hasProfileChanges =
    profileDraft.fullName !== profile.fullName || profileDraft.role !== profile.role;

  return (
    <GlowCard elevated style={styles.profile}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profileInitials}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{profile.fullName}</Text>
          <Text style={styles.profileMeta}>{profile.role}</Text>
          {accountEmail ? (
            <Text style={styles.profileMeta}>{accountEmail}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.profileForm}>
        <TextInput
          value={profileDraft.fullName}
          onChangeText={(fullName) =>
            setProfileDraft((current) => ({ ...current, fullName }))
          }
          placeholder="Full name"
          placeholderTextColor={colors.textMuted}
          style={styles.profileInput}
        />
        <TextInput
          value={profileDraft.role}
          onChangeText={(role) =>
            setProfileDraft((current) => ({ ...current, role }))
          }
          placeholder="Role or workspace title"
          placeholderTextColor={colors.textMuted}
          style={styles.profileInput}
        />
      </View>

      <TouchableOpacity
        activeOpacity={0.84}
        disabled={!hasProfileChanges}
        style={[styles.profileSave, !hasProfileChanges && styles.profileSaveDisabled]}
        onPress={() => updateProfile(profileDraft)}
      >
        <Text
          style={[
            styles.profileSaveText,
            !hasProfileChanges && styles.profileSaveTextDisabled,
          ]}
        >
          Save profile
        </Text>
      </TouchableOpacity>
    </GlowCard>
  );
}

function makeInitials(name) {
  const parts = String(name || "EVA")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return (parts.map((part) => part[0]).join("") || "E").toUpperCase();
}

function createStyles({ colors, radii, spacing, type }, layout) {
  const buttonBasis = layout.compact ? "100%" : layout.wide ? "31%" : "47%";

  return StyleSheet.create({
    content: {
      paddingBottom: 128,
    },
    padded: {
      paddingHorizontal: layout.compact ? spacing.lg : spacing.xl,
    },
    profile: {
      gap: spacing.md,
    },
    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.glassButton,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
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
    profileForm: {
      gap: spacing.sm,
    },
    profileInput: {
      minHeight: 48,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
      paddingHorizontal: spacing.md,
      color: colors.text,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "700",
    },
    profileSave: {
      minHeight: 42,
      borderRadius: radii.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.blue,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
    },
    profileSaveDisabled: {
      backgroundColor: colors.glassSurface,
      borderColor: colors.glassBorder,
    },
    profileSaveText: {
      color: colors.white,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
    },
    profileSaveTextDisabled: {
      color: colors.textMuted,
    },
    appearanceCard: {
      marginBottom: spacing.md,
      minHeight: 66,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.md,
    },
    modeButton: {
      minHeight: 38,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.blue,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
    },
    modeButtonText: {
      color: colors.white,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
    },
    notificationCard: {
      marginBottom: spacing.md,
      minHeight: 72,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.md,
    },
    accountCard: {
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    workspaceCard: {
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    workspaceHeader: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
      gap: spacing.md,
    },
    workspaceInvite: {
      ...type.caption,
      marginTop: spacing.xs,
      color: colors.electric,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
    },
    memberList: {
      gap: spacing.sm,
    },
    memberRow: {
      minHeight: 72,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
      padding: spacing.md,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.md,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.glassButton,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    memberAvatarText: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "900",
    },
    memberCopy: {
      flex: 1,
      minWidth: 130,
    },
    memberName: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "800",
    },
    memberRole: {
      ...type.caption,
      marginTop: spacing.xs,
      color: colors.textMuted,
      textTransform: "capitalize",
    },
    roleOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      justifyContent: "flex-end",
    },
    roleChip: {
      minHeight: 32,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surfaceRaised,
    },
    roleChipActive: {
      borderColor: colors.glassBorderStrong,
      backgroundColor: colors.blue,
    },
    roleChipDisabled: {
      opacity: 0.48,
    },
    roleChipText: {
      color: colors.textSoft,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "800",
      textTransform: "capitalize",
    },
    roleChipTextActive: {
      color: colors.white,
    },
    ownerBadge: {
      color: colors.electric,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "900",
    },
    integrationCard: {
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    integrationRow: {
      minHeight: 58,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.md,
    },
    reminderBlock: {
      gap: spacing.sm,
    },
    reminderOptions: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    reminderOption: {
      minHeight: 38,
      flex: 1,
      borderRadius: radii.pill,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
    },
    reminderOptionActive: {
      borderColor: colors.glassBorderStrong,
      backgroundColor: colors.glassButton,
    },
    reminderOptionText: {
      color: colors.textSoft,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
    },
    reminderOptionTextActive: {
      color: colors.text,
    },
    integrationButtons: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    smallButton: {
      minHeight: 38,
      flexGrow: 1,
      flexBasis: buttonBasis,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
    },
    smallButtonText: {
      ...type.caption,
      color: colors.text,
    },
    integrationMessage: {
      ...type.caption,
      color: colors.textSoft,
    },
    integrationNote: {
      ...type.caption,
      color: colors.textMuted,
    },
    toggle: {
      width: 54,
      height: 32,
      borderRadius: 16,
      padding: 4,
      justifyContent: "center",
      backgroundColor: colors.glassSurface,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    toggleActive: {
      backgroundColor: colors.blue,
      borderColor: colors.glassBorderStrong,
    },
    toggleKnob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.textMuted,
    },
    toggleKnobActive: {
      transform: [{ translateX: 22 }],
      backgroundColor: colors.white,
    },
    list: {
      gap: spacing.md,
    },
    behaviorCard: {
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    behaviorHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    behaviorOptions: {
      gap: spacing.sm,
    },
    behaviorOption: {
      minHeight: 76,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
      padding: spacing.md,
      gap: spacing.xs,
    },
    behaviorOptionActive: {
      borderColor: colors.glassBorderStrong,
      backgroundColor: colors.glassButton,
    },
    behaviorOptionTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    behaviorLabel: {
      color: colors.textSoft,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "800",
    },
    behaviorLabelActive: {
      color: colors.text,
    },
    behaviorDescription: {
      ...type.caption,
      color: colors.textMuted,
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
      backgroundColor: colors.glassButton,
    },
    settingCopy: {
      flex: 1,
      minWidth: 0,
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
    previewCard: {
      gap: spacing.sm,
    },
    previewTitle: {
      ...type.h2,
    },
    previewText: {
      ...type.body,
    },
    logout: {
      marginTop: spacing.xl,
      minHeight: 54,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassSurface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    logoutText: {
      color: colors.textSoft,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "800",
    },
  });
}
