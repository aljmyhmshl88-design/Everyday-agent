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

## Backend & database

Next.js route handlers + SQLite via Node's built-in `node:sqlite` (no extra dependency; needs **Node >= 22.5**).

- `lib/db.ts` — opens `data/everyday.db` (override with `DATABASE_PATH`), creates the schema (agents, projects, tasks, activity, messages)
- `lib/repo.ts` — load / atomically save / reset the snapshot, with input validation
- `GET /api/state` — stored snapshot (or `{ empty: true }` on first run)
- `POST /api/state` — replace the stored snapshot (the client autosaves every 4s when something changed, and on page hide)
- `DELETE /api/state` — wipe the database; reload to re-seed the demo team
- `GET /api/health` — database check

On load the client hydrates from the API; if the API is unreachable it falls back to the in-memory demo, so the UI never breaks.
