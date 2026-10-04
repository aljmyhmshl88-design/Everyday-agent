"use client";

import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from "react";
import { currentTask, initialState, reducer, type Action } from "./sim";
import type { State } from "./types";

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action>; stateRef: { current: State } } | null>(null);

export function StoreProvider({ children, persist = true }: { children: ReactNode; persist?: boolean }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const hydrated = useRef(false);
  const lastSaved = useRef("");

  // load persisted state once; fall back to the seeded demo team if the API is unavailable
  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    fetch("/api/state")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d && !d.empty && d.snapshot) dispatch({ type: "HYDRATE", snapshot: d.snapshot });
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [persist]);


  // ---- real AI: ask the server whether a key is configured
  useEffect(() => {
    if (!persist) return;
    fetch("/api/ai/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && dispatch({ type: "AI_STATUS", enabled: !!d.enabled }))
      .catch(() => {});
  }, [persist]);

  // ---- real AI: fire requests for plans, task deliverables and agent replies
  const inflight = useRef(new Set<string>());
  useEffect(() => {
    if (!persist || !state.ai) return;
    const post = (url: string, body: unknown) =>
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
    const once = (key: string, go: () => void) => {
      if (inflight.current.has(key)) return;
      inflight.current.add(key);
      go();
    };
    const info = (id: string) => {
      const a = state.agents.find((x) => x.id === id);
      return a && { id: a.id, name: a.name, role: a.role, description: a.description };
    };

    // 1. Atlas plans (or just answers)
    for (const p of state.pending) {
      if (!p.ai || p.requested) continue;
      once(`plan:${p.messageId}`, () => {
        dispatch({ type: "PLAN_REQUESTED", messageId: p.messageId });
        const history = state.messages.filter((m) => !m.typing && m.text).slice(-9, -1).map((m) => ({ role: m.role === "user" ? "user" : "atlas", text: m.text }));
        const status = state.projects
          .filter((pr) => !pr.background && !pr.doneAt)
          .map((pr) => `${pr.title}: ${pr.taskIds.map((id) => state.tasks[id]).filter(Boolean).map((t) => `${state.agents.find((a) => a.id === t.agentId)?.name} ${t.status} ${t.progress}%`).join(", ")}`)
          .join("\n");
        post("/api/ai/plan", { prompt: p.prompt, agents: state.agents.map((a) => info(a.id)), history, status })
          .then((d) => dispatch({ type: "PLAN_READY", messageId: p.messageId, plan: d.plan }))
          .catch(() => dispatch({ type: "PLAN_FAILED", messageId: p.messageId }));
      });
    }

    // 2. each agent writes its deliverable once its task is running
    for (const t of Object.values(state.tasks)) {
      if (!t.ai || t.requested || t.output || t.status !== "working") continue;
      once(`task:${t.id}`, () => {
        dispatch({ type: "TASK_REQUESTED", taskId: t.id });
        const project = state.projects.find((p) => p.id === t.projectId);
        const upstream = t.dependsOn.map((d) => state.tasks[d]).filter((x) => x && x.output).map((x) => ({ agent: state.agents.find((a) => a.id === x.agentId)?.name ?? "", title: x.title, output: x.output }));
        post("/api/ai/work", { agent: info(t.agentId), request: project?.prompt ?? "", projectTitle: project?.title ?? "", taskTitle: t.title, steps: t.steps, upstream })
          .then((d) => dispatch({ type: "TASK_OUTPUT", taskId: t.id, output: d.output }))
          .catch(() => dispatch({ type: "TASK_OUTPUT", taskId: t.id, failed: true }));
      });
    }

    // 3. direct messages to an agent
    for (const a of state.agents) {
      for (const m of a.thread) {
        if (!m.typing || m.requested) continue;
        once(`agent:${m.id}`, () => {
          dispatch({ type: "AGENT_REQUESTED", agentId: a.id, msgId: m.id });
          const tk = currentTask(state, a.id);
          const taskLine = tk ? `Your current task: "${tk.title}" (${tk.status}, ${tk.progress}% done, step list: ${tk.steps.join(" → ")}).${tk.output ? ` What you produced so far:\n${tk.output.slice(0, 1200)}` : ""}` : "You have no task right now.";
          post("/api/ai/chat", { agent: info(a.id), thread: a.thread.filter((x) => !x.typing).map((x) => ({ from: x.from, text: x.text })), taskLine })
            .then((d) => dispatch({ type: "AGENT_REPLY", agentId: a.id, msgId: m.id, text: d.text }))
            .catch(() => dispatch({ type: "AGENT_REPLY", agentId: a.id, msgId: m.id, failed: true }));
        });
      }
    }
  }, [state, persist]);

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "TICK", now: Date.now() }), 800);
    return () => clearInterval(id);
  }, []);

  // autosave: every few seconds, only when something changed
  useEffect(() => {
    if (!persist) return;
    const body = () => {
      const s = stateRef.current;
      return JSON.stringify({ agents: s.agents.map((a) => ({ ...a, thread: a.thread.filter((m) => !m.typing) })), projects: s.projects, tasks: Object.values(s.tasks), activity: s.activity, messages: s.messages.filter((m) => !m.typing) });
    };
    const save = (beacon = false) => {
      if (!hydrated.current) return;
      const b = body();
      if (b === lastSaved.current) return;
      lastSaved.current = b;
      if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/state", new Blob([b], { type: "application/json" }));
      else fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: b, keepalive: true }).catch(() => (lastSaved.current = ""));
    };
    const id = setInterval(() => save(), 4000);
    const onHide = () => save(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", onHide);
    };
  }, [persist]);

  return <Ctx.Provider value={{ state, dispatch, stateRef }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used inside StoreProvider");
  return c;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
