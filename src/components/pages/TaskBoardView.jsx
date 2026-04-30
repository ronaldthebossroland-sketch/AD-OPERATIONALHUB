import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Trash2 } from "lucide-react";

import {
  createTask,
  deleteTask,
  getTasks,
  updateTask,
} from "../../services/api";
import SectionHeader from "../shared/SectionHeader";
import StatusPill from "../shared/StatusPill";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

const columns = [
  { key: "To Do", aliases: ["Open", "Pending", "To Do"], title: "To Do" },
  { key: "In Progress", aliases: ["In Progress", "Doing"], title: "In Progress" },
  { key: "Waiting", aliases: ["Waiting", "Blocked", "On Hold"], title: "Waiting" },
  { key: "Completed", aliases: ["Completed", "Done", "Resolved"], title: "Completed" },
];

const emptyTask = {
  title: "",
  detail: "",
  owner: "",
  deadline: "",
  priority: "Medium",
  status: "To Do",
};

function columnForStatus(status) {
  const normalized = String(status || "To Do").toLowerCase();
  return (
    columns.find((column) =>
      column.aliases.some((alias) => alias.toLowerCase() === normalized)
    )?.key || "To Do"
  );
}

export default function TaskBoardView() {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(emptyTask);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const groupedTasks = useMemo(() => {
    return columns.reduce((acc, column) => {
      acc[column.key] = tasks.filter(
        (task) => columnForStatus(task.status) === column.key
      );
      return acc;
    }, {});
  }, [tasks]);

  useEffect(() => {
    let isMounted = true;

    async function loadTasks() {
      try {
        const data = await getTasks();

        if (isMounted) {
          setTasks(data.tasks || []);
          if (!data.ok) {
            setMessage(data.error || "Could not load tasks.");
          }
        }
      } catch {
        if (isMounted) {
          setMessage("Could not reach the tasks API.");
        }
      }
    }

    loadTasks();

    return () => {
      isMounted = false;
    };
  }, []);

  function setField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function saveTask() {
    if (!form.title.trim()) {
      setMessage("Add a task title.");
      return;
    }

    try {
      setIsSaving(true);
      const data = await createTask(form);

      if (!data.ok) {
        setMessage(data.error || "Could not save task.");
        return;
      }

      setTasks((previous) => [data.task, ...previous]);
      setForm(emptyTask);
      setMessage("Task saved.");
    } catch {
      setMessage("Could not reach the tasks API.");
    } finally {
      setIsSaving(false);
    }
  }

  async function moveTask(task, status) {
    const previousTasks = tasks;
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status } : item))
    );

    try {
      const data = await updateTask(task.id, { status });

      if (!data.ok) {
        setTasks(previousTasks);
        setMessage(data.error || "Could not update task.");
        return;
      }

      setTasks((current) =>
        current.map((item) => (item.id === task.id ? data.task : item))
      );
    } catch {
      setTasks(previousTasks);
      setMessage("Could not reach the tasks API.");
    }
  }

  async function removeTask(task) {
    const data = await deleteTask(task.id);

    if (!data.ok) {
      setMessage(data.error || "Could not delete task.");
      return;
    }

    setTasks((previous) => previous.filter((item) => item.id !== task.id));
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <SectionHeader
            icon={ClipboardList}
            title="Task Board"
            subtitle="Action items from meetings, transcripts, operations, and AI commands"
          />

          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={form.title}
              onChange={(event) => setField("title", event.target.value)}
              placeholder="Task title"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 md:col-span-2"
            />
            <input
              value={form.owner}
              onChange={(event) => setField("owner", event.target.value)}
              placeholder="Owner"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <input
              value={form.deadline}
              onChange={(event) => setField("deadline", event.target.value)}
              placeholder="Deadline"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <textarea
              value={form.detail}
              onChange={(event) => setField("detail", event.target.value)}
              placeholder="Task detail"
              className="min-h-24 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 md:col-span-2"
            />
            <select
              value={form.priority}
              onChange={(event) => setField("priority", event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
            <Button
              onClick={saveTask}
              disabled={isSaving}
              className="rounded-2xl"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Add Task"}
            </Button>
          </div>

          {message && (
            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              {message}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => (
          <Card
            key={column.key}
            className="min-h-[28rem] rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <CardContent className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-black text-slate-950">{column.title}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  {groupedTasks[column.key]?.length || 0}
                </span>
              </div>

              <div className="space-y-3">
                {(groupedTasks[column.key] || []).map((task) => (
                  <div
                    key={task.id}
                    className="rounded-3xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-black text-slate-950">
                        {task.title}
                      </h3>
                      <StatusPill status={task.priority || "Medium"} />
                    </div>
                    {task.detail && (
                      <p className="mt-2 text-sm leading-5 text-slate-600">
                        {task.detail}
                      </p>
                    )}
                    <div className="mt-3 space-y-1 text-xs font-bold text-slate-500">
                      {task.owner && <p>Owner: {task.owner}</p>}
                      {task.deadline && <p>Deadline: {task.deadline}</p>}
                      {task.source_type && <p>Source: {task.source_type}</p>}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {columns
                        .filter((target) => target.key !== column.key)
                        .map((target) => (
                          <button
                            key={target.key}
                            onClick={() => moveTask(task, target.key)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600 transition hover:border-slate-400"
                          >
                            {target.title}
                          </button>
                        ))}
                      <button
                        onClick={() => removeTask(task)}
                        className="rounded-full border border-red-100 bg-white px-3 py-1 text-xs font-black text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 className="inline h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
