import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";

import { getApprovals, updateApproval } from "../../services/api";
import SectionHeader from "../shared/SectionHeader";
import StatusPill from "../shared/StatusPill";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

function approvalTypeLabel(type) {
  return String(type || "approval").replaceAll("_", " ");
}

export default function ApprovalCenterView({ onNavigate }) {
  const [approvals, setApprovals] = useState([]);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const pendingApprovals = useMemo(
    () =>
      approvals.filter((approval) =>
        ["pending", "draft", "needs approval"].includes(
          String(approval.status || "").toLowerCase()
        )
      ),
    [approvals]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadApprovals() {
      try {
        const data = await getApprovals();

        if (!isMounted) {
          return;
        }

        if (!data.ok) {
          setMessage(data.error || "Could not load approvals.");
          return;
        }

        setApprovals(data.approvals || []);
      } catch {
        if (isMounted) {
          setMessage("Could not reach the approvals API.");
        }
      }
    }

    loadApprovals();

    return () => {
      isMounted = false;
    };
  }, []);

  async function setApprovalStatus(approval, status) {
    setUpdatingId(`${approval.source}-${approval.id}`);
    setMessage("");

    try {
      const data = await updateApproval(approval.source, approval.id, { status });

      if (!data.ok) {
        setMessage(data.error || "Could not update approval.");
        return;
      }

      setApprovals((previous) =>
        previous.map((item) =>
          item.source === approval.source && item.id === approval.id
            ? { ...item, status }
            : item
        )
      );
      setMessage(
        status === "Approved"
          ? "Approved. Sensitive actions still require their own final button."
          : "Rejected."
      );
    } catch {
      setMessage("Could not reach the approvals API.");
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <SectionHeader
            icon={ShieldCheck}
            title="Approval Center"
            subtitle="Review AI actions, email drafts, meeting requests, and high-risk alerts before final action"
          />

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-400">
                Pending
              </p>
              <p className="mt-2 text-3xl font-black text-slate-950">
                {pendingApprovals.length}
              </p>
            </div>
            <div className="rounded-3xl bg-emerald-50 p-4 text-emerald-800 md:col-span-3">
              <p className="text-sm font-bold">
                Emails are never sent from here. Approval only marks a draft as
                reviewed; the final Send button remains in Emails.
              </p>
            </div>
          </div>

          {message && (
            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              {message}
            </p>
          )}
        </CardContent>
      </Card>

      {approvals.length === 0 ? (
        <Card className="rounded-3xl border border-dashed border-slate-200 bg-white shadow-sm">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 font-black text-slate-950">
              No approvals waiting
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Email drafts, high-risk alerts, and AI-generated approval requests
              will collect here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {approvals.map((approval) => {
            const isUpdating = updatingId === `${approval.source}-${approval.id}`;

            return (
              <Card
                key={`${approval.source}-${approval.id}`}
                className="rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-slate-400">
                        {approvalTypeLabel(approval.item_type)}
                      </p>
                      <h3 className="mt-2 text-lg font-black text-slate-950">
                        {approval.title}
                      </h3>
                    </div>
                    <StatusPill status={approval.priority || approval.status} />
                  </div>

                  <p className="mt-4 max-h-40 overflow-hidden whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {approval.summary || "No summary saved."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                      onClick={() => setApprovalStatus(approval, "Approved")}
                      disabled={isUpdating || approval.status === "Approved"}
                      className="rounded-2xl"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => setApprovalStatus(approval, "Rejected")}
                      disabled={isUpdating || approval.status === "Rejected"}
                      variant="outline"
                      className="rounded-2xl text-red-600"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                    {approval.item_type === "email_draft" && (
                      <Button
                        onClick={() => onNavigate("emails")}
                        variant="outline"
                        className="rounded-2xl"
                      >
                        Open Emails
                      </Button>
                    )}
                    {approval.item_type === "operation_alert" && (
                      <Button
                        onClick={() => onNavigate("operations")}
                        variant="outline"
                        className="rounded-2xl"
                      >
                        Open Operations
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
