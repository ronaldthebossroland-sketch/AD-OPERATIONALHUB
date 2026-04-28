import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import LoginPage from "./components/auth/LoginPage";
import SignupPage from "./components/auth/SignupPage";
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import DashboardView from "./components/pages/DashboardView";
import EmailsView from "./components/pages/EmailsView";
import MeetingsView from "./components/pages/MeetingsView";
import OperationsView from "./components/pages/OperationsView";
import PartnersView from "./components/pages/PartnersView";
import ProjectsView from "./components/pages/ProjectsView";
import SettingsView from "./components/pages/SettingsView";
import {
  initialAlerts,
  initialInboxItems,
  initialMeetings,
  navItems,
} from "./data/mockData";
import { getCurrentUser, logoutUser } from "./services/api";

export default function ADOperationalHub() {
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [meetings, setMeetings] = useState(initialMeetings);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [inboxItems, setInboxItems] = useState(initialInboxItems);

  const canManageAccess = currentUser?.role === "Super Admin";

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => !item.adminOnly || canManageAccess);
  }, [canManageAccess]);

  const resolvedActiveView =
    activeView === "settings" && !canManageAccess ? "dashboard" : activeView;

  const activeLabel = useMemo(() => {
    return (
      navItems.find((item) => item.key === resolvedActiveView)?.label ||
      "Dashboard"
    );
  }, [resolvedActiveView]);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
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

  async function handleLogout() {
    try {
      await logoutUser();
    } finally {
      setCurrentUser(null);
      setActiveView("dashboard");
      setAuthMode("login");
    }
  }

  const renderView = () => {
    switch (resolvedActiveView) {
      case "settings":
        return <SettingsView />;
      case "meetings":
        return <MeetingsView meetings={meetings} setMeetings={setMeetings} />;
      case "projects":
        return <ProjectsView />;
      case "partners":
        return <PartnersView />;
      case "emails":
        return (
          <EmailsView inboxItems={inboxItems} setInboxItems={setInboxItems} />
        );
      case "operations":
        return <OperationsView setAlerts={setAlerts} />;
      default:
        return (
          <DashboardView
            meetings={meetings}
            alerts={alerts}
            inboxItems={inboxItems}
            setMeetings={setMeetings}
            setAlerts={setAlerts}
            setInboxItems={setInboxItems}
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
    return authMode === "signup" ? (
      <SignupPage
        onSignup={setCurrentUser}
        onShowLogin={() => setAuthMode("login")}
      />
    ) : (
      <LoginPage
        onLogin={setCurrentUser}
        onShowSignup={() => setAuthMode("signup")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar
          activeView={resolvedActiveView}
          items={visibleNavItems}
          setActiveView={setActiveView}
        />

        <main className="flex-1 p-4 pb-24 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Header
              alerts={alerts}
              activeLabel={activeLabel}
              canManageAccess={canManageAccess}
              currentUser={currentUser}
              inboxItems={inboxItems}
              meetings={meetings}
              onLogout={handleLogout}
              onNavigate={setActiveView}
              onSettingsClick={() => setActiveView("settings")}
            />

            <motion.div
              key={resolvedActiveView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {renderView()}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
