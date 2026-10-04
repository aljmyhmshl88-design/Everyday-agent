"use client";

import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from "react";
import { initialState, reducer, type Action } from "./sim";
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

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "TICK", now: Date.now() }), 800);
    return () => clearInterval(id);
  }, []);

  // autosave: every few seconds, only when something changed
  useEffect(() => {
    if (!persist) return;
    const body = () => {
      const s = stateRef.current;
      return JSON.stringify({ agents: s.agents, projects: s.projects, tasks: Object.values(s.tasks), activity: s.activity, messages: s.messages.filter((m) => !m.typing) });
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
