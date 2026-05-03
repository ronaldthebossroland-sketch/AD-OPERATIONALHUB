import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";

import AuthCallbackPage from "./components/auth/AuthCallbackPage";
import LegalPage from "./components/auth/LegalPage";
import LoginPage from "./components/auth/LoginPage";
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import AppSplashScreen from "./components/shared/AppSplashScreen";
import ApprovalCenterView from "./components/pages/ApprovalCenterView";
import CalendarView from "./components/pages/CalendarView";
import DashboardView from "./components/pages/DashboardView";
import ConversationAdvisorView from "./components/pages/ConversationAdvisorView";
import MeetingsView from "./components/pages/MeetingsView";
import OperationsView from "./components/pages/OperationsView";
import PartnersView from "./components/pages/PartnersView";
import ProjectsView from "./components/pages/ProjectsView";
import SettingsView from "./components/pages/SettingsView";
import TaskBoardView from "./components/pages/TaskBoardView";
import TranscriptsView from "./components/pages/TranscriptsView";
import VoiceHomeView from "./components/pages/VoiceHomeView";
import { navItems } from "./data/navItems";
import {
  getActivities,
  getAlarms,
  getAlerts,
  getCurrentUser,
  getMeetings,
  completeNativeGmailConnection,
  updateMeeting,
  getOperations,
  getPartners,
  getProjects,
  logoutUser,
  updateAlarm,
  updateAlert,
  updateOperation,
  API_BASE_URL,
} from "./services/api";
import {
  registerOAuthDeepLinkHandler,
  signOutSupabaseAuth,
  syncSupabaseAuthSession,
} from "./services/oauth";
import {
  cancelDeviceReminder,
  scheduleDeviceReminder,
  syncDeviceReminders,
} from "./services/mobileCapabilities";

const viewAccess = {
  assistant: ["Super Admin", "Admin", "Viewer"],
  dashboard: ["Super Admin", "Admin", "Viewer"],
  calendar: ["Super Admin", "Admin"],
  meetings: ["Super Admin", "Admin"],
  tasks: ["Super Admin", "Admin"],
  approvals: ["Super Admin", "Admin"],
  transcripts: ["Super Admin", "Admin"],
  projects: ["Super Admin", "Admin"],
  partners: ["Super Admin", "Admin"],
  advisor: ["Super Admin", "Admin"],
  operations: ["Super Admin", "Admin"],
  settings: ["Super Admin"],
};

function getInitialActiveView() {
  if (typeof window === "undefined") {
    return "assistant";
  }

  const requestedView = new URLSearchParams(window.location.search).get("view");

  return viewAccess[requestedView] ? requestedView : "assistant";
}

function getPublicLegalPath() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.pathname.replace(/\/$/, "");
}

function canAccessView(user, view) {
  if (!user) {
    return false;
  }

  return (viewAccess[view] || viewAccess.dashboard).includes(user.role);
}

function AccessRestricted({ currentUser }) {
  return (
    <div className="luxury-panel rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="luxury-soft-icon mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-black text-slate-950">
        Access Restricted
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
        Your current role is {currentUser?.role || "Viewer"}. This section is
        only available to authorized operational users.
      </p>
    </div>
  );
}

