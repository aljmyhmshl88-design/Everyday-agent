"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";
import ProjectCard from "./ProjectCard";
import { AgentOrb, Icon } from "./ui";

const SUGGESTIONS = [
  "Build my startup website",
  "Plan a product launch campaign",
  "Analyze last month's metrics",
  "Research our top competitors",
];

export function Composer({ autoFocus = false, compact = false }: { autoFocus?: boolean; compact?: boolean }) {
  const { state, dispatch } = useStore();
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingQ = Object.values(state.tasks).find((t) => t.status === "needs-input");
  const pendingAgent = pendingQ && state.agents.find((a) => a.id === pendingQ.agentId);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const send = () => {
    const v = text.trim();
    if (!v) return;
    dispatch({ type: "USER_MESSAGE", text: v });
    setText("");
  };

  return (
    <div className={`group relative rounded-2xl transition ${compact ? "" : "p-px"} bg-gradient-to-b from-white/[0.14] to-white/[0.04] focus-within:from-[#c49bff]/50 focus-within:to-[#62d4ff]/20`}>
      <div className="flex items-end gap-2 rounded-2xl bg-[#0b0e1c]/90 px-4 py-3 backdrop-blur-xl">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={pendingAgent ? `Reply to ${pendingAgent.name}…` : "Ask your team to do anything..."}
          className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[15px] leading-6 text-white placeholder:text-haze focus:outline-none"
        />
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={send}
          disabled={!text.trim()}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#0b0e1c] shadow-[0_0_24px_-4px_rgba(196,155,255,0.8)] transition disabled:bg-white/10 disabled:text-haze disabled:shadow-none"
        >
          <Icon name="send" className="h-4 w-4" strokeWidth={2} />
        </motion.button>
      </div>
    </div>
  );
}

function Message({ m }: { m: ChatMessage }) {
  const { state, dispatch } = useStore();
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-2.5 text-[14.5px] leading-relaxed shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          {m.text}
        </div>
      </div>
    );
  }
  const agent = state.agents.find((a) => a.id === (m.role === "atlas" ? "atlas" : m.agentId));
  return (
    <div className="flex gap-3">
      <button onClick={() => agent && dispatch({ type: "SELECT", id: agent.id })} className="mt-0.5 shrink-0" aria-label={`Open ${agent?.name}`}>
        <AgentOrb color={agent?.color ?? "#fff"} size={28} active={m.typing} />
      </button>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-baseline gap-2 text-[12px]">
          <span className="font-medium text-white">{agent?.name}</span>
          <span className="text-haze">{agent?.role}</span>
        </div>
        {m.typing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[13.5px] text-mist">
              Planning
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="typing-dot h-1 w-1 rounded-full bg-mist" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            </div>
            <div className="shimmer h-2 w-3/4 rounded-full" />
            <div className="shimmer h-2 w-1/2 rounded-full" />
          </div>
        ) : (
          <p className="text-[14.5px] leading-relaxed text-[#dfe2f5]">{m.text}</p>
        )}
        {m.options && m.taskId && (
          <div className="flex flex-wrap gap-2">
            {m.options.map((o) => (
              <motion.button
                key={o}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => dispatch({ type: "ANSWER", taskId: m.taskId!, answer: o })}
                className="rounded-full px-3 py-1.5 text-[12.5px] text-white transition"
                style={{ background: `${agent?.color}1a`, boxShadow: `inset 0 0 0 1px ${agent?.color}44` }}
              >
                {o}
              </motion.button>
            ))}
          </div>
        )}
        {m.projectId && !m.typing && <ProjectCard projectId={m.projectId} compact={!!state.projects.find((p) => p.id === m.projectId)?.doneAt && m.text.includes("complete")} />}
      </div>
    </div>
  );
}

export default function Chat() {
  const { state, dispatch } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const empty = state.messages.length === 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [state.messages.length]);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center px-4 pb-6 pt-24 sm:pt-28">
      <motion.div
        layout
        className={`pointer-events-auto flex w-full max-w-[640px] flex-col ${empty ? "" : "glass h-full max-h-[720px] rounded-[28px]"}`}
        transition={{ type: "spring", stiffness: 140, damping: 22 }}
      >
        {empty ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} className="text-center">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11.5px] text-mist backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#6ff0c6] shadow-[0_0_8px_#6ff0c6]" />
              {state.agents.length} agents online · Atlas orchestrating
            </div>
            <h1 className="text-gradient text-balance text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[48px]">
              What should your team
              <br />
              build today?
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-mist">
              Describe the outcome. Atlas plans the work and your agents light up to get it done.
            </p>
            <div className="mt-8 text-left">
              <Composer autoFocus />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.07 }}
                  whileHover={{ y: -2 }}
                  onClick={() => dispatch({ type: "USER_MESSAGE", text: s })}
                  className="glass-soft rounded-full px-3.5 py-1.5 text-[12.5px] text-mist backdrop-blur transition-colors hover:border-white/20 hover:text-white"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <AgentOrb color="#E9E6FF" size={22} active />
                <div className="text-[13px] font-medium">Atlas</div>
                <div className="text-[12px] text-haze">Orchestrator</div>
              </div>
              <div className="text-[11.5px] text-haze">Click any star to talk to an agent</div>
            </div>
            <div
              ref={scrollRef}
              className="scroll-thin flex-1 space-y-6 overflow-y-auto px-5 py-6"
              style={{ maskImage: "linear-gradient(to bottom, transparent, black 24px, black calc(100% - 12px), transparent)" }}
            >
              <AnimatePresence initial={false}>
                {state.messages.map((m) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}>
                    <Message m={m} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="p-3 pt-0">
              <Composer autoFocus />
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
