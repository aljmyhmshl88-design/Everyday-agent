# Everyday — AI agent workforce (frontend MVP)

Next.js + TypeScript + Tailwind v4 + Framer Motion. A cinematic chat-first UI where every agent is a star in a living, canvas-rendered constellation. All work is simulated locally (no backend).

```bash
npm install
npm run dev   # http://localhost:3000
```

- `lib/sim.ts` — planner, simulation reducer (tasks, handoffs, needs-input, errors), agent generator
- `lib/store.tsx` — shared state + 800ms simulation tick
- `components/Constellation.tsx` — single `<canvas>`: star field, parallax, agent states, links, transfer packets, star birth, command-center zoom
- `components/*` — Chat, AgentPanel, Team/Tasks/Activity views, Create Agent, Command Center HUD
