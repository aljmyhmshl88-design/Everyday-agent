"use client";

import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { Composer } from "./Chat";
import { STATUS_META } from "./ui";

const LEGEND = ["idle", "thinking", "working", "waiting", "needs-input", "complete", "error"] as const;

export default function CommandHud() {
  const { state, dispatch } = useStore();
  const active = state.agents.filter((a) => a.status === "working" || a.status === "thinking").length;
  const inFlight = Object.values(state.tasks).filter((t) => !["complete", "cancelled", "queued"].includes(t.status)).length;
  const delivered = Object.values(state.tasks).filter((t) => t.status === "complete").length;

  // the collaboration chain of the most recent project, e.g. Scout → Nova → Forge → Sentinel
  const project = [...state.projects].reverse().find((p) => !p.doneAt) ?? state.projects[state.projects.length - 1];
  const chain = project
    ? Array.from(new Set(project.taskIds.map((id) => state.tasks[id]?.agentId).filter(Boolean))).map((id) => state.agents.find((a) => a.id === id)!).filter(Boolean)
    : [];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ delay: 0.15 }}
        className="pointer-events-none fixed left-4 top-24 z-10 space-y-3 sm:left-6"
      >
        <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-haze">Command Center</div>
        <div className="flex gap-5">
          {[
            ["Agents", state.agents.length],
            ["Active", active],
            ["In flight", inFlight],
            ["Delivered", delivered],
          ].map(([k, v]) => (
            <div key={k as string}>
              <div className="font-mono text-[24px] leading-none tabular-nums tracking-tight">{v}</div>
              <div className="mt-1 text-[11px] text-haze">{k}</div>
            </div>
          ))}
        </div>
        {project && chain.length > 0 && (
          <div className="pt-3">
            <div className="text-[11px] text-haze">{project.title}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px]">
              {chain.map((a, i) => (
                <span key={a.id} className="flex items-center gap-1.5">
                  <span style={{ color: a.color }} className={a.status === "working" ? "font-medium" : "opacity-70"}>
                    {a.name}
                  </span>
                  {i < chain.length - 1 && <span className="text-haze">→</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="pointer-events-none fixed bottom-24 left-4 z-10 hidden flex-col gap-1.5 sm:left-6 md:flex"
      >
        {LEGEND.map((s) => (
          <div key={s} className="flex items-center gap-2 text-[11px] text-haze">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[s].color, boxShadow: `0 0 6px ${STATUS_META[s].color}` }} />
            {STATUS_META[s].label}
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", stiffness: 200, damping: 26 }}
        className="fixed inset-x-0 bottom-5 z-20 mx-auto w-[calc(100%-2rem)] max-w-[560px]"
      >
        <Composer />
        <button onClick={() => dispatch({ type: "COMMAND", on: false })} className="mx-auto mt-2 block text-[11.5px] text-haze transition hover:text-white">
          Back to chat
        </button>
      </motion.div>
    </>
  );
}
