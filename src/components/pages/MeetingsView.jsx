import { useState } from "react";
import { CalendarDays, FileText, Mic, Plus, Trash2 } from "lucide-react";

import {
  askAI,
  createMeeting,
  deleteMeeting,
  runAICommand,
  updateMeeting,
} from "../../services/api";
import SectionHeader from "../shared/SectionHeader";
import StatusPill from "../shared/StatusPill";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

const emptyMeeting = {
  title: "",
  time: "",
  duration: "",
  location: "",
  briefing: "",
  risk: "",
  attendees: "",
};

export default function MeetingsView({ meetings, setMeetings, setReminders }) {
  const [form, setForm] = useState(emptyMeeting);
  const [sourceText, setSourceText] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingFromText, setCreatingFromText] = useState(false);
  const [minutesLoadingId, setMinutesLoadingId] = useState(null);

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveMeeting() {
    if (!form.title.trim()) {
      setMessage("Add a meeting title before saving.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const data = await createMeeting(form);

      if (!data.ok) {
        setMessage(data.error || "Could not save meeting.");
        return;
      }

      setMeetings((prev) => [data.meeting, ...prev]);
      setForm(emptyMeeting);
      setMessage("Meeting saved to live records.");
    } catch {
      setMessage("Could not reach the meetings API.");
    } finally {
      setSaving(false);
    }
  }

  async function generateMinutes(meeting) {
    try {
      setMinutesLoadingId(meeting.id);

      const reply = await askAI(`
Generate concise meeting minutes from this live meeting record.
Do not invent decisions or attendees.

Meeting:
${JSON.stringify(meeting)}
      `);

      const data = await updateMeeting(meeting.id, { minutes: reply });

      if (!data.ok) {
        setMessage(data.error || "AI generated minutes, but saving failed.");
        return;
      }

      setMeetings((prev) =>
        prev.map((item) => (item.id === meeting.id ? data.meeting : item))
      );
    } catch {
      setMessage("Could not generate minutes. Check AI/backend connection.");
    } finally {
      setMinutesLoadingId(null);
    }
  }

  async function createMeetingFromText() {
    if (!sourceText.trim()) {
      setMessage("Paste the message, email, or KingsChat text first.");
      return;
    }

    try {
      setCreatingFromText(true);
      setMessage("AI is extracting the meeting details...");

      const data = await runAICommand(
        `Create a meeting from this text. If it includes a reminder or alarm, create that too: ${sourceText}`
      );

      if (!data.ok) {
        setMessage(data.summary || data.error || "Could not create from text.");
        return;
      }

      const createdMeetings = (data.actions || [])
        .map((action) => action.data?.meeting)
        .filter(Boolean);
      const createdAlarms = (data.actions || [])
        .map((action) => action.data?.alarm)
        .filter(Boolean);

      if (createdMeetings.length > 0) {
        setMeetings((prev) => [...createdMeetings, ...prev]);
      }

      if (createdAlarms.length > 0) {
        setReminders?.((prev) => [...createdAlarms, ...prev]);
      }

      setSourceText("");
      setMessage(data.summary || "Meeting created from pasted text.");
    } catch {
      setMessage("Could not reach the command engine.");
    } finally {
      setCreatingFromText(false);
    }
  }

  async function removeMeeting(id) {
    try {
      const data = await deleteMeeting(id);

      if (!data.ok) {
        setMessage(data.error || "Could not delete meeting.");
        return;
      }

      setMeetings((prev) => prev.filter((meeting) => meeting.id !== id));
      setMessage("Meeting removed.");
    } catch {
      setMessage("Could not reach the meetings API.");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <SectionHeader
            icon={CalendarDays}
            title="Add Meeting"
            subtitle="Create live meeting records for testing briefings and minutes"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              placeholder="Meeting title"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400 md:col-span-2"
            />
            <input
              value={form.time}
              onChange={(event) => updateForm("time", event.target.value)}
              placeholder="Time"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <input
              value={form.duration}
              onChange={(event) => updateForm("duration", event.target.value)}
              placeholder="Duration"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <input
              value={form.location}
              onChange={(event) => updateForm("location", event.target.value)}
              placeholder="Location"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <input
              value={form.attendees}
              onChange={(event) => updateForm("attendees", event.target.value)}
              placeholder="Attendees, separated by commas"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <textarea
              value={form.briefing}
              onChange={(event) => updateForm("briefing", event.target.value)}
              placeholder="Briefing notes"
              className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400 md:col-span-2"
            />
            <input
              value={form.risk}
              onChange={(event) => updateForm("risk", event.target.value)}
              placeholder="Risk or follow-up"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400 md:col-span-2"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={saveMeeting} disabled={saving} className="rounded-2xl">
              <Plus className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Meeting"}
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
            icon={FileText}
            title="Create Meeting From Text"
            subtitle="Paste an email, KingsChat message, or note and let AI extract the record"
          />

          <textarea
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="Paste message text here..."
            className="min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
          />
          <Button
            onClick={createMeetingFromText}
            disabled={creatingFromText}
            className="mt-4 rounded-2xl"
          >
            <Plus className="mr-2 h-4 w-4" />
            {creatingFromText ? "Creating..." : "Create From Text"}
          </Button>
        </CardContent>
      </Card>

      {meetings.length === 0 ? (
        <Card className="rounded-3xl border border-dashed border-slate-200 bg-white shadow-sm">
          <CardContent className="p-8 text-center">
            <Mic className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 font-black text-slate-950">
              No meetings saved yet
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Add your first real meeting above. It will appear on the dashboard
              and can be used by the AI briefing flow.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {meetings.map((meeting) => (
            <Card
              key={meeting.id}
              className="rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-2xl bg-slate-100 p-3">
                    <Mic className="h-5 w-5 text-slate-700" />
                  </div>
                  <StatusPill status={meeting.minutes ? "Ready" : "Pending"} />
                </div>

                <h3 className="mt-5 text-lg font-black text-slate-950">
                  {meeting.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {meeting.briefing || "No briefing saved."}
                </p>

                <div className="mt-5 space-y-2 text-sm text-slate-500">
                  {meeting.time && (
                    <p>
                      <strong className="text-slate-700">Time:</strong>{" "}
                      {meeting.time}
                    </p>
                  )}
                  {meeting.location && (
                    <p>
                      <strong className="text-slate-700">Location:</strong>{" "}
                      {meeting.location}
                    </p>
                  )}
                  {meeting.risk && (
                    <p>
                      <strong className="text-slate-700">Risk:</strong>{" "}
                      {meeting.risk}
                    </p>
                  )}
                  {meeting.attendees?.length > 0 && (
                    <p>
                      <strong className="text-slate-700">Attendees:</strong>{" "}
                      {meeting.attendees.join(", ")}
                    </p>
                  )}
                </div>

                {meeting.minutes && (
                  <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    <strong>Minutes:</strong>
                    <br />
                    {meeting.minutes}
                  </div>
                )}

                <div className="mt-6 grid gap-2">
                  <Button
                    onClick={() => generateMinutes(meeting)}
                    disabled={minutesLoadingId === meeting.id}
                    className="w-full rounded-2xl"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {minutesLoadingId === meeting.id
                      ? "Generating..."
                      : "Generate Minutes"}
                  </Button>
                  <Button
                    onClick={() => removeMeeting(meeting.id)}
                    variant="outline"
                    className="w-full rounded-2xl text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
