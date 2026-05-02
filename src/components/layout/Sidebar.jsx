import { Clock3, LogOut } from "lucide-react";

import { Button } from "../ui/button";

function getNextBriefingText(meeting, reminder) {
  if (!meeting && !reminder) {
    return "No meeting briefing is queued right now.";
  }

  if (!meeting && reminder) {
    return `${reminder.title || "Reminder"} is set for ${
      reminder.reminder_time || "the next operating window"
    }.`;
  }

  const time = String(meeting.time || "").trim();
  const risk = String(meeting.risk || "").trim();
  const timeText = time
    ? /^(today|tomorrow|on|at)\b/i.test(time)
      ? `starts ${time}`
      : `starts at ${time}`
    : "is queued";

  return `${meeting.title} ${timeText}.${risk ? ` ${risk}` : ""}`;
}

export default function Sidebar({
  activeView,
  currentUser,
  items,
  meetings,
  reminders = [],
  onLogout,
  setActiveView,
}) {
  const nextMeeting = meetings[0];
  const nextReminder =
    reminders.find((reminder) => reminder.status !== "Completed") ||
    reminders[0];

  return (
    <>
      <aside className="luxury-sidebar hidden h-full w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-5 lg:block">
        <div className="flex items-center gap-3">
          <img
            src="/logo-mark.png"
            alt="Executive Virtual AI Assistant"
            className="luxury-logo h-14 w-14 shrink-0 rounded-2xl shadow-sm"
          />
          <div className="min-w-0">
            <h1 className="text-base font-black leading-tight text-white">
              Executive Virtual AI Assistant
            </h1>
            <p className="mt-1 text-xs font-bold text-amber-100/80">
              Premium command assistant
            </p>
          </div>
        </div>

        <nav className="mt-8 space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;

            return (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                  isActive
                    ? "luxury-sidebar-nav-active bg-slate-950 text-white"
                    : "luxury-sidebar-nav text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="luxury-briefing-card mt-8 rounded-3xl bg-slate-100 p-5">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <Clock3 className="h-4 w-4" />
            Next briefing
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {getNextBriefingText(nextMeeting, nextReminder)}
          </p>
          <Button
            onClick={() => setActiveView("meetings")}
            className="mt-4 w-full rounded-2xl"
          >
            Open
          </Button>
        </div>

        <div className="luxury-user-card mt-4 rounded-3xl border border-slate-200 bg-white p-4">
          <p className="truncate text-sm font-black text-white">
            {currentUser?.name || "Signed in"}
          </p>
          <p className="mt-1 truncate text-xs font-bold text-amber-100/75">
            {currentUser?.email || currentUser?.role}
          </p>
          <Button
            onClick={onLogout}
            variant="outline"
            className="mt-3 w-full rounded-2xl text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      <div className="luxury-mobile-nav fixed bottom-0 left-0 right-0 z-50 flex justify-start gap-1 overflow-x-auto border-t border-slate-200 bg-white px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.key;

          return (
            <button
              key={item.key}
              onClick={() => setActiveView(item.key)}
              className={`flex min-w-[4.5rem] flex-col items-center gap-1 rounded-2xl px-2 py-1 text-[11px] font-bold ${
                isActive
                  ? "luxury-mobile-nav-active text-slate-950"
                  : "text-slate-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
