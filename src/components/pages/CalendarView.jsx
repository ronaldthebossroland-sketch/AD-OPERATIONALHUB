import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Sparkles,
} from "lucide-react";

import {
  createCalendarEvent,
  getCalendarEvents,
  runScheduleAssistant,
} from "../../services/api";
import SectionHeader from "../shared/SectionHeader";
import StatusPill from "../shared/StatusPill";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

const eventTypes = [
  "meeting",
  "alarm",
  "operation",
  "activity",
  "service",
  "transcript",
  "outreach",
  "event",
];

const eventTone = {
  meeting: "border-blue-200 bg-blue-50 text-blue-800",
  alarm: "border-amber-200 bg-amber-50 text-amber-800",
  operation: "border-red-200 bg-red-50 text-red-800",
  activity: "border-emerald-200 bg-emerald-50 text-emerald-800",
  service: "border-violet-200 bg-violet-50 text-violet-800",
  transcript: "border-slate-200 bg-slate-50 text-slate-700",
  outreach: "border-cyan-200 bg-cyan-50 text-cyan-800",
  event: "border-slate-200 bg-white text-slate-700",
};

const emptyEvent = {
  title: "",
  description: "",
  event_type: "event",
  category: "General",
  start_at: "",
  end_at: "",
  location: "",
};

