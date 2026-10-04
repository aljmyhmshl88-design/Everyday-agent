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

CREATE TABLE IF NOT EXISTS agents (
  id       TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  name     TEXT NOT NULL,
  role     TEXT NOT NULL,
  custom   INTEGER NOT NULL DEFAULT 0,
  data     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  done_at    INTEGER,
  background INTEGER NOT NULL DEFAULT 0,
  data       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  agent_id   TEXT NOT NULL,
  status     TEXT NOT NULL,
  progress   INTEGER NOT NULL DEFAULT 0,
  data       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_agent   ON tasks(agent_id);
CREATE TABLE IF NOT EXISTS activity (
  id       TEXT PRIMARY KEY,
  at       INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  kind     TEXT NOT NULL,
  data     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_at ON activity(at DESC);
CREATE TABLE IF NOT EXISTS messages (
  id   TEXT PRIMARY KEY,
  at   INTEGER NOT NULL,
  role TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_at ON messages(at);
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
  db.exec(SCHEMA);
  instance = db;
  return db;
}
