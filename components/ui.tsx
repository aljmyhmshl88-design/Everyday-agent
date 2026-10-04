"use client";

import { motion } from "framer-motion";
import type { AgentStatus, TaskStatus } from "@/lib/types";

type IconName =
  | "send" | "check" | "pause" | "play" | "x" | "open" | "plus" | "sparkle"
  | "chat" | "team" | "tasks" | "activity" | "orbit" | "arrow" | "alert" | "dot";

const PATHS: Record<IconName, string> = {
  send: "M5 12h13M13 6l6 6-6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  pause: "M9 6v12M15 6v12",
  play: "M8 5.5v13l11-6.5z",
  x: "M6 6l12 12M18 6L6 18",
  open: "M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h4",
  plus: "M12 5v14M5 12h14",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  chat: "M5 6.5A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5v7a2.5 2.5 0 01-2.5 2.5H10l-4 3.5V16a2.5 2.5 0 01-1-2z",
  team: "M9 11a3 3 0 100-6 3 3 0 000 6zM3.5 19a5.5 5.5 0 0111 0M16 11a2.5 2.5 0 100-5M17.5 19H20.5a4.5 4.5 0 00-3.5-4.4",
  tasks: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  activity: "M3 12h4l3-7 4 14 3-7h4",
  orbit: "M12 14a2 2 0 100-4 2 2 0 000 4zM4.5 8.5C7 4 17 4 19.5 8.5M19.5 15.5C17 20 7 20 4.5 15.5",
  arrow: "M7 17L17 7M9 7h8v8",
  alert: "M12 8v5M12 16.5v.01M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  dot: "M12 12h.01",
};

export function Icon({ name, className = "h-4 w-4", strokeWidth = 1.6 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

export const STATUS_META: Record<AgentStatus | TaskStatus, { label: string; color: string }> = {
  idle: { label: "Idle", color: "#6b7392" },
  thinking: { label: "Thinking", color: "#a99bff" },
  working: { label: "Working", color: "#6ff0c6" },
  waiting: { label: "Waiting", color: "#8aa6ff" },
  "needs-input": { label: "Needs input", color: "#ffc86e" },
  complete: { label: "Complete", color: "#e9e6ff" },
  error: { label: "Issue", color: "#ff8a6b" },
  paused: { label: "Paused", color: "#8b90a8" },
  queued: { label: "Queued", color: "#6b7392" },
  cancelled: { label: "Cancelled", color: "#5b6078" },
};

export function StatusPill({ status, className = "" }: { status: AgentStatus | TaskStatus; className?: string }) {
  const m = STATUS_META[status];
  const animated = status === "working" || status === "thinking" || status === "needs-input" || status === "waiting";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${className}`}
      style={{ color: m.color, background: `${m.color}14`, boxShadow: `inset 0 0 0 1px ${m.color}26` }}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${animated ? "breathe" : ""}`} style={{ background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
      {m.label}
    </span>
  );
}

export function Progress({ value, color = "#c49bff", className = "" }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`relative h-1 overflow-hidden rounded-full bg-white/[0.06] ${className}`}>
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}66, ${color})`, boxShadow: `0 0 12px ${color}88` }}
        initial={false}
        animate={{ width: `${value}%` }}
        transition={{ type: "spring", stiffness: 60, damping: 18 }}
      />
    </div>
  );
}

export function AgentOrb({ color, size = 28, active = false }: { color: string; size?: number; active?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <span
        className={`absolute inset-0 rounded-full ${active ? "breathe" : ""}`}
        style={{ background: `radial-gradient(circle, ${color}cc 0%, ${color}33 38%, transparent 70%)` }}
      />
      <span className="relative rounded-full bg-white" style={{ width: size * 0.16, height: size * 0.16, boxShadow: `0 0 ${size / 3}px ${color}` }} />
    </span>
  );
}

export function timeAgo(at: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`;
}
