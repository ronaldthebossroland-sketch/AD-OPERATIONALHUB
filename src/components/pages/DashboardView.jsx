import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CalendarDays,
  Church,
  ClipboardList,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { churchActivities, projects } from "../../data/mockData";
import { askAI } from "../../services/api";
import SectionHeader from "../shared/SectionHeader";
import StatusPill from "../shared/StatusPill";
import SummaryCard from "../shared/SummaryCard";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

function QuickAICommand({
  meetings,
  alerts,
  inboxItems,
  setMeetings,
  setAlerts,
  setInboxItems,
}) {
  const [command, setCommand] = useState("");
  const [response, setResponse] = useState(
    "Ask me to summarize meetings, generate alerts, create a meeting, draft an email, or prepare an executive report."
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  function addGeneratedMeeting() {
    const newMeeting = {
      id: Date.now(),
      title: "AI Generated Strategy Meeting",
      time: "2:00 PM",
      duration: "30 mins",
      location: "Executive Room",
      briefing:
        "AI generated this meeting to review urgent executive priorities, follow-ups, and operational risks.",
      risk: "AI-generated priority",
      attendees: [
        "Executive Assistant",
        "Operations Lead",
        "Relevant Department Lead",
      ],
    };

    setMeetings((prev) => [newMeeting, ...prev]);
    setResponse(
      "\u2705 Meeting generated and added to the dashboard: AI Generated Strategy Meeting at 2:00 PM."
    );
  }

  function addSmartAlert() {
    const newAlert = {
      id: Date.now(),
      type: "AI Alert",
      title: "AI detected urgent follow-up risk",
      detail:
        "Partnership and finance tasks may affect today's schedule if not handled early.",
      severity: "High",
      icon: Brain,
    };

    setAlerts((prev) => [newAlert, ...prev]);
    setResponse(
      "\u26A0\uFE0F Smart alert generated and added: urgent follow-up risk detected."
    );
  }

  async function draftEmail() {
    setIsLoading(true);
    setResponse("Drafting email with real AI...");

    try {
      const reply = await askAI(`
Draft a concise, respectful, ministry-appropriate executive follow-up email
for Partnership Managers reminding them to complete pending partner follow-ups
and report completion before close of work.
      `);

      setInboxItems((prev) =>
        prev.map((item, index) => (index === 0 ? { ...item, draft: reply } : item))
      );

      setResponse(reply);
    } catch {
      setResponse("Could not connect to AI. Check OpenAI billing/server.");
    } finally {
      setIsLoading(false);
    }
  }

  async function runCommand(customCommand) {
    const finalCommand = customCommand || command;

    if (!finalCommand.trim()) {
      setResponse("Please type or say a command first.");
      return;
    }

    const lower = finalCommand.toLowerCase();

    if (lower.includes("create") && lower.includes("meeting")) {
      addGeneratedMeeting();
      setCommand("");
      return;
    }

    if (lower.includes("generate") && lower.includes("alert")) {
      addSmartAlert();
      setCommand("");
      return;
    }

    if (lower.includes("draft") && lower.includes("email")) {
      await draftEmail();
      setCommand("");
      return;
    }

    setIsLoading(true);
    setResponse("Thinking with real AI...");

    try {
      const reply = await askAI(`
You are operating inside the Esteemed AD Operational Hub.

Current data:
Meetings: ${JSON.stringify(meetings)}
Alerts: ${JSON.stringify(alerts)}
Priority emails: ${JSON.stringify(inboxItems)}

User request:
${finalCommand}

Respond clearly, professionally, and concisely. Use an executive ministry-appropriate tone.
      `);

      setResponse(reply);
      setCommand("");
    } catch {
      setResponse(
        "Could not connect to AI. If you see insufficient quota, add billing credit to OpenAI."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function startVoiceCommand() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setResponse(
        "Voice command is not supported in this browser. Please use Google Chrome."
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsListening(true);
    setResponse("Listening... Speak your command.");

    recognition.start();

    recognition.onresult = (event) => {
      const voiceText = event.results[0][0].transcript;
      setCommand(voiceText);
      runCommand(voiceText);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setResponse("Voice command failed. Please try again.");
    };

    recognition.onend = () => setIsListening(false);
  }

  const quickActions = [
    "Summarize today's meetings",
    "Generate smart alerts",
    "Create a strategy meeting",
    "Draft follow-up email",
    "Summarize executive report",
  ];

  return (
    <Card className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-6">
        <SectionHeader
          icon={Brain}
          title="Quick AI Command"
          subtitle="Real AI assistant for summaries, meetings, alerts, emails, voice commands, and reports"
        />

        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runCommand();
              }}
              placeholder="Example: Prepare executive briefing for today's meetings"
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />

            <Button
              onClick={() => runCommand()}
              disabled={isLoading}
              className="rounded-2xl"
            >
              {isLoading ? "Thinking..." : "Run AI"}
            </Button>

            <Button
              onClick={startVoiceCommand}
              variant="outline"
              className="rounded-2xl bg-white"
            >
              {isListening ? "Listening..." : "\uD83C\uDFA4 Voice"}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => runCommand(action)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-950 hover:text-white"
              >
                {action}
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-[100px] rounded-2xl border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-700">
            {response}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardView({
  meetings,
  alerts,
  inboxItems,
  setMeetings,
  setAlerts,
  setInboxItems,
}) {
  const [briefing, setBriefing] = useState(
    "Finance requires approval on revised logistics spending. Partnership has three overdue follow-ups before the next check-in. Property team has flagged the generator room repair as urgent. Today's meetings are manageable, but the 12 PM partnership check-in needs a prepared follow-up list."
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refreshBriefing() {
    setIsRefreshing(true);
    setBriefing("Real AI is refreshing the executive briefing...");

    try {
      const reply = await askAI(`
Prepare a concise executive briefing based on this operational data:
Meetings: ${JSON.stringify(meetings)}
Alerts: ${JSON.stringify(alerts)}
Emails: ${JSON.stringify(inboxItems)}

Tone: respectful, clear, executive, ministry-appropriate.
      `);

      setBriefing(reply);
    } catch {
      setBriefing(
        "Could not connect to AI. If you see insufficient quota, add billing credit to OpenAI."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  const highAlerts = alerts.filter((alert) => alert.severity === "High").length;

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="xl:col-span-8">
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-4">
          <SummaryCard
            icon={CalendarDays}
            label="Meetings Today"
            value={meetings.length}
            note="Live dashboard data"
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Critical Alerts"
            value={highAlerts}
            note="AI + operations flagged"
          />
          <SummaryCard
            icon={BarChart3}
            label="Projects"
            value={projects.length}
            note="Milestone tracking active"
          />
          <SummaryCard
            icon={Mail}
            label="Priority Emails"
            value={inboxItems.length}
            note="AI filtered response queue"
          />
        </div>

        <Card className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={Brain}
              title="Executive AI Briefing"
              subtitle="Real AI-prepared intelligence for the next few hours"
              action={
                <Button
                  onClick={refreshBriefing}
                  className="rounded-2xl"
                  disabled={isRefreshing}
                >
                  {isRefreshing ? "Refreshing..." : "Refresh Briefing"}
                </Button>
              }
            />

            <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl" />

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
                    <Button className="rounded-2xl bg-white text-slate-950 hover:bg-slate-100">
                      <ClipboardList className="mr-2 h-4 w-4" />
                      View Action Queue
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl border-white/20 bg-transparent text-white hover:bg-white/10"
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
          meetings={meetings}
          alerts={alerts}
          inboxItems={inboxItems}
          setMeetings={setMeetings}
          setAlerts={setAlerts}
          setInboxItems={setInboxItems}
        />

        <Card className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={CalendarDays}
              title="Today's Meetings"
              subtitle="Context-aware agenda and briefing view"
            />

            <div className="space-y-4">
              {meetings.map((meeting) => (
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
                        <StatusPill
                          status={
                            meeting.risk.includes("overdue") ||
                            meeting.risk.includes("Urgent") ||
                            meeting.risk.includes("Budget")
                              ? "High"
                              : "Medium"
                          }
                        />
                      </div>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {meeting.briefing}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {meeting.time}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {meeting.duration}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {meeting.location}
                        </span>
                      </div>
                    </div>

                    <Button variant="outline" className="rounded-2xl">
                      Open Briefing
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 xl:col-span-4">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={ShieldCheck}
              title="AI Control Status"
              subtitle="System readiness"
            />

            <div className="grid gap-3">
              <div className="rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-800">
                <strong>Real AI:</strong> Connected through backend server
              </div>
              <div className="rounded-3xl bg-blue-50 p-4 text-sm text-blue-800">
                <strong>Voice Command:</strong> Available in Chrome
              </div>
              <div className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-800">
                <strong>Live Dashboard:</strong> Meetings and alerts update
                instantly
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={AlertTriangle}
              title="Smart Alerts"
              subtitle="AI and operations signals"
            />

            <div className="space-y-4">
              {alerts.map((alert) => {
                const Icon = alert.icon || AlertTriangle;
                return (
                  <div
                    key={alert.id}
                    className="flex gap-3 rounded-3xl border border-slate-100 p-4"
                  >
                    <div className="h-fit rounded-2xl bg-slate-100 p-2">
                      <Icon className="h-5 w-5 text-slate-700" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-950">
                          {alert.title}
                        </h3>
                        <StatusPill status={alert.severity} />
                      </div>
                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        {alert.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={Church}
              title="Church Activities"
              subtitle="This week"
            />

            <div className="space-y-3">
              {churchActivities.map((activity) => (
                <div key={activity.id} className="rounded-3xl bg-slate-50 p-4">
                  <h3 className="font-black text-slate-950">
                    {activity.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {activity.time}
                  </p>
                  <p className="text-sm text-slate-500">{activity.location}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