export default function ADOperationalHub() {
  const [authLoading, setAuthLoading] = useState(true);
  const [introComplete, setIntroComplete] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeView, setActiveView] = useState(getInitialActiveView);
  const [meetings, setMeetings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [inboxItems, setInboxItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [partners, setPartners] = useState([]);
  const [activities, setActivities] = useState([]);
  const [operations, setOperations] = useState([]);
  const [transcriptionAutoStartKey, setTranscriptionAutoStartKey] = useState(0);
  const [, setGmailRefreshKey] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const mainScrollRef = useRef(null);

  const canManageAccess = currentUser?.role === "Super Admin";
  const canManageOperations =
    currentUser?.role === "Super Admin" || currentUser?.role === "Admin";

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => canAccessView(currentUser, item.key));
  }, [currentUser]);

  const isActiveViewAllowed = canAccessView(currentUser, activeView);

  const activeLabel = useMemo(() => {
    return (
      navItems.find((item) => item.key === activeView)?.label ||
      "Dashboard"
    );
  }, [activeView]);

  const isAuthCallbackPath =
    typeof window !== "undefined" &&
    window.location.pathname === "/auth/callback";
  const publicLegalPath = getPublicLegalPath();
  const isPublicLegalPath =
    publicLegalPath === "/privacy" || publicLegalPath === "/terms";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIntroComplete(true);
    }, 1100);

    return () => window.clearTimeout(timer);
  }, []);

  const handleAuthComplete = useCallback((user) => {
    setCurrentUser(user);
    setActiveView("assistant");
    setAuthLoading(false);

    if (
      typeof window !== "undefined" &&
      window.history?.replaceState &&
      window.location.pathname === "/auth/callback"
    ) {
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let removeOAuthDeepLinkHandler = () => {};

    if (
      typeof window !== "undefined" &&
      window.history?.replaceState &&
      window.location.pathname === "/" &&
      (window.location.search.includes("view=") ||
        window.location.search.includes("gmail="))
    ) {
      window.history.replaceState({}, document.title, "/");
    }

    registerOAuthDeepLinkHandler(
      (user) => {
        if (isMounted) {
          handleAuthComplete(user);
        }
      },
      (returnUrl) => {
        if (!isMounted) {
          return;
        }

        const requestedView = returnUrl.searchParams.get("view");
        const gmailTransfer = returnUrl.searchParams.get("gmailTransfer");

        if (viewAccess[requestedView]) {
          setActiveView(requestedView);
        }

        if (gmailTransfer) {
          setActiveView("emails");
          completeNativeGmailConnection(gmailTransfer)
            .then((data) => {
              if (!data.ok) {
                console.warn(
                  "Could not complete native Gmail connection:",
                  data.error
                );
              }

              setGmailRefreshKey(Date.now());
            })
            .catch((error) => {
              console.warn("Could not complete native Gmail connection:", error);
              setGmailRefreshKey(Date.now());
            });
        }

        if (window.history?.replaceState) {
          window.history.replaceState({}, document.title, "/");
        }
      }
    )
      .then((removeHandler) => {
        if (!isMounted) {
          removeHandler();
          return;
        }

        removeOAuthDeepLinkHandler = removeHandler;
      })
      .catch((error) => {
        console.warn("Could not register OAuth deep link handler:", error);
      });

    async function loadSession() {
      try {
        let syncedUser = null;

        try {
          syncedUser = await syncSupabaseAuthSession();
        } catch (error) {
          console.warn("Could not sync Supabase auth session:", error);
        }

        if (syncedUser) {
          if (isMounted) {
            handleAuthComplete(syncedUser);
          }
          return;
        }

        const data = await getCurrentUser();

        if (isMounted) {
          setCurrentUser(data.user || null);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      isMounted = false;
      removeOAuthDeepLinkHandler();
    };
  }, [handleAuthComplete]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let isMounted = true;

    async function loadLiveData() {
      try {
        setDataLoading(true);
        setDataError("");

        const [
          meetingsData,
          alertsData,
          alarmsData,
          projectsData,
          partnersData,
          activitiesData,
          operationsData,
        ] = await Promise.all([
          getMeetings(),
          getAlerts(),
          getAlarms(),
          getProjects(),
          getPartners(),
          getActivities(),
          getOperations(),
        ]);

        if (!isMounted) {
          return;
        }

        setMeetings(meetingsData.meetings || []);
        setAlerts(alertsData.alerts || []);
        setReminders(alarmsData.alarms || []);
        setProjects(projectsData.projects || []);
        setPartners(partnersData.partners || []);
        setActivities(activitiesData.activities || []);
        setOperations(operationsData.operations || []);

        const failed = [
          meetingsData,
          alertsData,
          alarmsData,
          projectsData,
          partnersData,
          activitiesData,
          operationsData,
        ].find((result) => !result.ok);

        if (failed) {
          setDataError(failed.error || "Some live records could not be loaded.");
        }
      } catch {
        if (isMounted) {
          setDataError("Could not connect to the live operational data API.");
        }
      } finally {
        if (isMounted) {
          setDataLoading(false);
        }
      }
    }

    loadLiveData();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    syncDeviceReminders(reminders);
  }, [currentUser, reminders]);

  useEffect(() => {
    if (!currentUser || !Capacitor.isNativePlatform()) {
      return undefined;
    }

    let listener;

    CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        syncDeviceReminders(reminders);
      }
    })
      .then((handle) => {
        listener = handle;
      })
      .catch((error) => {
        console.warn("Could not register Android reminder resume sync:", error);
      });

    return () => {
      listener?.remove();
    };
  }, [currentUser, reminders]);

  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [activeView]);

  useEffect(() => {
    const url = `${API_BASE_URL}/health`;
    const ping = () => fetch(url, { method: "GET" }).catch(() => {});
    ping();
    const id = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  async function handleLogout() {
    try {
      await signOutSupabaseAuth().catch((error) => {
        console.warn("Could not clear Supabase auth session:", error);
      });
      await logoutUser();
    } finally {
      setCurrentUser(null);
      setMeetings([]);
      setAlerts([]);
      setReminders([]);
      setInboxItems([]);
      setProjects([]);
      setPartners([]);
      setActivities([]);
      setOperations([]);
      setTranscriptionAutoStartKey(0);
      setActiveView("assistant");
    }
  }

  function startTranscribingFromCommand() {
    setTranscriptionAutoStartKey(Date.now());
    setActiveView("transcripts");
  }

  async function handleMissionControlSnooze(notification, minutes = 10) {
    if (notification.kind !== "alarm") {
      return;
    }

    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const data = await updateAlarm(notification.recordId, {
      snoozed_until: snoozedUntil,
      status: "Pending",
    });

    if (data.ok && data.alarm) {
      scheduleDeviceReminder(data.alarm, { setNativeAlarm: true }).catch((error) => {
        console.warn("Could not schedule device reminder:", error);
      });
      setReminders((previous) =>
        previous.map((reminder) =>
          reminder.id === data.alarm.id ? data.alarm : reminder
        )
      );
    }
  }

  async function handleMissionControlReschedule(notification, nextDateValue) {
    if (notification.kind !== "alarm" || !nextDateValue) {
      return;
    }

    const nextDate = new Date(nextDateValue);

    if (Number.isNaN(nextDate.getTime())) {
      return;
    }

    const data = await updateAlarm(notification.recordId, {
      due_at: nextDate.toISOString(),
      reminder_time: nextDate.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      snoozed_until: null,
      status: "Pending",
    });

    if (data.ok && data.alarm) {
      scheduleDeviceReminder(data.alarm, { setNativeAlarm: true }).catch((error) => {
        console.warn("Could not schedule device reminder:", error);
      });
      setReminders((previous) =>
        previous.map((reminder) =>
          reminder.id === data.alarm.id ? data.alarm : reminder
        )
      );
    }
  }

  async function handleMissionControlTrigger(notification, updates) {
    if (notification.kind !== "alarm") {
      return;
    }

    const data = await updateAlarm(notification.recordId, updates);

    if (data.ok && data.alarm) {
      scheduleDeviceReminder(data.alarm, { setNativeAlarm: true }).catch((error) => {
        console.warn("Could not schedule device reminder:", error);
      });
      setReminders((previous) =>
        previous.map((reminder) =>
          reminder.id === data.alarm.id ? data.alarm : reminder
        )
      );
    }
  }

  function handleMissionControlOpen(notification) {
    if (
      notification.kind === "meeting" ||
      notification.relatedType === "meeting"
    ) {
      setActiveView("meetings");
      return;
    }

    if (["alert", "operation"].includes(notification.kind)) {
      setActiveView("operations");
      return;
    }

    setActiveView("dashboard");
  }

  async function handleMissionControlDone(notification) {
    if (notification.kind === "alarm") {
      const currentReminder = reminders.find(
        (reminder) => reminder.id === notification.recordId
      );
      const relatedReminderIds = new Set(
        reminders
          .filter((reminder) => {
            if (reminder.id === notification.recordId) {
              return true;
            }

            if (
              !currentReminder?.related_id ||
              reminder.related_id !== currentReminder.related_id ||
              reminder.related_type !== currentReminder.related_type
            ) {
              return false;
            }

            const currentDue = new Date(currentReminder.due_at).getTime();
            const reminderDue = new Date(reminder.due_at).getTime();

            return (
              Number.isFinite(currentDue) &&
              Number.isFinite(reminderDue) &&
              Math.abs(currentDue - reminderDue) < 60_000
            );
          })
          .map((reminder) => reminder.id)
      );
      relatedReminderIds.add(notification.recordId);
      const completedReminder = {
        ...(currentReminder || {}),
        id: notification.recordId,
        status: "Completed",
        snoozed_until: null,
      };

      setReminders((previous) =>
        previous.map((reminder) =>
          relatedReminderIds.has(reminder.id)
            ? { ...reminder, status: "Completed", snoozed_until: null }
            : reminder
        )
      );
      reminders
        .filter((reminder) => relatedReminderIds.has(reminder.id))
        .forEach((reminder) => {
          cancelDeviceReminder(reminder).catch((error) => {
            console.warn("Could not cancel device reminder:", error);
          });
        });

      const completedUpdates = await Promise.all(
        [...relatedReminderIds].map((reminderId) =>
          updateAlarm(reminderId, {
            status: "Completed",
            snoozed_until: null,
          })
        )
      );

      const updatedAlarms = completedUpdates
        .filter((data) => data.ok && data.alarm)
        .map((data) => data.alarm);

      if (updatedAlarms.length > 0) {
        setReminders((previous) =>
          previous.map((reminder) =>
            updatedAlarms.find((alarm) => alarm.id === reminder.id) || reminder
          )
        );
      }

      if (currentReminder?.related_type === "meeting" && currentReminder.related_id) {
        setMeetings((previous) =>
          previous.map((meeting) =>
            meeting.id === currentReminder.related_id
              ? { ...meeting, status: "Completed" }
              : meeting
          )
        );

        const meetingData = await updateMeeting(currentReminder.related_id, {
          status: "Completed",
        });

        if (meetingData.ok && meetingData.meeting) {
          setMeetings((previous) =>
            previous.map((meeting) =>
              meeting.id === meetingData.meeting.id ? meetingData.meeting : meeting
            )
          );
        }
      }

      if (relatedReminderIds.size === 0) {
        cancelDeviceReminder(currentReminder || completedReminder).catch((error) => {
          console.warn("Could not cancel device reminder:", error);
        });
      }
      return;
    }

    if (notification.kind === "meeting") {
      setMeetings((previous) =>
        previous.map((meeting) =>
          meeting.id === notification.recordId
            ? { ...meeting, status: "Completed" }
            : meeting
        )
      );

      const data = await updateMeeting(notification.recordId, {
        status: "Completed",
      });

      if (data.ok && data.meeting) {
        setMeetings((previous) =>
          previous.map((meeting) =>
            meeting.id === data.meeting.id ? data.meeting : meeting
          )
        );
      }
      return;
    }

    if (notification.kind === "alert") {
      const data = await updateAlert(notification.recordId, {
        status: "Resolved",
      });

      if (data.ok && data.alert) {
        setAlerts((previous) =>
          previous.map((alert) =>
            alert.id === data.alert.id ? data.alert : alert
          )
        );
      }
      return;
    }

    if (notification.kind === "operation") {
      const data = await updateOperation(notification.recordId, {
        status: "Resolved",
      });

      if (data.ok && data.operation) {
        setOperations((previous) =>
          previous.map((operation) =>
            operation.id === data.operation.id ? data.operation : operation
          )
        );
      }
    }
  }

  const renderView = () => {
    if (!isActiveViewAllowed) {
      return <AccessRestricted currentUser={currentUser} />;
    }

    switch (activeView) {
      case "assistant":
        return (
          <VoiceHomeView
            setAlerts={setAlerts}
            setMeetings={setMeetings}
            setOperations={setOperations}
            setPartners={setPartners}
            setReminders={setReminders}
            onNavigate={setActiveView}
            onStartTranscribing={startTranscribingFromCommand}
          />
        );
      case "settings":
        return <SettingsView currentUser={currentUser} onLogout={handleLogout} />;
      case "calendar":
        return (
          <CalendarView
            setMeetings={setMeetings}
            setReminders={setReminders}
          />
        );
      case "meetings":
        return (
          <MeetingsView
            meetings={meetings}
            setMeetings={setMeetings}
            setReminders={setReminders}
          />
        );
      case "tasks":
        return <TaskBoardView />;
      case "approvals":
        return <ApprovalCenterView onNavigate={setActiveView} />;
      case "transcripts":
        return <TranscriptsView autoStartKey={transcriptionAutoStartKey} />;
      case "projects":
        return <ProjectsView projects={projects} setProjects={setProjects} />;
      case "partners":
        return <PartnersView partners={partners} setPartners={setPartners} />;
      case "advisor":
        return <ConversationAdvisorView />;
      case "operations":
        return (
          <OperationsView
            activities={activities}
            operations={operations}
            setAlerts={setAlerts}
            setActivities={setActivities}
            setOperations={setOperations}
          />
        );
      default:
        return (
          <DashboardView
            meetings={meetings}
            alerts={alerts}
            reminders={reminders}
            projects={projects}
            activities={activities}
            operations={operations}
            canManageOperations={canManageOperations}
            setMeetings={setMeetings}
            setAlerts={setAlerts}
            setReminders={setReminders}
            setInboxItems={setInboxItems}
            setProjects={setProjects}
            setPartners={setPartners}
            setActivities={setActivities}
            setOperations={setOperations}
            onStartTranscribing={startTranscribingFromCommand}
            onNavigate={setActiveView}
          />
        );
    }
  };

  if (authLoading || !introComplete) {
    if (isAuthCallbackPath) {
      return <AuthCallbackPage onAuthenticated={handleAuthComplete} />;
    }

    if (isPublicLegalPath) {
      return (
        <LegalPage type={publicLegalPath === "/terms" ? "terms" : "privacy"} />
      );
    }

    return (
      <AppSplashScreen
        message={
          authLoading
            ? "Preparing your executive workspace"
            : "Opening your command center"
        }
      />
    );
  }

  if (isAuthCallbackPath) {
    return <AuthCallbackPage onAuthenticated={handleAuthComplete} />;
  }

  if (isPublicLegalPath) {
    return (
      <LegalPage type={publicLegalPath === "/terms" ? "terms" : "privacy"} />
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} />;
  }

  return (
    <div className="luxury-app h-[100dvh] overflow-hidden bg-slate-100 text-slate-950">
      <div className="flex h-full min-w-0">
        <Sidebar
          activeView={activeView}
          currentUser={currentUser}
          items={visibleNavItems}
          meetings={meetings}
          reminders={reminders}
          onLogout={handleLogout}
          setActiveView={setActiveView}
        />

        <main
          ref={mainScrollRef}
          className="luxury-main min-h-0 min-w-0 flex-1 overflow-y-auto p-4 pb-24 md:p-8"
        >
          <div className="mx-auto w-full max-w-7xl">
            <Header
              alerts={alerts}
              reminders={reminders}
              activeLabel={activeLabel}
              canManageAccess={canManageAccess}
              canManageOperations={canManageOperations}
              currentUser={currentUser}
              inboxItems={inboxItems}
              meetings={meetings}
              operations={operations}
              partners={partners}
              projects={projects}
              onAlarmMarkDone={handleMissionControlDone}
              onAlarmOpenRelated={handleMissionControlOpen}
              onAlarmReschedule={handleMissionControlReschedule}
              onAlarmSnooze={handleMissionControlSnooze}
              onAlarmTrigger={handleMissionControlTrigger}
              onLogout={handleLogout}
              onNavigate={setActiveView}
              onSettingsClick={() => setActiveView("settings")}
            />

            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {(dataLoading || dataError) && (
                <div className="luxury-panel mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
                  {dataLoading ? "Loading live operational records..." : dataError}
                </div>
              )}
              {renderView()}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
