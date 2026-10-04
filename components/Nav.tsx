"use client";

import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import type { View } from "@/lib/types";
import { Icon } from "./ui";

const ITEMS: { id: View; label: string; icon: "chat" | "team" | "tasks" | "activity" }[] = [
  { id: "chat", label: "Chat", icon: "chat" },
  { id: "team", label: "Team", icon: "team" },
  { id: "tasks", label: "Tasks", icon: "tasks" },
  { id: "activity", label: "Activity", icon: "activity" },
];

export default function Nav() {
  const { state, dispatch } = useStore();
  const working = state.agents.filter((a) => ["working", "thinking"].includes(a.status)).length;
  const attention = state.agents.filter((a) => a.status === "needs-input").length;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <div className="pointer-events-auto flex items-center gap-2.5">
        <div className="relative flex h-8 w-8 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(196,155,255,0.55),transparent_70%)]" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_12px_4px_rgba(220,210,255,0.8)]" />
        </div>
        <div className="hidden leading-none sm:block">
          <div className="text-[15px] font-semibold tracking-tight">Everyday</div>
          <div className="mt-1 text-[10.5px] tracking-wide text-haze">
            {working} active{attention ? <span className="text-[#ffc86e]"> · {attention} needs you</span> : null}
          </div>
        </div>
      </div>

      <nav className="glass pointer-events-auto flex items-center gap-0.5 rounded-full p-1">
        {ITEMS.map((it) => {
          const active = state.view === it.id && !state.commandCenter;
          return (
            <button
              key={it.id}
              onClick={() => dispatch({ type: "VIEW", view: it.id })}
              className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-colors ${active ? "text-white" : "text-mist hover:text-white"}`}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-full bg-white/[0.09] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <Icon name={it.icon} className="relative h-4 w-4 sm:hidden" />
              <span className="relative hidden sm:inline">{it.label}</span>
              {it.id === "activity" && attention > 0 && <span className="relative h-1.5 w-1.5 rounded-full bg-[#ffc86e] shadow-[0_0_8px_#ffc86e]" />}
            </button>
          );
        })}
        <span className="mx-1 h-4 w-px bg-white/10" />
        <button
          onClick={() => dispatch({ type: "CREATE_OPEN", open: true })}
          className="group relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-white transition hover:bg-white/[0.07]"
        >
          <Icon name="plus" className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" />
          <span className="hidden sm:inline">Create Agent</span>
        </button>
      </nav>

      <button
        onClick={() => dispatch({ type: "COMMAND" })}
        className={`glass pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] transition ${state.commandCenter ? "text-white shadow-[0_0_30px_-4px_rgba(196,155,255,0.6)]" : "text-mist hover:text-white"}`}
        aria-pressed={state.commandCenter}
      >
        <Icon name="orbit" className="h-4 w-4" />
        <span className="hidden md:inline">{state.commandCenter ? "Exit map" : "Command Center"}</span>
      </button>
    </header>
  );
}
