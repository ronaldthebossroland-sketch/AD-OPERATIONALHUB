import { useCallback, useEffect, useState } from "react";
import { Mail } from "lucide-react";

import {
  askAI,
  getGmailEmails,
  getGmailStatus,
  GOOGLE_AUTH_URL,
} from "../../services/api";
import SectionHeader from "../shared/SectionHeader";
import StatusPill from "../shared/StatusPill";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export default function EmailsView({ inboxItems, setInboxItems }) {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailError, setGmailError] = useState("");
  const [loadingEmails, setLoadingEmails] = useState(false);

  const fetchGmailEmails = useCallback(async () => {
    try {
      setLoadingEmails(true);
      setGmailError("");

      const data = await getGmailEmails();

      if (!data.ok) {
        setInboxItems([]);
        setGmailError(
          data.error ||
            "Gmail is connected, but the inbox could not be loaded. Try reconnecting Gmail."
        );

        if (data.status === 401 || data.status === 403) {
          setGmailConnected(false);
        }

        return;
      }

      const formattedEmails = (data.emails || []).map((email, index) => ({
        id: email.id || index,
        from: email.from,
        subject: email.subject || "No subject",
        urgency: "Medium",
        summary: email.snippet || "No preview available.",
        draft: "",
      }));

      setInboxItems(formattedEmails);
      setGmailConnected(true);
    } catch {
      setInboxItems([]);
      setGmailError("Could not reach the Gmail backend.");
    } finally {
      setLoadingEmails(false);
    }
  }, [setInboxItems]);

  async function generateEmailDraft(id, subject, summary) {
    setInboxItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, draft: "Generating AI draft..." } : item
      )
    );

    try {
      const reply = await askAI(`
Draft a respectful, concise, executive ministry-style email response.

Subject: ${subject}
Context: ${summary}
      `);

      setInboxItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, draft: reply } : item))
      );
    } catch {
      setInboxItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                draft:
                  "Could not generate draft. Check AI server or OpenAI billing.",
              }
            : item
        )
      );
    }
  }

  useEffect(() => {
    async function checkGmailStatus() {
      try {
        const data = await getGmailStatus();
        const isConnected = Boolean(data.ok && data.connected);
        setGmailConnected(isConnected);

        if (isConnected) {
          fetchGmailEmails();
        } else {
          setInboxItems([]);
        }
      } catch {
        setInboxItems([]);
        setGmailConnected(false);
        setGmailError("Could not check Gmail connection status.");
      }
    }

    checkGmailStatus();
  }, [fetchGmailEmails, setInboxItems]);

  const statusText = loadingEmails
    ? "Loading real Gmail messages..."
    : gmailError
      ? "Gmail connection needs attention"
      : gmailConnected
        ? "Gmail connected - live inbox loaded"
        : "Connect Gmail to load real emails";

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-6">
        <SectionHeader
          icon={Mail}
          title="Priority Email Queue"
          subtitle={statusText}
          action={
            <div className="flex flex-wrap gap-2">
              {!gmailConnected || gmailError ? (
                <Button
                  onClick={() => (window.location.href = GOOGLE_AUTH_URL)}
                  variant="outline"
                  className="rounded-2xl"
                >
                  {gmailConnected ? "Reconnect Gmail" : "Connect Gmail"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="rounded-2xl bg-emerald-50 text-emerald-700"
                >
                  Gmail Connected
                </Button>
              )}

              <Button
                onClick={fetchGmailEmails}
                disabled={!gmailConnected || loadingEmails}
                className="rounded-2xl"
              >
                {loadingEmails ? "Loading..." : "Reload Gmail"}
              </Button>
            </div>
          }
        />

        {gmailError && (
          <div className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            {gmailError}
          </div>
        )}

        <div className="space-y-4">
          {inboxItems.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <Mail className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-3 font-black text-slate-950">
                No Gmail messages loaded
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {gmailConnected
                  ? "Reload Gmail or reconnect your account to pull live inbox messages."
                  : "Connect Gmail to replace this empty queue with real emails."}
              </p>
            </div>
          )}

          {inboxItems.map((email) => (
            <div
              key={email.id}
              className="rounded-3xl border border-slate-100 p-5"
            >
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-slate-950">
                      {email.subject}
                    </h3>
                    <StatusPill status={email.urgency} />
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    From: {email.from}
                  </p>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {email.summary}
                  </p>
                </div>

                <Button
                  onClick={() =>
                    generateEmailDraft(email.id, email.subject, email.summary)
                  }
                  className="rounded-2xl"
                >
                  Draft Reply
                </Button>
              </div>

              {email.draft && (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  <strong>AI Draft:</strong>
                  <br />
                  {email.draft}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
