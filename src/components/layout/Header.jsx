import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Clock3,
  ClipboardList,
  LogOut,
  Mail,
  Plus,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

import NotificationBell from "../shared/NotificationBell";
import { Button } from "../ui/button";

export default function Header({
  activeLabel,
  alerts,
  canManageAccess,
  canManageOperations,
  currentUser,
  inboxItems,
  meetings,
  reminders = [],
  operations = [],
  partners = [],
  projects = [],
  onAlarmMarkDone,
  onAlarmOpenRelated,
  onAlarmReschedule,
  onAlarmSnooze,
  onAlarmTrigger,
  onLogout,
  onNavigate,
  onSettingsClick,
}) {
  const [query, setQuery] = useState("");
  const [briefOpen, setBriefOpen] = useState(false);

  const focusItems = useMemo(() => {
    const nextMeeting = meetings[0];
    const nextReminder = reminders.find(
      (reminder) => reminder.status !== "Completed"
    ) || reminders[0];
    const highAlerts = alerts.filter((alert) => alert.severity === "High");
    const priorityEmail =
      inboxItems.find((item) => item.urgency === "High") || inboxItems[0];

    return [
      {
        icon: CalendarDays,
        label: "Next meeting",
        value: nextMeeting ? nextMeeting.time : "Clear",
        detail: nextMeeting ? nextMeeting.title : "No meeting queued",
        view: "meetings",
      },
      {
        icon: Clock3,
        label: "Next reminder",
        value: nextReminder ? nextReminder.reminder_time : "Clear",
        detail: nextReminder ? nextReminder.title : "No reminder queued",
        view: "dashboard",
      },
      {
        icon: AlertTriangle,
        label: "Critical alerts",
        value: highAlerts.length,
        detail:
          highAlerts[0]?.title || "No critical operations alerts right now",
        view: "operations",
      },
      {
        icon: Mail,
        label: "Priority email",
        value: inboxItems.length,
        detail: priorityEmail?.subject || "No priority emails queued",
        view: "emails",
      },
    ];
  }, [alerts, inboxItems, meetings, reminders]);

  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return [];
    }

    const records = [
      ...meetings.map((meeting) => ({
        icon: CalendarDays,
        title: meeting.title,
        detail: [meeting.time, meeting.location].filter(Boolean).join(" - "),
        view: "meetings",
      })),
      ...alerts.map((alert) => ({
        icon: AlertTriangle,
        title: alert.title,
        detail: alert.detail,
        view: "operations",
      })),
      ...reminders.map((reminder) => ({
        icon: Clock3,
        title: reminder.title,
        detail: [reminder.reminder_time, reminder.notes]
          .filter(Boolean)
          .join(" - "),
        view: "dashboard",
      })),
      ...inboxItems.map((email) => ({
        icon: Mail,
        title: email.subject,
        detail: email.from,
        view: "emails",
      })),
      ...projects.map((project) => ({
        icon: ClipboardList,
        title: project.name,
        detail: project.lead || project.status,
        view: "projects",
      })),
      ...partners.map((partner) => ({
        icon: Users,
        title: partner.name,
        detail: partner.email || partner.phone,
        view: "partners",
      })),
      ...operations.map((operation) => ({
        icon: Building2,
        title: operation.title,
        detail: `${operation.area} ${operation.detail || ""}`,
        view: "operations",
      })),
    ];

    return records
      .filter((record) =>
        `${record.title || ""} ${record.detail || ""}`
          .toLowerCase()
          .includes(normalizedQuery)
      )
      .slice(0, 8);
  }, [alerts, inboxItems, meetings, operations, partners, projects, query, reminders]);

  function openView(view) {
    onNavigate(view);
    setBriefOpen(false);
  }

  return (
    <header className="mb-8 flex min-w-0 flex-col justify-between gap-4 md:flex-row md:items-center">
      <div className="min-w-0">
        <motion.h1
          key={activeLabel}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="break-words text-2xl font-black tracking-tight text-slate-950 md:text-4xl"
        >
          {activeLabel}
        </motion.h1>
        <p className="mt-2 text-sm text-slate-500">
          Operational command center for executive ministry leadership.
        </p>
      </div>

      <div className="relative grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:items-center">
        <div className="relative col-span-2 sm:col-span-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search meetings, partners, tasks..."
            className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 sm:w-80"
          />
          {query.trim() && (
            <div className="absolute left-0 right-0 top-full z-50 mt-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-xl">
              {searchResults.length === 0 ? (
                <p className="px-3 py-2 text-sm font-bold text-slate-500">
                  No live records found.
                </p>
              ) : (
                <div className="grid gap-2">
                  {searchResults.map((result, index) => {
                    const Icon = result.icon;

                    return (
                      <button
                        key={`${result.view}-${result.title}-${index}`}
                        onClick={() => {
                          openView(result.view);
                          setQuery("");
                        }}
                        className="flex min-w-0 items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-slate-50"
                      >
                        <div className="rounded-2xl bg-slate-100 p-2">
                          <Icon className="h-4 w-4 text-slate-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">
                            {result.title}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {result.detail || result.view}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <Button
          onClick={() => setBriefOpen((isOpen) => !isOpen)}
          variant="outline"
          className="min-w-0 rounded-2xl bg-white px-3 py-3 text-xs sm:text-sm"
        >
          <Sparkles className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">Focus Brief</span>
        </Button>

        <NotificationBell
          alerts={alerts}
          meetings={meetings}
          reminders={reminders}
          operations={operations}
          onMarkDone={onAlarmMarkDone}
          onOpenRelated={onAlarmOpenRelated}
          onReschedule={onAlarmReschedule}
          onSnooze={onAlarmSnooze}
          onTrigger={onAlarmTrigger}
        />

        {canManageOperations && (
          <Button
            onClick={() => openView("meetings")}
            className="min-w-0 rounded-2xl px-3 py-3 text-xs sm:text-sm"
          >
            <Plus className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">New Meeting</span>
          </Button>
        )}

        <Button
          onClick={onLogout}
          variant="outline"
          className="min-w-0 rounded-2xl bg-white px-3 py-3 text-xs text-red-600 sm:text-sm"
        >
          <LogOut className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">Sign Out</span>
        </Button>

        {briefOpen && (
          <div className="absolute left-0 right-0 top-full z-40 mt-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:left-auto sm:w-[28rem]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-black text-slate-950">
                  Today's Focus Brief
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  A compact action snapshot for the next operating window.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {currentUser?.role || "Viewer"}
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {focusItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    onClick={() => openView(item.view)}
                    className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 p-3 text-left transition hover:bg-slate-50"
                  >
                    <div className="rounded-2xl bg-slate-100 p-2">
                      <Icon className="h-4 w-4 text-slate-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase text-slate-400">
                          {item.label}
                        </p>
                        <span className="text-sm font-black text-slate-950">
                          {item.value}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-bold text-slate-700">
                        {item.detail}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                onClick={() => openView("meetings")}
                className="rounded-2xl bg-slate-100 px-2 py-3 text-xs font-bold text-slate-700"
              >
                Meetings
              </button>
              <button
                onClick={() => openView("emails")}
                className="rounded-2xl bg-slate-100 px-2 py-3 text-xs font-bold text-slate-700"
              >
                Emails
              </button>
              <button
                onClick={() => openView("operations")}
                className="rounded-2xl bg-slate-100 px-2 py-3 text-xs font-bold text-slate-700"
              >
                Ops
              </button>
            </div>

            {canManageAccess && (
              <Button
                onClick={() => {
                  onSettingsClick();
                  setBriefOpen(false);
                }}
                variant="outline"
                className="mt-3 w-full rounded-2xl bg-white"
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                Access Settings
              </Button>
            )}

            <div className="mt-4 flex min-w-0 items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">
                  {currentUser?.name || "User"}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {currentUser?.email}
                </p>
              </div>
              <button
                onClick={onLogout}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
