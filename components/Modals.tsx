"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { generateAgentProfile } from "@/lib/sim";
import { AgentOrb, Icon } from "./ui";

function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#02030a]/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 12, scale: 0.98, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className={`glass relative w-full ${wide ? "max-w-[640px]" : "max-w-[520px]"} overflow-hidden rounded-[26px]`}
          >
            <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full p-2 text-haze transition hover:bg-white/[0.06] hover:text-white" aria-label="Close">
              <Icon name="x" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const IDEAS = [
  "Create an agent that monitors my website for bugs.",
  "An agent that answers customer support emails.",
  "An agent that posts on LinkedIn every week.",
  "An agent that tracks invoices and expenses.",
];

type Profile = ReturnType<typeof generateAgentProfile>;

export function CreateAgentModal() {
  const { state, dispatch } = useStore();
  const [desc, setDesc] = useState("");
  const [phase, setPhase] = useState<"input" | "generating" | "preview">("input");
  const [profile, setProfile] = useState<Profile | null>(null);
  const close = () => dispatch({ type: "CREATE_OPEN", open: false });

  useEffect(() => {
    if (state.createOpen) {
      setPhase("input");
      setDesc("");
      setProfile(null);
    }
  }, [state.createOpen]);

  const generate = () => {
    if (!desc.trim()) return;
    setPhase("generating");
    setTimeout(() => {
      setProfile(generateAgentProfile(desc, state.agents.map((a) => a.name)));
      setPhase("preview");
    }, 1300);
  };

  const add = () => {
    if (!profile) return;
    dispatch({ type: "ADD_AGENT", agent: profile });
    dispatch({ type: "VIEW", view: "chat" });
    dispatch({ type: "COMMAND", on: true });
  };

  return (
    <Modal open={state.createOpen} onClose={close}>
      <div className="p-6 sm:p-7">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-haze">
          <Icon name="sparkle" className="h-3.5 w-3.5 text-[#c49bff]" /> New agent
        </div>
        <h3 className="mt-2 text-[22px] font-semibold tracking-tight">Describe your agent</h3>
        <p className="mt-1 text-[13.5px] text-mist">Say what it should do. We'll design the profile and bring a new star into your constellation.</p>

        <AnimatePresence mode="wait">
          {phase === "input" && (
            <motion.div key="in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <textarea
                autoFocus
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                    e.preventDefault();
                    generate();
                  }
                }}
                rows={3}
                placeholder="Create an agent that monitors my website for bugs."
                className="mt-5 w-full resize-none rounded-2xl bg-white/[0.04] p-4 text-[14.5px] leading-relaxed shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] placeholder:text-haze focus:shadow-[inset_0_0_0_1px_rgba(196,155,255,0.5)] focus:outline-none"
              />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {IDEAS.map((i) => (
                  <button key={i} onClick={() => setDesc(i)} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-mist transition hover:bg-white/[0.08] hover:text-white">
                    {i.replace(/^Create an agent that |^An agent that /, "").replace(/\.$/, "")}
                  </button>
                ))}
              </div>
              <button onClick={generate} disabled={!desc.trim()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-[14px] font-medium text-[#0b0e1c] transition hover:shadow-[0_0_30px_-6px_rgba(196,155,255,0.9)] disabled:bg-white/10 disabled:text-haze disabled:shadow-none">
                <Icon name="sparkle" className="h-4 w-4" /> Generate agent
              </button>
            </motion.div>
          )}
          {phase === "generating" && (
            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="shimmer h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="shimmer h-3 w-1/3 rounded-full" />
                  <div className="shimmer h-2.5 w-1/2 rounded-full" />
                </div>
              </div>
              <div className="shimmer h-2.5 w-full rounded-full" />
              <div className="shimmer h-2.5 w-4/5 rounded-full" />
              <div className="pt-2 text-center text-[12.5px] text-mist">Designing profile, skills and tools…</div>
            </motion.div>
          )}
          {phase === "preview" && profile && (
            <motion.div key="pv" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6">
              <div className="glass-soft relative overflow-hidden rounded-2xl p-5">
                <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-40 blur-3xl" style={{ background: profile.color }} />
                <div className="relative flex items-center gap-3.5">
                  <AgentOrb color={profile.color} size={48} active />
                  <div>
                    <div className="text-[19px] font-semibold tracking-tight">{profile.name}</div>
                    <div className="text-[13px] text-mist">{profile.role}</div>
                  </div>
                </div>
                <p className="relative mt-4 text-[13.5px] leading-relaxed text-[#dfe2f5]">{profile.description}</p>
                <div className="relative mt-3 flex flex-wrap gap-1.5">
                  {profile.skills.map((s) => (
                    <span key={s} className="rounded-full px-2.5 py-1 text-[11.5px]" style={{ background: `${profile.color}18`, color: profile.color }}>
                      {s}
                    </span>
                  ))}
                </div>
                <div className="relative mt-4 grid grid-cols-3 gap-2 text-center text-[11px] text-haze">
                  <div className="rounded-xl bg-white/[0.03] py-2"><div className="text-[13px] text-white">24/7</div>Schedule</div>
                  <div className="rounded-xl bg-white/[0.03] py-2"><div className="text-[13px] text-white">Atlas</div>Reports to</div>
                  <div className="rounded-xl bg-white/[0.03] py-2"><div className="text-[13px] text-white">3</div>Tools</div>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setPhase("input")} className="rounded-xl bg-white/[0.05] px-4 py-3 text-[13.5px] text-mist transition hover:text-white">Back</button>
                <button onClick={add} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3 text-[14px] font-medium text-[#0b0e1c] transition hover:shadow-[0_0_30px_-6px_rgba(196,155,255,0.9)]">
                  Add to constellation <Icon name="arrow" className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}

export function WorkModal() {
  const { state, dispatch } = useStore();
  const agent = state.agents.find((a) => a.id === state.workAgentId);
  const outputs = agent ? Object.values(state.tasks).filter((t) => t.agentId === agent.id && t.output).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)) : [];
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [state.workAgentId]);
  const cur = outputs[Math.min(idx, outputs.length - 1)];

  return (
    <Modal open={!!agent} onClose={() => dispatch({ type: "OPEN_WORK", agentId: null })} wide>
      {agent && (
        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <AgentOrb color={agent.color} size={32} />
            <div>
              <div className="text-[17px] font-semibold tracking-tight">{agent.name}'s work</div>
              <div className="text-[12.5px] text-mist">{outputs.length} deliverable{outputs.length === 1 ? "" : "s"}</div>
            </div>
          </div>
          {outputs.length > 1 && (
            <div className="scroll-thin mt-5 flex gap-1.5 overflow-x-auto pb-1">
              {outputs.map((o, i) => (
                <button key={o.id} onClick={() => setIdx(i)} className={`shrink-0 rounded-full px-3 py-1 text-[12px] transition ${i === idx ? "bg-white/[0.1] text-white" : "text-mist hover:text-white"}`}>
                  {o.title}
                </button>
              ))}
            </div>
          )}
          {cur && (
            <motion.pre key={cur.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="scroll-thin mt-4 max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-[#05070f]/80 p-5 font-mono text-[12.5px] leading-relaxed text-[#cfd4ee] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              {cur.output}
            </motion.pre>
          )}
        </div>
      )}
    </Modal>
  );
}
