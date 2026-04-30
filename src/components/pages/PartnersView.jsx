import { useEffect, useState } from "react";
import { MailPlus, Plus, Trash2, UserRoundCheck } from "lucide-react";

import {
  askAI,
  createPartner,
  createPartnerTimelineItem,
  deletePartner,
  deletePartnerTimelineItem,
  getPartnerTimeline,
  updatePartner,
} from "../../services/api";
import SectionHeader from "../shared/SectionHeader";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

const emptyPartner = {
  name: "",
  email: "",
  phone: "",
  lastContact: "",
  milestone: "",
  nextStep: "",
};

export default function PartnersView({ partners, setPartners }) {
  const [form, setForm] = useState(emptyPartner);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [draftingId, setDraftingId] = useState(null);
  const [timelineByPartner, setTimelineByPartner] = useState({});
  const [timelineDrafts, setTimelineDrafts] = useState({});

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  useEffect(() => {
    let isMounted = true;

    async function loadTimelines() {
      const results = await Promise.all(
        partners.map(async (partner) => {
          try {
            const data = await getPartnerTimeline(partner.id);
            return [partner.id, data.timeline || []];
          } catch {
            return [partner.id, []];
          }
        })
      );

      if (isMounted) {
        setTimelineByPartner(Object.fromEntries(results));
      }
    }

    loadTimelines();

    return () => {
      isMounted = false;
    };
  }, [partners]);

  async function savePartner() {
    if (!form.name.trim()) {
      setMessage("Add a partner name before saving.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const data = await createPartner(form);

      if (!data.ok) {
        setMessage(data.error || "Could not save partner.");
        return;
      }

      setPartners((prev) => [data.partner, ...prev]);
      setTimelineByPartner((prev) => ({ ...prev, [data.partner.id]: [] }));
      setForm(emptyPartner);
      setMessage("Partner saved to live records.");
    } catch {
      setMessage("Could not reach the partners API.");
    } finally {
      setSaving(false);
    }
  }

  async function draftFollowUp(partner) {
    try {
      setDraftingId(partner.id);

      const reply = await askAI(`
Draft a concise, respectful follow-up email for this live partner record.
Do not invent personal history or commitments.

Partner:
${JSON.stringify(partner)}
      `);

      const data = await updatePartner(partner.id, { draft: reply });

      if (!data.ok) {
        setMessage(data.error || "Draft generated, but saving failed.");
        return;
      }

      setPartners((prev) =>
        prev.map((item) => (item.id === partner.id ? data.partner : item))
      );
    } catch {
      setMessage("Could not generate draft. Check AI/backend connection.");
    } finally {
      setDraftingId(null);
    }
  }

  async function removePartner(id) {
    try {
      const data = await deletePartner(id);

      if (!data.ok) {
        setMessage(data.error || "Could not delete partner.");
        return;
      }

      setPartners((prev) => prev.filter((partner) => partner.id !== id));
      setMessage("Partner removed.");
    } catch {
      setMessage("Could not reach the partners API.");
    }
  }

  async function addTimelineNote(partner) {
    const draft = timelineDrafts[partner.id] || {};

    if (!draft.title?.trim()) {
      setMessage("Add a timeline title first.");
      return;
    }

    const data = await createPartnerTimelineItem(partner.id, {
      event_type: draft.event_type || "note",
      title: draft.title,
      detail: draft.detail,
      event_date: draft.event_date,
    });

    if (!data.ok) {
      setMessage(data.error || "Could not save timeline item.");
      return;
    }

    setTimelineByPartner((previous) => ({
      ...previous,
      [partner.id]: [data.timelineItem, ...(previous[partner.id] || [])],
    }));
    setTimelineDrafts((previous) => ({
      ...previous,
      [partner.id]: { event_type: "note", title: "", detail: "", event_date: "" },
    }));
    setMessage("Partner timeline updated.");
  }

  async function removeTimelineItem(partnerId, itemId) {
    const data = await deletePartnerTimelineItem(partnerId, itemId);

    if (!data.ok) {
      setMessage(data.error || "Could not delete timeline item.");
      return;
    }

    setTimelineByPartner((previous) => ({
      ...previous,
      [partnerId]: (previous[partnerId] || []).filter((item) => item.id !== itemId),
    }));
  }

  function updateTimelineDraft(partnerId, field, value) {
    setTimelineDrafts((previous) => ({
      ...previous,
      [partnerId]: {
        event_type: "note",
        title: "",
        detail: "",
        event_date: "",
        ...(previous[partnerId] || {}),
        [field]: value,
      },
    }));
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <SectionHeader
            icon={UserRoundCheck}
            title="Add Partner"
            subtitle="Create live partner records and test follow-up drafts"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              placeholder="Partner name"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <input
              value={form.email}
              onChange={(event) => updateForm("email", event.target.value)}
              placeholder="Email"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <input
              value={form.phone}
              onChange={(event) => updateForm("phone", event.target.value)}
              placeholder="Phone"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <input
              value={form.lastContact}
              onChange={(event) => updateForm("lastContact", event.target.value)}
              placeholder="Last contact date or note"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <textarea
              value={form.milestone}
              onChange={(event) => updateForm("milestone", event.target.value)}
              placeholder="Milestone"
              className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <textarea
              value={form.nextStep}
              onChange={(event) => updateForm("nextStep", event.target.value)}
              placeholder="Next step"
              className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={savePartner} disabled={saving} className="rounded-2xl">
              <Plus className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Partner"}
            </Button>
            {message && (
              <p className="text-sm font-bold text-slate-600">{message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {partners.length === 0 ? (
        <Card className="rounded-3xl border border-dashed border-slate-200 bg-white shadow-sm">
          <CardContent className="p-8 text-center">
            <UserRoundCheck className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 font-black text-slate-950">
              No partners saved yet
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Add a real partner above to test contact tracking and AI follow-up
              drafting.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {partners.map((partner) => (
            <Card
              key={partner.id}
              className="rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 p-3">
                    <UserRoundCheck className="h-6 w-6 text-slate-700" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-slate-950">
                      {partner.name}
                    </h3>
                    <p className="truncate text-sm text-slate-500">
                      {partner.email || partner.phone || "No contact saved"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl bg-slate-50 p-5">
                  <p className="text-sm font-bold text-slate-700">Milestone</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {partner.milestone || "No milestone saved."}
                  </p>
                </div>

                <div className="mt-4 rounded-3xl bg-slate-950 p-5 text-white">
                  <p className="text-sm font-bold">Next step</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    {partner.next_step || "No next step saved."}
                  </p>
                  {partner.last_contact && (
                    <p className="mt-3 text-xs font-bold text-slate-400">
                      Last contact: {partner.last_contact}
                    </p>
                  )}
                </div>

                {partner.draft && (
                  <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                    <strong>AI Draft:</strong>
                    <br />
                    {partner.draft}
                  </div>
                )}

                <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <h4 className="font-black text-slate-950">
                    Relationship Timeline
                  </h4>
                  <div className="mt-3 grid gap-2">
                    <input
                      value={timelineDrafts[partner.id]?.title || ""}
                      onChange={(event) =>
                        updateTimelineDraft(partner.id, "title", event.target.value)
                      }
                      placeholder="Timeline title"
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                    <textarea
                      value={timelineDrafts[partner.id]?.detail || ""}
                      onChange={(event) =>
                        updateTimelineDraft(partner.id, "detail", event.target.value)
                      }
                      placeholder="Note, contribution, meeting, or follow-up"
                      className="min-h-20 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                    <div className="grid gap-2 md:grid-cols-2">
                      <select
                        value={timelineDrafts[partner.id]?.event_type || "note"}
                        onChange={(event) =>
                          updateTimelineDraft(
                            partner.id,
                            "event_type",
                            event.target.value
                          )
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      >
                        <option value="note">Note</option>
                        <option value="meeting">Meeting</option>
                        <option value="contribution">Contribution</option>
                        <option value="follow_up">Follow-up</option>
                        <option value="outreach">Outreach</option>
                      </select>
                      <input
                        type="datetime-local"
                        value={timelineDrafts[partner.id]?.event_date || ""}
                        onChange={(event) =>
                          updateTimelineDraft(
                            partner.id,
                            "event_date",
                            event.target.value
                          )
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      />
                    </div>
                    <Button
                      onClick={() => addTimelineNote(partner)}
                      variant="outline"
                      className="rounded-2xl bg-white"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Timeline Item
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {(timelineByPartner[partner.id] || []).slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-100 bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-black uppercase text-slate-400">
                              {item.event_type}
                            </p>
                            <p className="font-black text-slate-950">
                              {item.title}
                            </p>
                          </div>
                          <button
                            onClick={() => removeTimelineItem(partner.id, item.id)}
                            className="rounded-xl p-2 text-red-600 hover:bg-red-50"
                            aria-label="Delete timeline item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {item.detail && (
                          <p className="mt-2 text-sm leading-5 text-slate-600">
                            {item.detail}
                          </p>
                        )}
                        <p className="mt-2 text-xs font-bold text-slate-400">
                          {new Date(item.event_date).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-2">
                  <Button
                    onClick={() => draftFollowUp(partner)}
                    disabled={draftingId === partner.id}
                    className="w-full rounded-2xl"
                  >
                    <MailPlus className="mr-2 h-4 w-4" />
                    {draftingId === partner.id
                      ? "Drafting..."
                      : "Draft Follow-up Email"}
                  </Button>
                  <Button
                    onClick={() => removePartner(partner.id)}
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