function toInputDateTime(date) {
  const finalDate = new Date(date);
  finalDate.setMinutes(finalDate.getMinutes() - finalDate.getTimezoneOffset());
  return finalDate.toISOString().slice(0, 16);
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function sameDay(first, second) {
  return startOfDay(first).getTime() === startOfDay(second).getTime();
}

function monthDays(anchorDate) {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function weekDays(anchorDate) {
  const start = new Date(anchorDate);
  start.setDate(anchorDate.getDate() - anchorDate.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function eventDate(event) {
  return new Date(event.start_at);
}

function eventLabel(event) {
  const date = eventDate(event);
  return Number.isNaN(date.getTime())
    ? "No time"
    : date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function eventClass(type) {
  return eventTone[type] || eventTone.event;
}

export default function CalendarView({ setMeetings, setReminders }) {
  const [events, setEvents] = useState([]);
  const [view, setView] = useState("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedTypes, setSelectedTypes] = useState(() => new Set(eventTypes));
  const [form, setForm] = useState(emptyEvent);
  const [message, setMessage] = useState("");
  const [assistantCommand, setAssistantCommand] = useState("");
  const [assistantResult, setAssistantResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  const filteredEvents = useMemo(
    () =>
      events
        .filter((event) => selectedTypes.has(event.event_type || "event"))
        .sort(
          (a, b) =>
            new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
        ),
    [events, selectedTypes]
  );
  const upcomingEvents = filteredEvents.filter(
    (event) => eventDate(event).getTime() >= nowMs - 60 * 60 * 1000
  );
  const activeDays = view === "week" ? weekDays(anchorDate) : [anchorDate];

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      try {
        const data = await getCalendarEvents();

        if (isMounted) {
          setEvents(data.events || []);
          if (!data.ok) {
            setMessage(data.error || "Could not load calendar events.");
          }
        }
      } catch {
        if (isMounted) {
          setMessage("Could not reach the calendar API.");
        }
      }
    }

    loadEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 0);
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  function setField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function chooseDate(date, hour = 9) {
    const next = new Date(date);
    next.setHours(hour, 0, 0, 0);
    const end = new Date(next);
    end.setHours(next.getHours() + 1);
    setAnchorDate(next);
    setForm((previous) => ({
      ...previous,
      start_at: toInputDateTime(next),
      end_at: toInputDateTime(end),
    }));
  }

  function moveAnchor(direction) {
    const next = new Date(anchorDate);

    if (view === "month") {
      next.setMonth(anchorDate.getMonth() + direction);
    } else if (view === "week") {
      next.setDate(anchorDate.getDate() + direction * 7);
    } else {
      next.setDate(anchorDate.getDate() + direction);
    }

    setAnchorDate(next);
  }

  async function saveEvent() {
    if (!form.title.trim() || !form.start_at) {
      setMessage("Add an event title and start time.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const data = await createCalendarEvent(form);

      if (!data.ok) {
        setMessage(data.error || "Could not save event.");
        return;
      }

      setEvents((previous) => [data.event, ...previous]);
      setForm(emptyEvent);
      setMessage("Calendar event saved.");
    } catch {
      setMessage("Could not reach the calendar API.");
    } finally {
      setIsLoading(false);
    }
  }

  async function runAssistant() {
    if (!assistantCommand.trim()) {
      setAssistantResult({ summary: "Type a schedule command first." });
      return;
    }

    setIsLoading(true);
    setAssistantResult({ summary: "AI is checking the schedule..." });

    try {
      const data = await runScheduleAssistant(assistantCommand);

      if (!data.ok) {
        setAssistantResult({
          summary: data.summary || data.error || "Could not schedule event.",
          missing: data.missing || [],
        });
        return;
      }

      setEvents((previous) => [data.event, ...previous]);
      if (data.meeting) {
        setMeetings?.((previous) => [data.meeting, ...previous]);
      }
      if (data.alarm) {
        setReminders?.((previous) => [data.alarm, ...previous]);
      }
      setAssistantCommand("");
      setAssistantResult(data);
    } catch {
      setAssistantResult({ summary: "Could not reach the schedule assistant." });
    } finally {
      setIsLoading(false);
    }
  }

  function toggleType(type) {
    setSelectedTypes((previous) => {
      const next = new Set(previous);

      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }

      return next;
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={Sparkles}
              title="AI Schedule Assistant"
              subtitle="Create calendar events, meetings, and reminders from natural language"
            />
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={assistantCommand}
                onChange={(event) => setAssistantCommand(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") runAssistant();
                }}
                placeholder="Schedule partnership review next Tuesday by 2pm"
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
              <Button
                onClick={runAssistant}
                disabled={isLoading}
                className="rounded-2xl"
              >
                {isLoading ? "Checking..." : "Schedule"}
              </Button>
            </div>
            {assistantResult && (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <p className="font-black text-slate-950">
                  {assistantResult.summary}
                </p>
                {assistantResult.clashes?.length > 0 && (
                  <p className="mt-2 text-amber-700">
                    Clash detected. Suggested start:{" "}
                    {new Date(
                      assistantResult.suggested_start_at
                    ).toLocaleString()}
                  </p>
                )}
                {assistantResult.missing?.length > 0 && (
                  <p className="mt-2 text-amber-700">
                    Missing: {assistantResult.missing.join(", ")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={CalendarDays}
              title="Calendar"
              subtitle="Meetings, reminders, operations, services, outreach, and transcripts"
              action={
                <div className="flex flex-wrap gap-2">
                  {["month", "week", "day"].map((mode) => (
                    <Button
                      key={mode}
                      onClick={() => setView(mode)}
                      variant={view === mode ? "default" : "outline"}
                      className="rounded-2xl capitalize"
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
              }
            />

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  onClick={() => moveAnchor(-1)}
                  variant="outline"
                  className="rounded-2xl"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setAnchorDate(new Date())}
                  variant="outline"
                  className="rounded-2xl"
                >
                  Today
                </Button>
                <Button
                  onClick={() => moveAnchor(1)}
                  variant="outline"
                  className="rounded-2xl"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <h2 className="text-lg font-black text-slate-950">
                {anchorDate.toLocaleDateString([], {
                  month: "long",
                  year: "numeric",
                })}
              </h2>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {eventTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${
                    selectedTypes.has(type)
                      ? eventClass(type)
                      : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {view === "month" ? (
              <div className="grid grid-cols-7 gap-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="px-2 text-xs font-black uppercase text-slate-400"
                  >
                    {day}
                  </div>
                ))}
                {monthDays(anchorDate).map((date) => {
                  const dayEvents = filteredEvents.filter((event) =>
                    sameDay(eventDate(event), date)
                  );
                  const isCurrentMonth =
                    date.getMonth() === anchorDate.getMonth();

                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => chooseDate(date)}
                      className={`min-h-28 rounded-2xl border p-2 text-left transition hover:border-slate-400 ${
                        isCurrentMonth
                          ? "border-slate-200 bg-white"
                          : "border-slate-100 bg-slate-50 text-slate-400"
                      }`}
                    >
                      <span className="text-xs font-black">
                        {date.getDate()}
                      </span>
                      <div className="mt-2 space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className={`truncate rounded-lg border px-2 py-1 text-[11px] font-bold ${eventClass(
                              event.event_type
                            )}`}
                          >
                            {event.title}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {activeDays.map((date) => {
                  const dayEvents = filteredEvents.filter((event) =>
                    sameDay(eventDate(event), date)
                  );

                  return (
                    <div
                      key={date.toISOString()}
                      className="rounded-3xl border border-slate-100 p-4"
                    >
                      <button
                        onClick={() => chooseDate(date)}
                        className="font-black text-slate-950"
                      >
                        {date.toLocaleDateString([], {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                      </button>
                      <div className="mt-3 space-y-2">
                        {dayEvents.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No events scheduled.
                          </p>
                        ) : (
                          dayEvents.map((event) => (
                            <div
                              key={event.id}
                              className={`rounded-2xl border p-3 ${eventClass(
                                event.event_type
                              )}`}
                            >
                              <div className="flex flex-wrap justify-between gap-2">
                                <p className="font-black">{event.title}</p>
                                <span className="text-xs font-bold">
                                  {eventLabel(event)}
                                </span>
                              </div>
                              {event.description && (
                                <p className="mt-1 text-sm leading-5 opacity-80">
                                  {event.description}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 xl:col-span-4">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={Plus}
              title="Create Event"
              subtitle="Click a date or fill in the details"
            />
            <div className="space-y-3">
              <input
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Event title"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
              <select
                value={form.event_type}
                onChange={(event) => {
                  setField("event_type", event.target.value);
                  setField("category", event.target.value);
                }}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
              >
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={form.start_at}
                onChange={(event) => setField("start_at", event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
              <input
                type="datetime-local"
                value={form.end_at}
                onChange={(event) => setField("end_at", event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
              <input
                value={form.location}
                onChange={(event) => setField("location", event.target.value)}
                placeholder="Location"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
              <textarea
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
                placeholder="Notes"
                className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
              <Button
                onClick={saveEvent}
                disabled={isLoading}
                className="w-full rounded-2xl"
              >
                Save Event
              </Button>
              {message && (
                <p className="text-sm font-bold text-slate-600">{message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={Clock3}
              title="Upcoming"
              subtitle="Next scheduled items"
            />
            {upcomingEvents.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
                No upcoming events.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.slice(0, 8).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-3xl border border-slate-100 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-black text-slate-950">
                        {event.title}
                      </h3>
                      <StatusPill status={event.event_type || "event"} />
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-600">
                      {eventLabel(event)}
                    </p>
                    {event.location && (
                      <p className="mt-1 text-sm text-slate-500">
                        {event.location}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
