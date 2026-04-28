import { ClipboardList } from "lucide-react";

import { projects } from "../../data/mockData";
import StatusPill from "../shared/StatusPill";
import { Card, CardContent } from "../ui/card";

export default function ProjectsView() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {projects.map((project) => (
        <Card
          key={project.id}
          className="rounded-3xl border border-slate-200 bg-white shadow-sm"
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <ClipboardList className="h-6 w-6 text-slate-700" />
              <StatusPill status={project.status} />
            </div>

            <h3 className="mt-5 text-lg font-black text-slate-950">
              {project.name}
            </h3>

            <p className="mt-2 text-sm text-slate-500">Lead: {project.lead}</p>

            <div className="mt-5">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-slate-500">Progress</span>
                <span className="font-black text-slate-950">
                  {project.progress}%
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-950"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>

            <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <strong>Blocker:</strong> {project.blocker}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
