import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  Building2,
  CalendarDays,
  Church,
  ClipboardList,
  Clock3,
  History,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  askHub,
  deleteAlarm,
  deleteAlert,
  generateDailyBriefing,
  getCommandLogs,
  getTasks,
  runAICommand,
} from "../../services/api";
import {
  cancelDeviceReminder,
  scheduleDeviceReminder,
} from "../../services/mobileCapabilities";
import {
  getSmartAlarmStage,
  parseSmartAlarmDueDate,
} from "../../hooks/useSmartAlarms";
import SectionHeader from "../shared/SectionHeader";
import StatusPill from "../shared/StatusPill";
import SummaryCard from "../shared/SummaryCard";
import VoiceAgent from "../shared/VoiceAgent";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <Icon className="mx-auto h-7 w-7 text-slate-400" />
      <h3 className="mt-3 font-black text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {children}
      </p>
    </div>
  );
}

function getNavigationIntent(command) {
  if (!/\b(open|go to|show|view)\b/i.test(command)) {
    return null;
  }

  if (/\b(assistant|voice|home)\b/i.test(command)) return "assistant";
  if (/\bcalendar|schedule\b/i.test(command)) return "calendar";
  if (/\bmeetings?\b/i.test(command)) return "meetings";
  if (/\btasks?|kanban|board\b/i.test(command)) return "tasks";
  if (/\bapprovals?|approve|review queue\b/i.test(command)) return "approvals";
  if (/\b(transcripts?|transcrib)/i.test(command)) return "transcripts";
  if (/\bprojects?\b/i.test(command)) return "projects";
  if (/\bpartners?|partnerships?|vendors?\b/i.test(command)) return "partners";
  if (/\bemails?|gmail|inbox\b/i.test(command)) return "emails";
  if (/\boperations?|tasks?|actions?|repairs?|issues?|queue\b/i.test(command)) {
    return "operations";
  }
  if (/\bsettings?|users?|access\b/i.test(command)) return "settings";
  if (/\bdashboard|home\b/i.test(command)) return "dashboard";

  return null;
}

function commandWantsTranscription(command) {
  return /\b(start|begin|open)\s+(live\s+)?(transcrib\w*|transcription)\b/i.test(
    command
  );
}

function isTranscriptionOnlyCommand(command) {
  const remaining = cleanDisplayText(command)
    .replace(
      /\b(start|begin|open)\s+(live\s+)?(transcrib\w*|transcription)\b/gi,
      ""
    )
    .replace(/\b(please|now|and|then|also)\b/gi, "")
    .trim();

  return !remaining;
}

