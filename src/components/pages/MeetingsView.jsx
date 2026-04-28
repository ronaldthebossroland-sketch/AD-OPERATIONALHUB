import { FileText, Mic, Plus } from "lucide-react";

import StatusPill from "../shared/StatusPill";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export default function MeetingsView({ meetings, setMeetings }) {
  function generateMeeting() {
    const newMeeting = {
      id: Date.now(),
      title: "AI Generated Executive Alignment Meeting",
      time: "4:00 PM",
      duration: "30 mins",
      location: "Executive Room",
      briefing:
        "AI generated this meeting to align on urgent finance, partner follow-up, and operations priorities.",
      risk: "AI-generated priority",
      attendees: ["Executive Assistant", "Operations Lead"],
    };

    setMeetings((prev) => [newMeeting, ...prev]);
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <Button onClick={generateMeeting} className="rounded-2xl">
          <Plus className="mr-2 h-4 w-4" />
          Auto Generate Meeting
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {meetings.map((meeting) => (
          <Card
            key={meeting.id}
            className="rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="rounded-2xl bg-slate-100 p-3">
                  <Mic className="h-5 w-5 text-slate-700" />
                </div>
                <StatusPill status="Briefing Ready" />
              </div>

              <h3 className="mt-5 text-lg font-black text-slate-950">
                {meeting.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {meeting.briefing}
              </p>

              <div className="mt-5 space-y-2 text-sm text-slate-500">
                <p>
                  <strong className="text-slate-700">Time:</strong>{" "}
                  {meeting.time}
                </p>
                <p>
                  <strong className="text-slate-700">Location:</strong>{" "}
                  {meeting.location}
                </p>
                <p>
                  <strong className="text-slate-700">Risk:</strong>{" "}
                  {meeting.risk}
                </p>
              </div>

              <Button className="mt-6 w-full rounded-2xl">
                <FileText className="mr-2 h-4 w-4" />
                Generate Minutes
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
