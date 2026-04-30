import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Plus,
  Radio,
  Trash2,
} from "lucide-react";

import {
  createActivity,
  createAlert,
  createOperation,
  deleteActivity,
  deleteOperation,
  updateOperation,
} from "../../services/api";
import SectionHeader from "../shared/SectionHeader";
import StatusPill from "../shared/StatusPill";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

const emptyOperation = {
  area: "Operations",
  title: "",
  detail: "",
  severity: "Medium",
  status: "Open",
};

const emptyActivity = {
  title: "",
  time: "",
  location: "",
};

export default function OperationsView({
  activities,
  operations,
  setAlerts,
  setActivities,
  setOperations,
}) {
  const [operationForm, setOperationForm] = useState(emptyOperation);
  const [activityForm, setActivityForm] = useState(emptyActivity);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function updateOperationForm(field, value) {
    setOperationForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateActivityForm(field, value) {
    setActivityForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateLocalOperation(id, updates) {
    setOperations((prev) =>
      prev.map((operation) =>
        operation.id === id ? { ...operation, ...updates } : operation
      )
    );
  }

  async function saveOperation() {
    if (!operationForm.title.trim()) {
      setMessage("Add an operation title before saving.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const data = await createOperation(operationForm);

      if (!data.ok) {
        setMessage(data.error || "Could not save operation.");
        return;
      }

      setOperations((prev) => [data.operation, ...prev]);
      setOperationForm(emptyOperation);
      setMessage("Operation record saved.");
    } catch {
      setMessage("Could not reach the operations API.");
    } finally {
      setSaving(false);
    }
  }

  async function saveOperationChanges(operation) {
    try {
      const data = await updateOperation(operation.id, operation);

      if (!data.ok) {
        setMessage(data.error || "Could not update operation.");
        return;
      }

      updateLocalOperation(operation.id, data.operation);
      setMessage("Operation changes saved.");
    } catch {
      setMessage("Could not reach the operations API.");
    }
  }

  async function createAlertFromOperation(operation) {
    try {
      const data = await createAlert({
        type: operation.area,
        title: operation.title,
        detail: operation.detail,
        severity: operation.severity,
      });

      if (!data.ok) {
        setMessage(data.error || "Could not create alert.");
        return;
      }

      setAlerts((prev) => [data.alert, ...prev]);
      setMessage("Alert created from operation record.");
    } catch {
      setMessage("Could not reach the alerts API.");
    }
  }

  async function resolveOperation(operation) {
    const data = await updateOperation(operation.id, { status: "Resolved" });

    if (!data.ok) {
      setMessage(data.error || "Could not resolve operation.");
      return;
    }

    updateLocalOperation(operation.id, data.operation);
    setMessage("Operation marked resolved.");
  }

  async function removeOperation(id) {
    try {
      const data = await deleteOperation(id);

      if (!data.ok) {
        setMessage(data.error || "Could not delete operation.");
        return;
      }

      setOperations((prev) =>
        prev.filter((operation) => operation.id !== id)
      );
      setMessage("Operation removed.");
    } catch {
      setMessage("Could not reach the operations API.");
    }
  }

  async function saveActivity() {
    if (!activityForm.title.trim()) {
      setMessage("Add an activity title before saving.");
      return;
    }

    try {
      const data = await createActivity(activityForm);

      if (!data.ok) {
        setMessage(data.error || "Could not save activity.");
        return;
      }

      setActivities((prev) => [data.activity, ...prev]);
      setActivityForm(emptyActivity);
      setMessage("Activity saved.");
    } catch {
      setMessage("Could not reach the activities API.");
    }
  }

  async function removeActivity(id) {
    try {
      const data = await deleteActivity(id);

      if (!data.ok) {
        setMessage(data.error || "Could not delete activity.");
        return;
      }

      setActivities((prev) =>
        prev.filter((activityItem) => activityItem.id !== id)
      );
      setMessage("Activity removed.");
    } catch {
      setMessage("Could not reach the activities API.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={Radio}
              title="Add Operation Record"
              subtitle="Track finance, property, admin, and ministry operation items"
            />

            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={operationForm.area}
                onChange={(event) =>
                  updateOperationForm("area", event.target.value)
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
              >
                <option value="Operations">Operations</option>
                <option value="Finance">Finance</option>
                <option value="Property">Property</option>
                <option value="Administration">Administration</option>
                <option value="Partnership">Partnership</option>
              </select>
              <select
                value={operationForm.severity}
                onChange={(event) =>
                  updateOperationForm("severity", event.target.value)
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <input
                value={operationForm.title}
                onChange={(event) =>
                  updateOperationForm("title", event.target.value)
                }
                placeholder="Operation title"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400 md:col-span-2"
              />
              <textarea
                value={operationForm.detail}
                onChange={(event) =>
                  updateOperationForm("detail", event.target.value)
                }
                placeholder="Details, action needed, or update"
                className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400 md:col-span-2"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                onClick={saveOperation}
                disabled={saving}
                className="rounded-2xl"
              >
                <Plus className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Operation"}
              </Button>
              {message && (
                <p className="text-sm font-bold text-slate-600">{message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {operations.length === 0 ? (
          <Card className="rounded-3xl border border-dashed border-slate-200 bg-white shadow-sm">
            <CardContent className="p-8 text-center">
              <Building2 className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-3 font-black text-slate-950">
                No operation records saved yet
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Save real operation items here, then create alerts from the ones
                that need dashboard visibility.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {operations.map((operation) => (
              <Card
                key={operation.id}
                className="rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-slate-400">
                        {operation.area}
                      </p>
                      <input
                        value={operation.title}
                        onChange={(event) =>
                          updateLocalOperation(operation.id, {
                            title: event.target.value,
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-lg font-black text-slate-950 outline-none focus:border-slate-400"
                      />
                    </div>
                    <StatusPill status={operation.severity} />
                  </div>

                  <textarea
                    value={operation.detail || ""}
                    onChange={(event) =>
                      updateLocalOperation(operation.id, {
                        detail: event.target.value,
                      })
                    }
                    placeholder="Operation detail"
                    className="mt-4 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 outline-none focus:border-slate-400"
                  />

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <select
                      value={operation.severity}
                      onChange={(event) =>
                        updateLocalOperation(operation.id, {
                          severity: event.target.value,
                        })
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                    <select
                      value={operation.status}
                      onChange={(event) =>
                        updateLocalOperation(operation.id, {
                          status: event.target.value,
                        })
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>

                  <div className="mt-5 grid gap-2">
                    <Button
                      onClick={() => saveOperationChanges(operation)}
                      className="w-full rounded-2xl"
                    >
                      Save Changes
                    </Button>
                    <Button
                      onClick={() => createAlertFromOperation(operation)}
                      variant="outline"
                      className="w-full rounded-2xl"
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Create Alert
                    </Button>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Button
                        onClick={() => resolveOperation(operation)}
                        variant="outline"
                        className="rounded-2xl text-emerald-700"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Resolve
                      </Button>
                      <Button
                        onClick={() => removeOperation(operation.id)}
                        variant="outline"
                        className="rounded-2xl text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6 xl:col-span-4">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={Activity}
              title="Add Activity"
              subtitle="Feeds the dashboard activity section"
            />

            <div className="space-y-3">
              <input
                value={activityForm.title}
                onChange={(event) =>
                  updateActivityForm("title", event.target.value)
                }
                placeholder="Activity title"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
              <input
                value={activityForm.time}
                onChange={(event) =>
                  updateActivityForm("time", event.target.value)
                }
                placeholder="Time or date"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
              <input
                value={activityForm.location}
                onChange={(event) =>
                  updateActivityForm("location", event.target.value)
                }
                placeholder="Location"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
              <Button onClick={saveActivity} className="w-full rounded-2xl">
                <Plus className="mr-2 h-4 w-4" />
                Save Activity
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={Activity}
              title="Activities"
              subtitle="Live saved activity records"
            />

            {activities.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <Activity className="mx-auto h-7 w-7 text-slate-400" />
                <p className="mt-3 text-sm font-bold text-slate-600">
                  No activities saved yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activityItem) => (
                  <div
                    key={activityItem.id}
                    className="rounded-3xl border border-slate-100 p-4"
                  >
                    <h3 className="font-black text-slate-950">
                      {activityItem.title}
                    </h3>
                    {activityItem.time && (
                      <p className="mt-1 text-sm text-slate-500">
                        {activityItem.time}
                      </p>
                    )}
                    {activityItem.location && (
                      <p className="text-sm text-slate-500">
                        {activityItem.location}
                      </p>
                    )}
                    <Button
                      onClick={() => removeActivity(activityItem.id)}
                      variant="outline"
                      className="mt-3 rounded-2xl text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
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
