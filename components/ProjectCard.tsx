"use client";

import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { AgentOrb, Progress, StatusPill } from "./ui";

export default function ProjectCard({ projectId, compact = false }: { projectId: string; compact?: boolean }) {
  const { state, dispatch } = useStore();
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const tasks = project.taskIds.map((id) => state.tasks[id]).filter(Boolean);
  const live = tasks.filter((t) => t.status !== "cancelled");
  const overall = live.length ? Math.round(live.reduce((s, t) => s + (t.status === "complete" ? 100 : t.progress), 0) / live.length) : 0;

  return (
    <div className="glass-soft overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-3 px-4 pb-2.5 pt-3.5">
        <div className="min-w-0">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-haze">{project.doneAt ? "Delivered" : "In progress"}</div>
          <div className="truncate text-[14px] font-medium">{project.title}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[18px] tabular-nums tracking-tight">{overall}%</div>
        </div>
      </div>
      <Progress value={overall} color="#c49bff" className="mx-4 mb-2" />
      {!compact && (
        <ul className="divide-y divide-white/[0.05] border-t border-white/[0.05]">
          {tasks.map((t, i) => {
            const a = state.agents.find((x) => x.id === t.agentId);
            if (!a) return null;
            return (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <button
                  onClick={() => dispatch({ type: "SELECT", id: a.id })}
                  className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.03]"
                >
                  <AgentOrb color={a.color} size={24} active={t.status === "working" || t.status === "thinking"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{a.name}</span>
                      <span className="truncate text-[12.5px] text-mist">{t.title}</span>
                    </div>
                    <Progress value={t.status === "complete" ? 100 : t.progress} color={a.color} className="mt-1.5" />
                  </div>
                  <StatusPill status={t.status} className="shrink-0" />
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
