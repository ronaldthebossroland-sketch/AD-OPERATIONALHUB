import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";

import LoginPage from "./components/auth/LoginPage";
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import ApprovalCenterView from "./components/pages/ApprovalCenterView";
import CalendarView from "./components/pages/CalendarView";
import DashboardView from "./components/pages/DashboardView";
import EmailsView from "./components/pages/EmailsView";
import MeetingsView from "./components/pages/MeetingsView";
import OperationsView from "./components/pages/OperationsView";
import PartnersView from "./components/pages/PartnersView";
import ProjectsView from "./components/pages/ProjectsView";
import SettingsView from "./components/pages/SettingsView";
import TaskBoardView from "./components/pages/TaskBoardView";
import TranscriptsView from "./components/pages/TranscriptsView";
import { navItems } from "./data/navItems";
import {
  getActivities,
  getAlarms,
  getAlerts,
  getCurrentUser,
  getMeetings,
  getOperations,
  getPartners,
  getProjects,
  logoutUser,
  updateAlarm,
  updateAlert,
  updateOperation,
} from "./services/api";
import { syncSupabaseAuthSession } from "./services/oauth";

const viewAccess = {
  dashboard: ["Super Admin", "Admin", "Viewer"],
  calendar: ["Super Admin", "Admin"],
  meetings: ["Super Admin", "Admin"],
  tasks: ["Super Admin", "Admin"],
  approvals: ["Super Admin", "Admin"],
  transcripts: ["Super Admin", "Admin"],
  projects: ["Super Admin", "Admin"],
  partners: ["Super Admin", "Admin"],
  emails: ["Super Admin", "Admin"],
  operations: ["Super Admin", "Admin"],
  settings: ["Super Admin"],
};

function canAccessView(user, view) {
  if (!user) {
    return false;
  }

  return (viewAccess[view] || viewAccess.dashboard).includes(user.role);
}

function AccessRestricted({ currentUser }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
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
  const [currentUser, setCurrentUser] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [meetings, setMeetings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [inboxItems, setInboxItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [partners, setPartners] = useState([]);
  const [activities, setActivities] = useState([]);
  const [operations, setOperations] = useState([]);
  const [transcriptionAutoStartKey, setTranscriptionAutoStartKey] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

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

  useEffect(() => {
    let isMounted = true;

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
            setCurrentUser(syncedUser);
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
    };
  }, []);

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

  async function handleLogout() {
    try {
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
      setActiveView("dashboard");
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
      const data = await updateAlarm(notification.recordId, {
        status: "Completed",
      });

      if (data.ok && data.alarm) {
        setReminders((previous) =>
          previous.map((reminder) =>
            reminder.id === data.alarm.id ? data.alarm : reminder
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
      case "emails":
        return (
          <EmailsView inboxItems={inboxItems} setInboxItems={setInboxItems} />
        );
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm font-bold text-slate-500">
        Loading AD Operational Hub...
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 text-slate-950">
      <div className="flex min-h-screen min-w-0">
        <Sidebar
          activeView={activeView}
          currentUser={currentUser}
          items={visibleNavItems}
          meetings={meetings}
          reminders={reminders}
          onLogout={handleLogout}
          setActiveView={setActiveView}
        />

        <main className="min-w-0 flex-1 p-4 pb-24 md:p-8">
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
                <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
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
