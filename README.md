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
- `GET /api/state` — the signed-in user's stored snapshot (or `{ empty: true }` on first run). All state routes require a session (401 otherwise)
- `POST /api/state` — replace the stored snapshot (the client autosaves every 4s when something changed, and on page hide)
- `DELETE /api/state` — wipe the database; reload to re-seed the demo team
- `GET /api/health` — database check

On load the client hydrates from the API; if the API is unreachable it falls back to the in-memory demo, so the UI never breaks.

## Accounts & login

Copy `.env.example` to `.env.local` and fill in what you need.

- **Email + password:** `POST /api/auth/signup` and `/api/auth/login`. Passwords are hashed with scrypt, sessions are random tokens stored hashed in SQLite and sent as an `HttpOnly` `SameSite=Lax` cookie (30 days). Login is rate limited, and JSON-only POSTs block CSRF.
- **Welcome email:** sent on signup (and on first Google sign-in). Set `RESEND_API_KEY` + `MAIL_FROM` to deliver real email; without them it is logged and saved in the `outbox` table.
- **Continue with Google:** real OAuth (authorization code flow with a state check). Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `APP_URL`, and add `APP_URL/api/auth/google/callback` as an authorized redirect URI. The button appears only when configured.
- **Per-user data:** every table is keyed by user, so each account has its own agents, tasks and chat.
- `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/config`
