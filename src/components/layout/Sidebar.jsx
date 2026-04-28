import { Clock3, Sparkles } from "lucide-react";

import { Button } from "../ui/button";

export default function Sidebar({ activeView, items, setActiveView }) {
  return (
    <>
      <aside className="hidden w-72 border-r border-slate-200 bg-white p-5 lg:block">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-950 p-3 text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-black">AD Hub</h1>
            <p className="text-xs text-slate-500">Operational AI Assistant</p>
          </div>
        </div>

        <nav className="mt-8 space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;

            return (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                  isActive
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-8 rounded-3xl bg-slate-100 p-5">
          <div className="flex items-center gap-2 text-sm font-black text-slate-950">
            <Clock3 className="h-4 w-4" />
            Next briefing
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Finance Review starts in 10 minutes. Budget variance and vendor
            pricing require attention.
          </p>
          <Button className="mt-4 w-full rounded-2xl">Open</Button>
        </div>
      </aside>

      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-start gap-1 overflow-x-auto border-t border-slate-200 bg-white px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.key;

          return (
            <button
              key={item.key}
              onClick={() => setActiveView(item.key)}
              className={`flex min-w-[4.5rem] flex-col items-center gap-1 rounded-2xl px-2 py-1 text-[11px] font-bold ${
                isActive ? "text-slate-950" : "text-slate-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
