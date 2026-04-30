import { useCallback, useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";

import {
  askAI,
  createEmailDraft,
  getEmailDrafts,
  getGmailEmails,
  getGmailStatus,
  GOOGLE_AUTH_URL,
  sendGmailMessage,
} from "../../services/api";
import SectionHeader from "../shared/SectionHeader";
import StatusPill from "../shared/StatusPill";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

function categoryLabel(category) {
  return String(category || "needs_reply")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function replySubject(subject) {
  const cleanSubject = subject || "Draft reply";
  return cleanSubject.toLowerCase().startsWith("re:")
    ? cleanSubject
    : `Re: ${cleanSubject}`;
}

export default function EmailsView({ inboxItems, setInboxItems }) {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailError, setGmailError] = useState("");
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [sendStatusByDraft, setSendStatusByDraft] = useState({});

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
        category: email.category || "needs_reply",
        urgency: email.urgency || "Medium",
        summary: email.snippet || "No preview available.",
        date: email.date || "",
        draft: "",
        draftId: null,
        draftSubject: "",
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

  const loadSavedDrafts = useCallback(async () => {
    try {
      const data = await getEmailDrafts();

      if (data.ok) {
        setSavedDrafts(data.drafts || []);
      }
    } catch {
      setSavedDrafts([]);
    }
  }, []);

  function setEmailDraftState(id, updates) {
    setInboxItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }

  async function generateEmailDraft(email) {
    setEmailDraftState(email.id, {
      draft: "Generating AI draft...",
      draftError: "",
    });

    try {
      const subject = replySubject(email.subject);
      const reply = await askAI(`
Draft a respectful, concise, executive ministry-style email response.

Subject: ${email.subject}
From: ${email.from}
Category: ${categoryLabel(email.category)}
Context: ${email.summary}

Return only the email body. Do not send it.
      `);

      const saveResult = await createEmailDraft({
        title: subject,
        recipient: email.from,
        subject,
        body: reply,
        source_email_id: email.id,
        category: email.category,
      });

      if (!saveResult.ok) {
        setEmailDraftState(email.id, {
          draft: reply,
          draftSubject: subject,
          draftError: saveResult.error || "Draft generated but could not be saved.",
        });
        return;
      }

      setSavedDrafts((previous) => [saveResult.draft, ...previous]);
      setEmailDraftState(email.id, {
        draft: saveResult.draft.body,
        draftId: saveResult.draft.id,
        draftSubject: saveResult.draft.subject,
        draftError: "",
      });
    } catch {
      setEmailDraftState(email.id, {
        draft: "Could not generate draft. Check AI server or API key.",
        draftError: "Could not generate draft.",
      });
    }
  }

  async function sendDraft(draft) {
    const draftId = draft.id || draft.draftId;
    const recipient = draft.recipient || draft.from;
    const subject = draft.subject || draft.draftSubject || "Draft reply";
    const body = draft.body || draft.draft;

    if (!draftId || !recipient || !subject || !body) {
      setSendStatusByDraft((previous) => ({
        ...previous,
        [draftId || "unsaved"]: "Save the draft before sending.",
      }));
      return;
    }

    setSendStatusByDraft((previous) => ({
      ...previous,
      [draftId]: "Sending...",
    }));

    try {
      const data = await sendGmailMessage({
        draftId,
        recipient,
        subject,
        body,
      });

      if (!data.ok) {
        setSendStatusByDraft((previous) => ({
          ...previous,
          [draftId]: data.error || "Could not send Gmail message.",
        }));
        return;
      }

      setSendStatusByDraft((previous) => ({
        ...previous,
        [draftId]: "Sent.",
      }));
      setSavedDrafts((previous) =>
        previous.map((item) =>
          item.id === draftId ? { ...item, status: "Sent" } : item
        )
      );
      setInboxItems((previous) =>
        previous.map((item) =>
          item.draftId === draftId ? { ...item, draftStatus: "Sent" } : item
        )
      );
    } catch {
      setSendStatusByDraft((previous) => ({
        ...previous,
        [draftId]: "Could not reach Gmail send route.",
      }));
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
    Promise.resolve().then(() => loadSavedDrafts());
  }, [fetchGmailEmails, loadSavedDrafts, setInboxItems]);

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
                <div className="inline-flex items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                  Gmail Connected
                </div>
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
          {savedDrafts.length > 0 && (
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
              <h3 className="font-black text-slate-950">Saved Drafts</h3>
              <div className="mt-4 space-y-3">
                {savedDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="rounded-2xl border border-slate-100 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-black text-slate-950">
                          {draft.subject || draft.title}
                        </p>
                        {draft.recipient && (
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            To: {draft.recipient}
                          </p>
                        )}
                      </div>
                      <StatusPill status={draft.status || "Draft"} />
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {draft.body}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Button
                        onClick={() => sendDraft(draft)}
                        disabled={draft.status === "Sent"}
                        className="rounded-2xl"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send
                      </Button>
                      {sendStatusByDraft[draft.id] && (
                        <p className="text-sm font-bold text-slate-600">
                          {sendStatusByDraft[draft.id]}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                      {categoryLabel(email.category)}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    From: {email.from}
                  </p>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {email.summary}
                  </p>
                </div>

                <Button
                  onClick={() => generateEmailDraft(email)}
                  className="rounded-2xl"
                >
                  Draft Reply
                </Button>
              </div>

              {email.draft && (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  <strong>AI Draft:</strong>
                  <p className="mt-2 whitespace-pre-wrap">{email.draft}</p>
                  {email.draftError && (
                    <p className="mt-2 font-bold text-amber-700">
                      {email.draftError}
                    </p>
                  )}
                  {email.draftId && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Button
                        onClick={() =>
                          sendDraft({
                            draftId: email.draftId,
                            recipient: email.from,
                            subject: email.draftSubject,
                            body: email.draft,
                          })
                        }
                        disabled={email.draftStatus === "Sent"}
                        className="rounded-2xl"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send
                      </Button>
                      {sendStatusByDraft[email.draftId] && (
                        <p className="text-sm font-bold text-slate-600">
                          {sendStatusByDraft[email.draftId]}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
