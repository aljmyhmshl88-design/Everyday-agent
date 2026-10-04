"use client";

import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import type { View } from "@/lib/types";
import { useAuth } from "./Auth";
import { LogoMark, Wordmark } from "./Logo";
import { Icon } from "./ui";

const ITEMS: { id: View; label: string; icon: "chat" | "team" | "tasks" | "activity" }[] = [
  { id: "chat", label: "Chat", icon: "chat" },
  { id: "team", label: "Team", icon: "team" },
  { id: "tasks", label: "Tasks", icon: "tasks" },
  { id: "activity", label: "Activity", icon: "activity" },
];

export default function Nav() {
  const { state, dispatch } = useStore();
  const auth = useAuth();
  const working = state.agents.filter((a) => ["working", "thinking"].includes(a.status)).length;
  const attention = state.agents.filter((a) => a.status === "needs-input").length;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <div className="pointer-events-auto flex items-center gap-3 text-white">
        <LogoMark className="h-8 w-8 shrink-0" />
        <div className="hidden sm:block">
          <Wordmark className="text-[18px]" />
          <div className="mt-1.5 text-[10.5px] tracking-wide text-haze">
            {working} active{state.ai ? <span className="text-[#6ff0c6]"> · Claude live</span> : null}{attention ? <span className="text-[#ffc86e]"> · {attention} needs you</span> : null}
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

      <div className="pointer-events-auto flex items-center gap-2">
      <button
        onClick={() => dispatch({ type: "COMMAND" })}
        className={`glass pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] transition ${state.commandCenter ? "text-white shadow-[0_0_30px_-4px_rgba(196,155,255,0.6)]" : "text-mist hover:text-white"}`}
        aria-pressed={state.commandCenter}
      >
        <Icon name="orbit" className="h-4 w-4" />
        <span className="hidden md:inline">{state.commandCenter ? "Exit map" : "Command Center"}</span>
      </button>
      {auth && (
        <button onClick={auth.signOut} title={`Signed in as ${auth.user.email}. Click to sign out.`} className="glass group flex h-9 items-center gap-2 rounded-full pl-1 pr-3 text-[12.5px] text-mist transition hover:text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[12px] font-medium uppercase text-white">{(auth.user.name || auth.user.email)[0]}</span>
          <span className="hidden lg:inline">Sign out</span>
        </button>
      )}
      </div>
    </header>
  );
}
