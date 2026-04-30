import { useState } from "react";
import { ClipboardList, Plus, Save, Trash2 } from "lucide-react";

import {
  createProject,
  deleteProject,
  updateProject,
} from "../../services/api";
import SectionHeader from "../shared/SectionHeader";
import StatusPill from "../shared/StatusPill";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

const emptyProject = {
  name: "",
  lead: "",
  progress: 0,
  status: "Pending",
  blocker: "",
};

export default function ProjectsView({ projects, setProjects }) {
  const [form, setForm] = useState(emptyProject);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateLocalProject(id, updates) {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === id ? { ...project, ...updates } : project
      )
    );
  }

  async function saveProject() {
    if (!form.name.trim()) {
      setMessage("Add a project name before saving.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const data = await createProject(form);

      if (!data.ok) {
        setMessage(data.error || "Could not save project.");
        return;
      }

      setProjects((prev) => [data.project, ...prev]);
      setForm(emptyProject);
      setMessage("Project saved to live records.");
    } catch {
      setMessage("Could not reach the projects API.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProjectChanges(project) {
    try {
      const data = await updateProject(project.id, project);

      if (!data.ok) {
        setMessage(data.error || "Could not update project.");
        return;
      }

      updateLocalProject(project.id, data.project);
      setMessage("Project changes saved.");
    } catch {
      setMessage("Could not reach the projects API.");
    }
  }

  async function removeProject(id) {
    try {
      const data = await deleteProject(id);

      if (!data.ok) {
        setMessage(data.error || "Could not delete project.");
        return;
      }

      setProjects((prev) => prev.filter((project) => project.id !== id));
      setMessage("Project removed.");
    } catch {
      setMessage("Could not reach the projects API.");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <SectionHeader
            icon={ClipboardList}
            title="Add Project"
            subtitle="Create live projects and test progress tracking"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              placeholder="Project name"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <input
              value={form.lead}
              onChange={(event) => updateForm("lead", event.target.value)}
              placeholder="Project lead"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <select
              value={form.status}
              onChange={(event) => updateForm("status", event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            >
              <option value="Pending">Pending</option>
              <option value="On Track">On Track</option>
              <option value="At Risk">At Risk</option>
              <option value="Delayed">Delayed</option>
              <option value="Complete">Complete</option>
            </select>
            <input
              type="number"
              min="0"
              max="100"
              value={form.progress}
              onChange={(event) => updateForm("progress", event.target.value)}
              placeholder="Progress"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <textarea
              value={form.blocker}
              onChange={(event) => updateForm("blocker", event.target.value)}
              placeholder="Blocker or next action"
              className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400 md:col-span-2"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={saveProject} disabled={saving} className="rounded-2xl">
              <Plus className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Project"}
            </Button>
            {message && (
              <p className="text-sm font-bold text-slate-600">{message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {projects.length === 0 ? (
        <Card className="rounded-3xl border border-dashed border-slate-200 bg-white shadow-sm">
          <CardContent className="p-8 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 font-black text-slate-950">
              No projects saved yet
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Add a real project above to test status, blockers, and dashboard
              counts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <ClipboardList className="h-6 w-6 text-slate-700" />
                  <StatusPill status={project.status} />
                </div>

                <input
                  value={project.name}
                  onChange={(event) =>
                    updateLocalProject(project.id, { name: event.target.value })
                  }
                  className="mt-5 w-full rounded-2xl border border-slate-200 px-3 py-2 text-lg font-black text-slate-950 outline-none focus:border-slate-400"
                />

                <input
                  value={project.lead || ""}
                  onChange={(event) =>
                    updateLocalProject(project.id, { lead: event.target.value })
                  }
                  placeholder="Project lead"
                  className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600 outline-none focus:border-slate-400"
                />

                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-500">Progress</span>
                    <span className="font-black text-slate-950">
                      {project.progress}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={project.progress}
                    onChange={(event) =>
                      updateLocalProject(project.id, {
                        progress: event.target.value,
                      })
                    }
                    className="w-full accent-slate-950"
                  />
                </div>

                <select
                  value={project.status}
                  onChange={(event) =>
                    updateLocalProject(project.id, {
                      status: event.target.value,
                    })
                  }
                  className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  <option value="Pending">Pending</option>
                  <option value="On Track">On Track</option>
                  <option value="At Risk">At Risk</option>
                  <option value="Delayed">Delayed</option>
                  <option value="Complete">Complete</option>
                </select>

                <textarea
                  value={project.blocker || ""}
                  onChange={(event) =>
                    updateLocalProject(project.id, {
                      blocker: event.target.value,
                    })
                  }
                  placeholder="Blocker or next action"
                  className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 outline-none focus:border-slate-400"
                />

                <div className="mt-5 grid gap-2">
                  <Button
                    onClick={() => saveProjectChanges(project)}
                    className="w-full rounded-2xl"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                  <Button
                    onClick={() => removeProject(project.id)}
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
