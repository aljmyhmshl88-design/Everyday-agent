"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { currentTask } from "@/lib/sim";
import { AgentOrb, Icon, Progress, StatusPill, timeAgo } from "./ui";

export default function AgentPanel() {
  const { state, dispatch } = useStore();
  const agent = state.agents.find((a) => a.id === state.selectedAgentId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dispatch({ type: "SELECT", id: null });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  return (
    <AnimatePresence>
      {agent && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => dispatch({ type: "SELECT", id: null })}
          />
          <motion.aside
            key="panel"
            initial={{ x: 40, opacity: 0, filter: "blur(8px)" }}
            animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ x: 40, opacity: 0, filter: "blur(8px)" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="glass fixed inset-y-3 right-3 z-50 flex w-[calc(100%-1.5rem)] max-w-[400px] flex-col overflow-hidden rounded-[26px]"
          >
            <PanelBody agentId={agent.id} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function PanelBody({ agentId }: { agentId: string }) {
  const { state, dispatch } = useStore();
  const agent = state.agents.find((a) => a.id === agentId)!;
  const task = currentTask(state, agentId);
  const [text, setText] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const isAtlas = agentId === "atlas";

  // Atlas reports on the whole active project
  const atlasProject = isAtlas ? [...state.projects].reverse().find((p) => !p.background) : undefined;
  const atlasProgress = atlasProject
    ? Math.round(atlasProject.taskIds.reduce((s, id) => s + (state.tasks[id]?.status === "complete" ? 100 : state.tasks[id]?.progress ?? 0), 0) / Math.max(1, atlasProject.taskIds.length))
    : 0;

  const progress = isAtlas ? atlasProgress : task ? (task.status === "complete" ? 100 : task.progress) : 0;
  const steps = isAtlas
    ? (atlasProject?.taskIds.map((id) => state.tasks[id]).filter(Boolean).map((t) => ({ label: `${state.agents.find((a) => a.id === t.agentId)?.name} · ${t.title}`, state: t.status === "complete" ? "done" : t.status === "queued" ? "todo" : t.status === "cancelled" ? "skip" : "active" })) ?? [])
    : (task?.steps.map((label, i) => {
        const done = task.status === "complete" ? task.steps.length : Math.floor((task.progress / 100) * task.steps.length);
        return { label, state: i < done ? "done" : i === done && task.status !== "queued" && task.status !== "cancelled" ? "active" : "todo" };
      }) ?? []);
  const currentStep = steps.find((s) => s.state === "active")?.label ?? (progress >= 100 ? "Delivered" : steps[0]?.label ?? "—");
  const recent = state.activity.filter((a) => a.agentId === agentId).slice(0, 6);
  const paused = task?.status === "paused";
  const canControl = !isAtlas && task && !["complete", "cancelled"].includes(task.status);
  const hasWork = Object.values(state.tasks).some((t) => t.agentId === agentId && t.output);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [agent.thread.length]);

  const send = () => {
    const v = text.trim();
    if (!v) return;
    dispatch({ type: "AGENT_MESSAGE", agentId, text: v });
    setText("");
  };

  return (
    <>
      {/* header */}
      <div className="relative overflow-hidden px-6 pb-5 pt-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-40 blur-3xl" style={{ background: agent.color }} />
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <AgentOrb color={agent.color} size={44} active={agent.status === "working"} />
            <div>
              <div className="text-[20px] font-semibold tracking-tight">{agent.name}</div>
              <div className="text-[13px] text-mist">{agent.role}</div>
            </div>
          </div>
          <button onClick={() => dispatch({ type: "SELECT", id: null })} className="rounded-full p-2 text-haze transition hover:bg-white/[0.06] hover:text-white" aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="relative mt-4 flex items-center gap-2">
          <StatusPill status={agent.status} />
          {agent.custom && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-mist">Custom</span>}
        </div>
      </div>

      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto px-6 pb-4">
        {/* current task */}
        <section className="glass-soft rounded-2xl p-4">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-haze">Current task</div>
          <div className="mt-1 text-[14.5px] font-medium">{isAtlas ? atlasProject?.title ?? "Standing by" : task?.title ?? "Standing by"}</div>
          <div className="mt-3 flex items-end justify-between">
            <div className="text-[12px] text-mist">
              Step: <span className="text-white">{currentStep}</span>
            </div>
            <div className="font-mono text-[22px] leading-none tabular-nums tracking-tight">{progress}%</div>
          </div>
          <Progress value={progress} color={agent.color} className="mt-3" />
        </section>

        {/* timeline */}
        {steps.length > 0 && (
          <section>
            <div className="mb-2.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-haze">Timeline</div>
            <ol className="relative space-y-0.5 pl-1">
              {steps.map((s, i) => (
                <motion.li key={s.label + i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative flex items-center gap-3 py-1.5">
                  {i < steps.length - 1 && <span className="absolute left-[9px] top-[24px] h-[calc(100%-12px)] w-px bg-white/[0.08]" />}
                  <span className="relative flex h-[19px] w-[19px] shrink-0 items-center justify-center">
                    {s.state === "done" ? (
                      <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full" style={{ background: `${agent.color}22`, color: agent.color }}>
                        <Icon name="check" className="h-3 w-3" strokeWidth={2.4} />
                      </span>
                    ) : s.state === "active" ? (
                      <span className="relative flex h-[19px] w-[19px] items-center justify-center">
                        <span className="breathe absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 1px ${agent.color}88, 0 0 12px ${agent.color}66` }} />
                        <span className="h-2 w-2 rounded-full" style={{ background: agent.color }} />
                      </span>
                    ) : (
                      <span className="h-[11px] w-[11px] rounded-full border border-white/20" />
                    )}
                  </span>
                  <span className={`text-[13.5px] ${s.state === "done" ? "text-mist" : s.state === "active" ? "font-medium text-white" : s.state === "skip" ? "text-haze line-through" : "text-haze"}`}>{s.label}</span>
                </motion.li>
              ))}
            </ol>
          </section>
        )}

        {/* thread */}
        {agent.thread.length > 0 && (
          <section>
            <div className="mb-2.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-haze">Conversation</div>
            <div ref={threadRef} className="scroll-thin max-h-48 space-y-2 overflow-y-auto">
              {agent.thread.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.from === "user" ? "justify-end" : ""}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${m.from === "user" ? "rounded-br-md bg-white/[0.08]" : "rounded-bl-md"}`} style={m.from === "agent" ? { background: `${agent.color}14`, boxShadow: `inset 0 0 0 1px ${agent.color}22` } : undefined}>
                    {m.text}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* activity */}
        <section>
          <div className="mb-2.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-haze">Recent activity</div>
          {recent.length === 0 ? (
            <div className="text-[13px] text-haze">No activity yet.</div>
          ) : (
            <ul className="space-y-2">
              {recent.map((a) => (
                <li key={a.id} className="flex gap-3 text-[12.5px]">
                  <span className="w-7 shrink-0 font-mono text-[11px] text-haze">{timeAgo(a.at)}</span>
                  <span className="text-mist">{a.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.14em] text-haze">About</div>
          <p className="text-[13px] leading-relaxed text-mist">{agent.description}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {agent.skills.map((s) => (
              <span key={s} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11.5px] text-mist">{s}</span>
            ))}
          </div>
        </section>
      </div>

      {/* actions + input */}
      <div className="space-y-3 border-t border-white/[0.06] p-4">
        <div className="grid grid-cols-4 gap-2">
          <ActionBtn icon={paused ? "play" : "pause"} label={paused ? "Resume" : "Pause"} disabled={!canControl} onClick={() => dispatch({ type: paused ? "RESUME" : "PAUSE", agentId })} />
          <ActionBtn icon="x" label="Cancel" disabled={!canControl} danger onClick={() => dispatch({ type: "CANCEL", agentId })} />
          <ActionBtn icon="open" label="Open Work" disabled={!hasWork} onClick={() => dispatch({ type: "OPEN_WORK", agentId })} wide />
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] px-3.5 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] focus-within:shadow-[inset_0_0_0_1px_rgba(196,155,255,0.45)]">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={task?.status === "needs-input" ? `Answer ${agent.name}…` : "Message this agent..."}
            className="flex-1 bg-transparent py-1 text-[14px] placeholder:text-haze focus:outline-none"
          />
          <button onClick={send} disabled={!text.trim()} className="rounded-lg p-1.5 transition disabled:opacity-30" style={{ color: agent.color }} aria-label="Send to agent">
            <Icon name="send" />
          </button>
        </div>
      </div>
    </>
  );
}

function ActionBtn({ icon, label, onClick, disabled, danger, wide }: { icon: "pause" | "play" | "x" | "open"; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; wide?: boolean }) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] px-2 py-2 text-[12.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white/[0.04] ${wide ? "col-span-2" : ""} ${danger ? "hover:text-[#ff8a6b]" : ""}`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label}
    </motion.button>
  );
}
