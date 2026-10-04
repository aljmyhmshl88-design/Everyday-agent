"use client";

import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { currentTask } from "@/lib/sim";
import { AgentOrb, Icon, Progress, StatusPill, timeAgo } from "./ui";

function Frame({ title, subtitle, children, action }: { title: string; subtitle: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex justify-center px-4 pb-6 pt-24 sm:pt-28">
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.985 }}
        transition={{ type: "spring", stiffness: 180, damping: 24 }}
        className="glass pointer-events-auto flex h-full w-full max-w-[920px] flex-col overflow-hidden rounded-[28px]"
      >
        <header className="flex items-end justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
            <p className="mt-0.5 text-[13px] text-mist">{subtitle}</p>
          </div>
          {action}
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </motion.section>
    </div>
  );
}

export function TeamView() {
  const { state, dispatch } = useStore();
  const active = state.agents.filter((a) => a.status === "working" || a.status === "thinking").length;
  return (
    <Frame
      title="Team"
      subtitle={`${state.agents.length} agents · ${active} active right now`}
      action={
        <button onClick={() => dispatch({ type: "CREATE_OPEN", open: true })} className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-medium text-[#0b0e1c] transition hover:shadow-[0_0_24px_-4px_rgba(196,155,255,0.8)]">
          <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2} /> Create Agent
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.agents.map((a, i) => {
          const t = currentTask(state, a.id);
          const show = t && t.status !== "cancelled" && (a.status !== "idle" || t.status === "complete");
          return (
            <motion.button
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -3 }}
              onClick={() => dispatch({ type: "SELECT", id: a.id })}
              className="glass-soft group relative overflow-hidden rounded-2xl p-4 text-left transition-colors hover:border-white/15"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40" style={{ background: a.color }} />
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <AgentOrb color={a.color} size={34} active={a.status === "working"} />
                  <div>
                    <div className="text-[15px] font-medium">{a.name}</div>
                    <div className="text-[12px] text-mist">{a.role}</div>
                  </div>
                </div>
                <StatusPill status={a.status} />
              </div>
              <div className="relative mt-4 min-h-[44px]">
                <div className="truncate text-[12.5px] text-mist">{show ? t!.title : a.description}</div>
                {show && (
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={t!.status === "complete" ? 100 : t!.progress} color={a.color} className="flex-1" />
                    <span className="w-9 text-right font-mono text-[11.5px] tabular-nums text-mist">{t!.status === "complete" ? 100 : t!.progress}%</span>
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </Frame>
  );
}

export function TasksView() {
  const { state, dispatch } = useStore();
  const [showBg, setShowBg] = useState(true);
  const projects = [...state.projects].filter((p) => showBg || !p.background).reverse();
  return (
    <Frame
      title="Tasks"
      subtitle="Projects, subtasks and who's on them"
      action={
        <button onClick={() => setShowBg((v) => !v)} className="rounded-full bg-white/[0.05] px-3 py-1.5 text-[12px] text-mist transition hover:text-white">
          {showBg ? "Hide" : "Show"} background jobs
        </button>
      }
    >
      {projects.length === 0 && <div className="py-16 text-center text-[14px] text-mist">No projects yet. Ask Atlas for something in Chat.</div>}
      <div className="space-y-4">
        {projects.map((p, pi) => {
          const tasks = p.taskIds.map((id) => state.tasks[id]).filter(Boolean);
          const live = tasks.filter((t) => t.status !== "cancelled");
          const overall = live.length ? Math.round(live.reduce((s, t) => s + (t.status === "complete" ? 100 : t.progress), 0) / live.length) : 0;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: pi * 0.05 }} className="glass-soft overflow-hidden rounded-2xl">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium">{p.title}</span>
                    {p.background && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-haze">Background</span>}
                  </div>
                  <div className="mt-0.5 text-[12px] text-haze">
                    {tasks.length} subtasks · started {timeAgo(p.createdAt)} ago{p.doneAt ? " · delivered" : ""}
                  </div>
                </div>
                <div className="hidden w-40 sm:block">
                  <Progress value={overall} />
                </div>
                <span className="w-11 text-right font-mono text-[14px] tabular-nums">{overall}%</span>
              </div>
              <div className="border-t border-white/[0.05]">
                {tasks.map((t) => {
                  const a = state.agents.find((x) => x.id === t.agentId);
                  if (!a) return null;
                  const deps = t.dependsOn.map((d) => state.agents.find((x) => x.id === state.tasks[d]?.agentId)?.name).filter(Boolean);
                  return (
                    <button key={t.id} onClick={() => dispatch({ type: "SELECT", id: a.id })} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3 text-left transition hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_140px_auto]">
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px]">{t.title}</div>
                        {deps.length > 0 && <div className="truncate text-[11.5px] text-haze">after {deps.join(", ")}</div>}
                      </div>
                      <div className="hidden items-center gap-2 sm:flex">
                        <AgentOrb color={a.color} size={20} active={t.status === "working"} />
                        <span className="text-[13px] text-mist">{a.name}</span>
                      </div>
                      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                        <Progress value={t.status === "complete" ? 100 : t.progress} color={a.color} className="flex-1" />
                        <span className="w-8 text-right font-mono text-[11px] tabular-nums text-haze">{t.status === "complete" ? 100 : t.progress}%</span>
                      </div>
                      <div className="col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto">
                        <StatusPill status={t.status} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </Frame>
  );
}

const KIND_STYLE: Record<string, string> = {
  complete: "#6ff0c6",
  handoff: "#62d4ff",
  alert: "#ffc86e",
  user: "#c49bff",
  start: "#e9e6ff",
  info: "#6b7392",
};

export function ActivityView() {
  const { state, dispatch } = useStore();
  return (
    <Frame title="Activity" subtitle="Everything your team is doing, live">
      <ol className="relative">
        {state.activity.slice(0, 120).map((e) => {
          const a = state.agents.find((x) => x.id === e.agentId);
          return (
            <motion.li key={e.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex items-start gap-4 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.02]">
              <span className="mt-[3px] w-10 shrink-0 text-right font-mono text-[11px] text-haze">{timeAgo(e.at)}</span>
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: KIND_STYLE[e.kind], boxShadow: `0 0 8px ${KIND_STYLE[e.kind]}` }} />
              <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed">
                {a && (
                  <button onClick={() => dispatch({ type: "SELECT", id: a.id })} className="mr-2 font-medium hover:underline" style={{ color: a.color }}>
                    {a.name}
                  </button>
                )}
                <span className="text-mist">{e.text}</span>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </Frame>
  );
}
