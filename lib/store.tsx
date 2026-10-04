"use client";

import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from "react";
import { initialState, reducer, type Action } from "./sim";
import type { State } from "./types";

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action>; stateRef: { current: State } } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "TICK", now: Date.now() }), 800);
    return () => clearInterval(id);
  }, []);

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