function dedupeRecords(records, getKey) {
  const seen = new Set();

  return records.filter((record) => {
    const key = getKey(record);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function cleanDisplayText(value) {
  return String(value || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .trim();
}

function getAlertGroupKey(alert) {
  return `${alert.title || ""}|${alert.severity || ""}|${alert.status || ""}`.toLowerCase();
}

function isOpenDashboardStatus(status) {
  return !["completed", "done", "resolved", "closed", "rejected"].includes(
    String(status || "").toLowerCase()
  );
}

function isTimedRiskStage(stage) {
  return ["approaching", "urgent", "critical", "overdue"].includes(stage);
}

function formatRiskDueTime(dueAt) {
  if (!dueAt) {
    return "";
  }

  return dueAt.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function stageSeverity(stage) {
  return stage === "approaching" ? "Medium" : "High";
}

const completedCommandStatuses = new Set([
  "created",
  "already_exists",
  "drafted",
  "generated",
  "completed",
  "started",
]);

function actionTypeLabel(type) {
  const labels = {
    meeting: "Meeting",
    alarm: "Reminder",
    operation_alert: "Alert",
    email_draft: "Email Draft",
    report: "Report",
    transcript_summary: "Transcript Summary",
    briefing: "Briefing",
    task: "Task",
    general_ai: "AI",
    transcription: "Transcription",
  };

  return labels[type] || type.replaceAll("_", " ");
}

function actionStatusClass(status) {
  if (completedCommandStatuses.has(status)) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "needs_clarification") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-rose-50 text-rose-700";
}

function getActionDetail(action) {
  const data = action.data || {};

  return cleanDisplayText(
    action.message ||
      data.output ||
      data.summary ||
      data.draft?.subject ||
      data.alarm?.reminder_time ||
      data.task?.detail ||
      data.task?.deadline ||
      data.meeting?.time ||
      data.alert?.detail ||
      data.operation?.detail ||
      ""
  );
}

function CommandResultPanel({ result, onNavigate }) {
  const actions = result?.actions || [];
  const hasMeetings = actions.some((action) => action.type === "meeting");
  const hasAlerts = actions.some((action) => action.type === "operation_alert");
  const hasOperations = actions.some((action) =>
    ["operation_alert", "task"].includes(action.type)
  );
  const hasEmails = actions.some((action) => action.type === "email_draft");
  const incompleteActions = actions.filter(
    (action) => !completedCommandStatuses.has(action.status)
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="font-black text-slate-950">{result.summary}</p>
        {incompleteActions.length > 0 && (
          <p className="mt-1 text-xs font-bold text-amber-700">
            {incompleteActions.length} item
            {incompleteActions.length === 1 ? "" : "s"} need attention.
          </p>
        )}
      </div>

      <div className="space-y-2">
        {actions.map((action, index) => (
          <div
            key={`${action.type}-${action.title}-${index}`}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black text-slate-950">
                  {action.title || actionTypeLabel(action.type)}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {actionTypeLabel(action.type)}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${actionStatusClass(
                  action.status
                )}`}
              >
                {action.status?.replaceAll("_", " ") || "completed"}
              </span>
            </div>

            {getActionDetail(action) && (
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {getActionDetail(action)}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {hasMeetings && (
          <Button
            onClick={() => onNavigate("meetings")}
            variant="outline"
            className="rounded-xl px-3 py-2 text-xs"
          >
            Open Meetings
          </Button>
        )}
        {hasAlerts && (
          <Button
            onClick={() => onNavigate("operations")}
            variant="outline"
            className="rounded-xl px-3 py-2 text-xs"
          >
            Open Alerts
          </Button>
        )}
        {hasOperations && (
          <Button
            onClick={() => onNavigate("operations")}
            variant="outline"
            className="rounded-xl px-3 py-2 text-xs"
          >
            Open Operations
          </Button>
        )}
        {hasEmails && (
          <Button
            onClick={() => onNavigate("emails")}
            variant="outline"
            className="rounded-xl px-3 py-2 text-xs"
          >
            Open Emails
          </Button>
        )}
      </div>
    </div>
  );
}

function QuickAICommand({
  setMeetings,
  setAlerts,
  setReminders,
  setOperations,
  onNavigate,
  onStartTranscribing,
}) {
  const [command, setCommand] = useState("");
  const [response, setResponse] = useState(
    "Ask for a summary, briefing, email draft, risk review, or operating report based on live records."
  );
  const [commandResult, setCommandResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  function applyCommandAction(action) {
    const data = action.data || {};

    if (action.type === "meeting" && data.meeting) {
      setMeetings?.((previous) => [data.meeting, ...previous]);

      if (data.alarm) {
        setReminders?.((previous) => [data.alarm, ...previous]);
        scheduleDeviceReminder(data.alarm, { setNativeAlarm: true }).catch(
          (error) => {
            console.warn("Could not schedule device reminder:", error);
          }
        );
      }
    }

    if (action.type === "alarm" && data.alarm) {
      setReminders?.((previous) => [data.alarm, ...previous]);
      scheduleDeviceReminder(data.alarm, { setNativeAlarm: true }).catch(
        (error) => {
          console.warn("Could not schedule device reminder:", error);
        }
      );
    }

    if (action.type === "operation_alert") {
      if (data.alert) {
        setAlerts?.((previous) => [data.alert, ...previous]);
      }

      if (data.operation) {
        setOperations?.((previous) => [data.operation, ...previous]);
      }
    }

    if (action.type === "task" && data.operation) {
      setOperations?.((previous) => [data.operation, ...previous]);
    }
  }

  async function runCommand(customCommand) {
    const finalCommand = (customCommand || command).trim();

    if (!finalCommand) {
      setResponse("Type or say a command first.");
      setCommandResult(null);
      return;
    }

    const wantsTranscription = commandWantsTranscription(finalCommand);

    if (wantsTranscription && isTranscriptionOnlyCommand(finalCommand)) {
      const finalResult = {
        summary: "Done. Started live transcription.",
        actions: [
          {
            type: "transcription",
            status: "started",
            title: "Live transcription",
            data: {},
          },
        ],
      };

      onStartTranscribing?.();
      setCommandResult(finalResult);
      setResponse(finalResult.summary);

      setCommand("");
      return;
    }

    setIsLoading(true);
    setResponse("Thinking with live operational context...");
    setCommandResult(null);

    try {
      const navigationIntent = getNavigationIntent(finalCommand);

      if (navigationIntent) {
        onNavigate?.(navigationIntent);
        setResponse(`Opening ${navigationIntent}.`);
        setCommand("");
        return;
      }

      const data = await runAICommand(finalCommand);

      if (!data.ok) {
        if (wantsTranscription) {
          const finalResult = {
            summary:
              "Started live transcription. Other command actions could not run.",
            actions: [
              {
                type: "transcription",
                status: "started",
                title: "Live transcription",
                data: {},
              },
              {
                type: "general_ai",
                status: "failed",
                title: "Command engine",
                message:
                  data.summary ||
                  data.error ||
                  "Could not run the command engine.",
              },
            ],
          };

          onStartTranscribing?.();
          setCommandResult(finalResult);
          setResponse(finalResult.summary);

          setCommand("");
          return;
        }

        setResponse(data.summary || data.error || "Could not run the command.");
        return;
      }

      const actions = data.actions || [];
      const finalActions = wantsTranscription
        ? [
            ...actions,
            {
              type: "transcription",
              status: "started",
              title: "Live transcription",
              data: {},
            },
          ]
        : actions;
      const finalSummary = wantsTranscription
        ? `${data.summary || "Done."} Started live transcription.`
        : data.summary || "Done.";
      const finalResult = {
        summary: finalSummary,
        actions: finalActions,
      };

      finalActions.forEach(applyCommandAction);

      if (wantsTranscription) {
        onStartTranscribing?.();
      }

      setCommandResult(finalResult);
      setResponse(finalSummary);

      setCommand("");
    } catch {
      setResponse(
        "Could not connect to the command engine. Check the backend server."
      );
      setCommandResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  const quickActions = [
    "Summarize today's meetings",
    "Review live operational risks",
    "Draft a follow-up email",
    "Prepare executive report",
  ];

  return (
    <Card className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-6">
        <SectionHeader
          icon={Brain}
          title="Quick AI Command"
          subtitle="AI answers from the live records currently loaded in the hub"
        />

        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runCommand();
              }}
              placeholder="Example: Prepare a briefing from live meetings and alerts"
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />

            <Button
              onClick={() => runCommand()}
              disabled={isLoading}
              className="rounded-2xl"
            >
              {isLoading ? "Thinking..." : "Run AI"}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => runCommand(action)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-800 transition hover:border-slate-950 hover:bg-slate-100"
              >
                {action}
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-[100px] rounded-2xl border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-700">
            {commandResult ? (
              <CommandResultPanel result={commandResult} onNavigate={onNavigate} />
            ) : (
              response
            )}
          </div>

          <VoiceAgent
            onAction={applyCommandAction}
            onNavigate={onNavigate}
            onResult={(result) => {
              setCommandResult(result);
              setResponse(result.summary || "Done.");
            }}
            onStartTranscribing={onStartTranscribing}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AskHubCard({ onNavigate }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [isAsking, setIsAsking] = useState(false);

  async function submitQuestion() {
    const finalQuestion = question.trim();

    if (!finalQuestion) {
      setAnswer("Ask a question about the live hub records first.");
      setSources([]);
      return;
    }

    setIsAsking(true);
    setAnswer("Searching the hub records...");
    setSources([]);

    try {
      const data = await askHub(finalQuestion);

      if (!data.ok) {
        setAnswer(data.error || "Could not search the hub.");
        return;
      }

      setAnswer(data.answer || "No answer was returned.");
      setSources(data.sources || []);
    } catch {
      setAnswer("Could not reach Ask the Hub.");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <Card className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-6">
        <SectionHeader
          icon={Search}
          title="Ask the Hub"
          subtitle="Search meetings, transcripts, alerts, reminders, emails, and tasks"
        />

        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitQuestion();
              }}
              placeholder="Example: What did we decide about generator repair?"
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <Button
              onClick={submitQuestion}
              disabled={isAsking}
              className="rounded-2xl"
            >
              {isAsking ? "Searching..." : "Ask"}
            </Button>
          </div>

          {answer && (
            <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-700">
              <p className="whitespace-pre-wrap">{answer}</p>
              {sources.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {sources.slice(0, 5).map((source) => (
                    <button
                      key={`${source.table}-${source.id}`}
                      onClick={() => onNavigate(source.view || "dashboard")}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-slate-400"
                    >
                      {source.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CommandHistoryCard() {
  const [logs, setLogs] = useState([]);
  const [historyMessage, setHistoryMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadLogs() {
      try {
        const data = await getCommandLogs();

        if (!isMounted) {
          return;
        }

        if (!data.ok) {
          setHistoryMessage(data.error || "Command history is not available.");
          return;
        }

        setLogs(data.logs || []);
      } catch {
        if (isMounted) {
          setHistoryMessage("Could not load command history.");
        }
      }
    }

    loadLogs();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-6">
        <SectionHeader
          icon={History}
          title="Command History"
          subtitle="Recent AI actions and audit trail"
        />

        {historyMessage && (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
            {historyMessage}
          </p>
        )}

        {!historyMessage && logs.length === 0 && (
          <EmptyState icon={History} title="No commands logged yet">
            Run a Jarvis command to build the audit trail.
          </EmptyState>
        )}

        {logs.length > 0 && (
          <div className="space-y-3">
            {logs.slice(0, 5).map((log) => (
              <div key={log.id} className="rounded-3xl border border-slate-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-950">
                    {log.summary || log.status || "Command completed"}
                  </p>
                  <StatusPill status={log.status || "Completed"} />
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-500">
                  {log.command}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RiskIntelligencePanel({
  meetings,
  alerts,
  operations,
  projects,
  reminders = [],
}) {
  const [tasks, setTasks] = useState([]);
  const [aiSummary, setAiSummary] = useState("");
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadTasks() {
      try {
        const data = await getTasks();

        if (isMounted && data.ok) {
          setTasks(data.tasks || []);
        }
      } catch {
        if (isMounted) {
          setTasks([]);
        }
      }
    }

    loadTasks();

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

  const overdueTasks = tasks.filter((task) => {
    const deadline = Date.parse(task.deadline || "");
    return (
      !Number.isNaN(deadline) &&
      deadline < nowMs &&
      isOpenDashboardStatus(task.status)
    );
  });
  const nowDate = nowMs ? new Date(nowMs) : null;
  const timedMeetings = nowDate
    ? meetings
        .map((meeting) => {
          const dueAt = parseSmartAlarmDueDate(
            meeting.due_at,
            meeting.time,
            meeting.briefing,
            meeting.title
          );
          const stage = getSmartAlarmStage(dueAt, nowDate);

          if (
            !dueAt ||
            !isTimedRiskStage(stage) ||
            !isOpenDashboardStatus(meeting.status)
          ) {
            return null;
          }

          return {
            title: meeting.title || "Meeting",
            detail:
              stage === "overdue"
                ? `Meeting time passed at ${formatRiskDueTime(dueAt)}`
                : `Meeting starts ${formatRiskDueTime(dueAt)}`,
            severity: stageSeverity(stage),
          };
        })
        .filter(Boolean)
    : [];
  const timedReminders = nowDate
    ? reminders
        .map((reminder) => {
          const dueAt = parseSmartAlarmDueDate(
            reminder.due_at,
            reminder.reminder_time,
            reminder.notes,
            reminder.title
          );
          const stage = getSmartAlarmStage(dueAt, nowDate);

          if (
            !dueAt ||
            !isTimedRiskStage(stage) ||
            !isOpenDashboardStatus(reminder.status)
          ) {
            return null;
          }

          return {
            title: reminder.title || "Reminder",
            detail:
              stage === "overdue"
                ? `Reminder time passed at ${formatRiskDueTime(dueAt)}`
                : `Reminder is due ${formatRiskDueTime(dueAt)}`,
            severity: stageSeverity(stage),
          };
        })
        .filter(Boolean)
    : [];
  const highRiskOperations = operations.filter(
    (operation) =>
      operation.severity === "High" &&
      !["resolved", "closed"].includes(String(operation.status || "").toLowerCase())
  );
  const highRiskAlerts = alerts.filter(
    (alert) =>
      alert.severity === "High" &&
      !["resolved", "closed", "rejected"].includes(
        String(alert.status || "").toLowerCase()
      )
  );
  const budgetSpikes = operations.filter((operation) =>
    /\b(budget|cost|spend|invoice|payment|rate|increase|spike)\b/i.test(
      `${operation.title || ""} ${operation.detail || ""}`
    )
  );
  const unresolvedRepairs = operations.filter((operation) =>
    /\b(repair|generator|maintenance|fault|broken)\b/i.test(
      `${operation.title || ""} ${operation.detail || ""}`
    )
  );
  const unpreparedMeetings = meetings.filter(
    (meeting) => !meeting.briefing && !meeting.minutes
  );
  const blockedProjects = projects.filter((project) => project.blocker);
  const risks = [
    ...timedReminders,
    ...timedMeetings,
    ...overdueTasks.map((task) => ({
      title: task.title,
      detail: task.deadline,
      severity: "High",
    })),
    ...highRiskOperations.map((operation) => ({
      title: operation.title,
      detail: operation.detail,
      severity: "High",
    })),
    ...highRiskAlerts.map((alert) => ({
      title: alert.title,
      detail: alert.detail,
      severity: "High",
    })),
    ...budgetSpikes.map((operation) => ({
      title: operation.title,
      detail: "Budget or cost signal",
      severity: "Medium",
    })),
    ...unresolvedRepairs.map((operation) => ({
      title: operation.title,
      detail: "Repair remains open",
      severity: operation.severity || "Medium",
    })),
    ...unpreparedMeetings.map((meeting) => ({
      title: meeting.title,
      detail: "Meeting needs preparation",
      severity: "Medium",
    })),
    ...blockedProjects.map((project) => ({
      title: project.name,
      detail: project.blocker,
      severity: "Medium",
    })),
  ].slice(0, 6);

  async function summarizeRisks() {
    setIsLoadingSummary(true);
    setAiSummary("Reviewing live risk signals...");

    try {
      const data = await askHub(
        "Summarize the current operational risks, overdue work, budget spikes, unresolved repairs, and meetings without preparation."
      );
      setAiSummary(data.answer || data.error || "No AI risk summary returned.");
    } catch {
      setAiSummary("Could not reach Ask the Hub.");
    } finally {
      setIsLoadingSummary(false);
    }
  }

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-6">
        <SectionHeader
          icon={AlertTriangle}
          title="Risk Intelligence"
          subtitle="Overdue work, high-risk ops, budget spikes, repairs, and prep gaps"
          action={
            <Button
              onClick={summarizeRisks}
              disabled={isLoadingSummary}
              variant="outline"
              className="rounded-2xl"
            >
              AI Review
            </Button>
          }
        />

        {risks.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No risk signals">
            Live records do not show urgent operational risks right now.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {risks.map((risk, index) => (
              <div key={`${risk.title}-${index}`} className="rounded-3xl border border-slate-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-black text-slate-950">{risk.title}</h3>
                  <StatusPill status={risk.severity} />
                </div>
                {risk.detail && (
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {risk.detail}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {aiSummary && (
          <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {aiSummary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardView({
  meetings,
  alerts,
  reminders = [],
  projects,
  activities,
  operations,
  canManageOperations = false,
  setMeetings,
  setAlerts,
  setReminders,
  setOperations,
  onStartTranscribing,
  onNavigate,
}) {
  const [briefing, setBriefing] = useState(
    "No executive briefing has been generated yet. Add live records, then refresh this briefing."
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  async function refreshBriefing() {
    setIsRefreshing(true);
    setBriefing("AI is generating the daily briefing from backend records...");

    try {
      const data = await generateDailyBriefing();

      if (!data.ok) {
        setBriefing(data.error || "Could not generate the daily briefing.");
        return;
      }

      setBriefing(data.briefing || "No daily briefing was returned.");
    } catch {
      setBriefing(
        "Could not connect to AI. Check the backend server and API keys."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  function readBriefingAloud() {
    if (!window.speechSynthesis || !briefing) {
      return;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(briefing));
  }

  const visibleAlerts = dedupeRecords(
    alerts,
    getAlertGroupKey
  );
  const visibleReminders = dedupeRecords(
    reminders,
    (reminder) =>
      `${reminder.title || ""}|${reminder.reminder_time || ""}|${reminder.status || ""}`.toLowerCase()
  );
  const highAlerts = visibleAlerts.filter(
    (alert) => alert.severity === "High"
  ).length;
  const pendingReminders = visibleReminders.filter(
    (reminder) => reminder.status !== "Completed"
  ).length;
  const openOperations = operations.filter(
    (operation) => operation.status !== "Resolved"
  ).length;

  async function removeAlertGroup(alert) {
    if (!canManageOperations) {
      setAlertMessage("Only Admin and Super Admin users can remove alerts.");
      return;
    }

    const groupKey = getAlertGroupKey(alert);
    const matchingAlerts = alerts.filter(
      (alertItem) => getAlertGroupKey(alertItem) === groupKey
    );

    if (!matchingAlerts.length) {
      return;
    }

    try {
      setAlertMessage("Removing alert...");

      const results = await Promise.all(
        matchingAlerts.map((alertItem) => deleteAlert(alertItem.id))
      );
      const failed = results.find((result) => !result.ok);

      if (failed) {
        setAlertMessage(failed.error || "Could not remove alert.");
        return;
      }

      setAlerts((previous) =>
        previous.filter((alertItem) => getAlertGroupKey(alertItem) !== groupKey)
      );
      setAlertMessage("Alert removed.");
    } catch {
      setAlertMessage("Could not reach the alerts API.");
    }
  }

  async function removeReminder(reminder) {
    try {
      setAlertMessage("Removing reminder...");

      const data = await deleteAlarm(reminder.id);

      if (!data.ok) {
        setAlertMessage(data.error || "Could not remove reminder.");
        return;
      }

      setReminders?.((previous) =>
        previous.filter((item) => item.id !== reminder.id)
      );
      cancelDeviceReminder(reminder).catch((error) => {
        console.warn("Could not cancel device reminder:", error);
      });
      setAlertMessage("Reminder removed.");
    } catch {
      setAlertMessage("Could not reach the reminders API.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="xl:col-span-8">
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-5">
          <SummaryCard
            icon={CalendarDays}
            label="Meetings"
            value={meetings.length}
            note="Live saved records"
          />
          <SummaryCard
            icon={Clock3}
            label="Reminders"
            value={pendingReminders}
            note="Pending alarms"
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Critical Alerts"
            value={highAlerts}
            note="Open high-priority items"
          />
          <SummaryCard
            icon={BarChart3}
            label="Projects"
            value={projects.length}
            note="Live project records"
          />
          <SummaryCard
            icon={Building2}
            label="Operations"
            value={openOperations}
            note="Open operation records"
          />
        </div>

        <Card className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={Brain}
              title="Executive AI Briefing"
              subtitle="Prepared from live records only"
              action={
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={refreshBriefing}
                    className="rounded-2xl"
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? "Generating..." : "Generate Daily Briefing"}
                  </Button>
                  <Button
                    onClick={readBriefingAloud}
                    variant="outline"
                    className="rounded-2xl"
                  >
                    Read Aloud
                  </Button>
                </div>
              }
            />

            <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white">
              <div className="relative flex items-start gap-4">
                <div className="rounded-2xl bg-white/10 p-3">
                  <Sparkles className="h-6 w-6" />
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black">
                      Your next attention areas
                    </h3>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
                      Live executive summary
                    </span>
                  </div>

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                    {briefing}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                      onClick={() => onNavigate("operations")}
                      className="rounded-2xl"
                    >
                      <ClipboardList className="mr-2 h-4 w-4" />
                      View Action Queue
                    </Button>
                    <Button
                      onClick={() => onNavigate("emails")}
                      variant="darkOutline"
                      className="rounded-2xl"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Draft Follow-ups
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <QuickAICommand
          setMeetings={setMeetings}
          setAlerts={setAlerts}
          setReminders={setReminders}
          setOperations={setOperations}
          onNavigate={onNavigate}
          onStartTranscribing={onStartTranscribing}
        />

        <AskHubCard onNavigate={onNavigate} />

        <Card className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={CalendarDays}
              title="Meetings"
              subtitle="Saved live meetings and generated minutes"
              action={
                <Button
                  onClick={() => onNavigate("meetings")}
                  variant="outline"
                  className="rounded-2xl"
                >
                  Open Meetings
                </Button>
              }
            />

            {meetings.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No meetings saved">
                Add a real meeting on the Meetings page to test briefings,
                attendees, and minutes generation.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                {meetings.slice(0, 3).map((meeting) => (
                  <motion.div
                    key={meeting.id}
                    whileHover={{ scale: 1.01 }}
                    className="rounded-3xl border border-slate-100 p-5 transition hover:bg-slate-50"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-slate-950">
                            {meeting.title}
                          </h3>
                          {meeting.risk && (
                            <StatusPill
                              status={
                                meeting.risk.toLowerCase().includes("urgent")
                                  ? "High"
                                  : "Medium"
                              }
                            />
                          )}
                        </div>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {meeting.briefing || "No briefing saved yet."}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          {meeting.time && (
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                              {meeting.time}
                            </span>
                          )}
                          {meeting.duration && (
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                              {meeting.duration}
                            </span>
                          )}
                          {meeting.location && (
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                              {meeting.location}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        onClick={() => onNavigate("meetings")}
                        variant="outline"
                        className="rounded-2xl"
                      >
                        Open Briefing
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 xl:col-span-4">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={ShieldCheck}
              title="Control Status"
              subtitle="Live testing readiness"
            />

            <div className="grid gap-3">
              <div className="rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-800">
                <strong>Backend API:</strong> Supabase-backed auth enabled
              </div>
              <div className="rounded-3xl bg-blue-50 p-4 text-sm text-blue-800">
                <strong>Gmail:</strong> Connect from the Emails page
              </div>
              <div className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-800">
                <strong>AI:</strong> Uses only records available in the app
              </div>
            </div>
          </CardContent>
        </Card>

        <RiskIntelligencePanel
          meetings={meetings}
          alerts={alerts}
          operations={operations}
          projects={projects}
          reminders={visibleReminders}
        />

        {canManageOperations && <CommandHistoryCard />}

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={AlertTriangle}
              title="Smart Alerts"
              subtitle="Open live signals"
              action={
                canManageOperations ? (
                <Button
                  onClick={() => onNavigate("operations")}
                  variant="outline"
                  className="rounded-2xl"
                >
                  Manage
                </Button>
                ) : null
              }
            />
            {alertMessage && (
              <p className="mb-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                {alertMessage}
              </p>
            )}

            {visibleAlerts.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="No alerts yet">
                Add an alert from the Operations page to test the live alert
                queue.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                {visibleAlerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex gap-3 rounded-3xl border border-slate-100 p-4"
                  >
                    <div className="h-fit rounded-2xl bg-slate-100 p-2">
                      <AlertTriangle className="h-5 w-5 text-slate-700" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black text-slate-950">
                          {alert.title}
                        </h3>
                        <StatusPill status={alert.severity} />
                      </div>
                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        {cleanDisplayText(alert.detail) || "No detail saved."}
                      </p>
                      {canManageOperations && (
                        <button
                          onClick={() => removeAlertGroup(alert)}
                          className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-black text-red-600 transition hover:border-red-100 hover:bg-red-50"
                          title="Delete alert"
                          aria-label={`Delete ${alert.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={Clock3}
              title="Reminders"
              subtitle="Timed alerts from Jarvis commands"
            />

            {visibleReminders.length === 0 ? (
              <EmptyState icon={Clock3} title="No reminders yet">
                Ask Jarvis to remind you before a meeting or set an alarm for a
                task.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                {visibleReminders.slice(0, 4).map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex gap-3 rounded-3xl border border-slate-100 p-4"
                  >
                    <div className="h-fit rounded-2xl bg-slate-100 p-2">
                      <Clock3 className="h-5 w-5 text-slate-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black text-slate-950">
                          {reminder.title || "Reminder"}
                        </h3>
                        <StatusPill status={reminder.status || "Pending"} />
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-600">
                        {reminder.reminder_time || "No time saved"}
                      </p>
                      {reminder.notes && (
                        <p className="mt-1 text-sm leading-5 text-slate-500">
                          {cleanDisplayText(reminder.notes)}
                        </p>
                      )}
                      <button
                        onClick={() => removeReminder(reminder)}
                        className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-black text-red-600 transition hover:border-red-100 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={Church}
              title="Church Activities"
              subtitle="Saved live activity records"
              action={
                <Button
                  onClick={() => onNavigate("operations")}
                  variant="outline"
                  className="rounded-2xl"
                >
                  Add
                </Button>
              }
            />

            {activities.length === 0 ? (
              <EmptyState icon={Church} title="No activities saved">
                Add activities from the Operations page to make this dashboard
                section live.
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 4).map((activity) => (
                  <div key={activity.id} className="rounded-3xl bg-slate-50 p-4">
                    <h3 className="font-black text-slate-950">
                      {activity.title}
                    </h3>
                    {activity.time && (
                      <p className="mt-1 text-sm text-slate-500">
                        {activity.time}
                      </p>
                    )}
                    {activity.location && (
                      <p className="text-sm text-slate-500">
                        {activity.location}
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
