import path from "node:path";
import fs from "node:fs";

/** Minimal surface of node:sqlite (built into Node >= 22.5, no npm dependency). */
export interface Stmt {
  all(...p: unknown[]): Record<string, unknown>[];
  get(...p: unknown[]): Record<string, unknown> | undefined;
  run(...p: unknown[]): unknown;
}
export interface Db {
  exec(sql: string): void;
  prepare(sql: string): Stmt;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  password_hash TEXT,
  google_id     TEXT UNIQUE,
  created_at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS outbox (
  id         TEXT PRIMARY KEY,
  to_email   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  status     TEXT NOT NULL,
  error      TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id       TEXT NOT NULL,
  position INTEGER NOT NULL,
  name     TEXT NOT NULL,
  role     TEXT NOT NULL,
  custom   INTEGER NOT NULL DEFAULT 0,
  data     TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE TABLE IF NOT EXISTS projects (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id         TEXT NOT NULL,
  title      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  done_at    INTEGER,
  background INTEGER NOT NULL DEFAULT 0,
  data       TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE TABLE IF NOT EXISTS tasks (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id         TEXT NOT NULL,
  project_id TEXT NOT NULL,
  agent_id   TEXT NOT NULL,
  status     TEXT NOT NULL,
  progress   INTEGER NOT NULL DEFAULT 0,
  data       TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(user_id, project_id);
CREATE TABLE IF NOT EXISTS activity (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id       TEXT NOT NULL,
  at       INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  kind     TEXT NOT NULL,
  data     TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_activity_at ON activity(user_id, at DESC);
CREATE TABLE IF NOT EXISTS messages (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id      TEXT NOT NULL,
  at      INTEGER NOT NULL,
  role    TEXT NOT NULL,
  data    TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_messages_at ON messages(user_id, at);
`;

let instance: Db | null = null;

export function getDb(): Db {
  if (instance) return instance;
  const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "everyday.db");
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  // getBuiltinModule keeps the bundler from trying to resolve node:sqlite
  const sqlite = process.getBuiltinModule("node:sqlite") as unknown as { DatabaseSync: new (f: string) => Db } | undefined;
  if (!sqlite) throw new Error("node:sqlite is unavailable. Use Node.js 22.5 or newer.");
  const db = new sqlite.DatabaseSync(file);
  // v1 stored one shared snapshot with no owner; it only held demo data, so drop it
  const cols = db.prepare("PRAGMA table_info(agents)").all();
  if (cols.length && !cols.some((c) => c.name === "user_id")) {
    for (const t of ["agents", "projects", "tasks", "activity", "messages"]) db.exec(`DROP TABLE IF EXISTS ${t}`);
  }
  db.exec(SCHEMA);
  instance = db;
  return db;
}
