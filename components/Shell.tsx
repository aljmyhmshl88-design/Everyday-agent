"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import AgentPanel from "./AgentPanel";
import Chat from "./Chat";
import CommandHud from "./CommandHud";
import Constellation from "./Constellation";
import { CreateAgentModal, WorkModal } from "./Modals";
import Nav from "./Nav";
import { ActivityView, TasksView, TeamView } from "./Views";

function Stage() {
  const { state } = useStore();
  const key = state.commandCenter ? "command" : state.view;
  return (
    <>
      <Constellation />
      <div className="vignette pointer-events-none fixed inset-0 z-[1]" />
      <Nav />
      <AnimatePresence mode="wait">
        {state.commandCenter ? (
          <CommandHud key="command" />
        ) : (
          <motion.div key={key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {state.view === "chat" && <Chat />}
            {state.view === "team" && <TeamView />}
            {state.view === "tasks" && <TasksView />}
            {state.view === "activity" && <ActivityView />}
          </motion.div>
        )}
      </AnimatePresence>
      <AgentPanel />
      <CreateAgentModal />
      <WorkModal />
    </>
  );
}

export default function Shell() {
  // client-only: the simulation is time- and random-driven
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <main className="space-bg fixed inset-0">
      {mounted && (
        <MotionConfig reducedMotion="user">
          <StoreProvider>
            <Stage />
          </StoreProvider>
        </MotionConfig>
      )}
    </main>
  );
}
