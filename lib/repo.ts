import { getDb } from "./db";
import type { Activity, Agent, ChatMessage, Project, Task } from "./types";

/** The slice of client state that is worth persisting. Transient animation state is not stored. */
export interface Snapshot {
  agents: Agent[];
  projects: Project[];
  tasks: Task[];
  activity: Activity[];
  messages: ChatMessage[];
}

const TABLES = ["agents", "projects", "tasks", "activity", "messages"];
const parse = <T>(rows: Record<string, unknown>[]) => rows.map((r) => JSON.parse(r.data as string) as T);

export function isEmpty(userId: string): boolean {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM agents WHERE user_id = ?").get(userId)?.n as number) === 0;
}

export function loadSnapshot(userId: string): Snapshot {
  const db = getDb();
  return {
    agents: parse<Agent>(db.prepare("SELECT data FROM agents WHERE user_id = ? ORDER BY position").all(userId)),
    projects: parse<Project>(db.prepare("SELECT data FROM projects WHERE user_id = ? ORDER BY created_at").all(userId)),
    tasks: parse<Task>(db.prepare("SELECT data FROM tasks WHERE user_id = ?").all(userId)),
    activity: parse<Activity>(db.prepare("SELECT data FROM activity WHERE user_id = ? ORDER BY at DESC LIMIT 200").all(userId)),
    messages: parse<ChatMessage>(db.prepare("SELECT data FROM messages WHERE user_id = ? ORDER BY at").all(userId)),
  };
}

/** Replace the stored snapshot atomically. */
export function saveSnapshot(userId: string, s: Snapshot): void {
  const db = getDb();
  db.exec("BEGIN");
  try {
    for (const t of TABLES) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId);
    const insAgent = db.prepare("INSERT INTO agents (user_id, id, position, name, role, custom, data) VALUES (?, ?, ?, ?, ?, ?, ?)");
    s.agents.forEach((a, i) => insAgent.run(userId, a.id, i, a.name, a.role, a.custom ? 1 : 0, JSON.stringify(a)));
    const insProject = db.prepare("INSERT INTO projects (user_id, id, title, created_at, done_at, background, data) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const p of s.projects) insProject.run(userId, p.id, p.title, p.createdAt, p.doneAt ?? null, p.background ? 1 : 0, JSON.stringify(p));
    const insTask = db.prepare("INSERT INTO tasks (user_id, id, project_id, agent_id, status, progress, data) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const t of s.tasks) insTask.run(userId, t.id, t.projectId, t.agentId, t.status, t.progress, JSON.stringify(t));
    const insAct = db.prepare("INSERT INTO activity (user_id, id, at, agent_id, kind, data) VALUES (?, ?, ?, ?, ?, ?)");
    for (const a of s.activity) insAct.run(userId, a.id, a.at, a.agentId, a.kind, JSON.stringify(a));
    const insMsg = db.prepare("INSERT INTO messages (user_id, id, at, role, data) VALUES (?, ?, ?, ?, ?)");
    for (const m of s.messages) insMsg.run(userId, m.id, m.at, m.role, JSON.stringify(m));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function resetAll(userId: string): void {
  const db = getDb();
  for (const t of TABLES) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId);
}

/** Light validation so a bad client cannot write junk into the database. */
export function parseSnapshot(body: unknown): Snapshot | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const arr = (k: string) => (Array.isArray(b[k]) ? (b[k] as Record<string, unknown>[]) : null);
  const agents = arr("agents"), projects = arr("projects"), tasks = arr("tasks"), activity = arr("activity"), messages = arr("messages");
  if (!agents || !projects || !tasks || !activity || !messages) return null;
  const ok = (xs: Record<string, unknown>[], keys: string[]) => xs.every((x) => x && typeof x === "object" && keys.every((k) => k in x));
  if (!ok(agents, ["id", "name", "role"]) || !ok(projects, ["id", "title", "createdAt"]) || !ok(tasks, ["id", "projectId", "agentId", "status", "progress"]) || !ok(activity, ["id", "at", "agentId", "kind"]) || !ok(messages, ["id", "at", "role"])) return null;
  if (agents.length > 200 || tasks.length > 5000 || activity.length > 1000 || messages.length > 5000) return null;
  return { agents, projects, tasks, activity, messages } as unknown as Snapshot;
}
