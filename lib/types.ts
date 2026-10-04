export type AgentStatus =
  | "idle"
  | "thinking"
  | "working"
  | "waiting"
  | "needs-input"
  | "complete"
  | "error"
  | "paused";

export type TaskStatus =
  | "queued"
  | "thinking"
  | "working"
  | "needs-input"
  | "error"
  | "paused"
  | "complete"
  | "cancelled";

export interface Agent {
  id: string;
  name: string;
  role: string;
  color: string;
  description: string;
  skills: string[];
  status: AgentStatus;
  statusSince: number;
  bornAt?: number;
  custom?: boolean;
  /** direct messages between the user and this agent */
  thread: { id: string; from: "user" | "agent"; text: string; at: number; typing?: boolean; requested?: boolean }[];
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  agentId: string;
  status: TaskStatus;
  /** status to restore after pause */
  resumeTo?: TaskStatus;
  progress: number;
  steps: string[];
  dependsOn: string[];
  ticks: number;
  /** earliest time this task may start */
  startAt?: number;
  askAt?: number;
  question?: { text: string; options: string[] };
  askedAt?: number;
  errorAt?: number;
  errorNote?: string;
  completedAt?: number;
  output?: string;
  /** work is produced by the real AI (output arrives from the server) */
  ai?: boolean;
  requested?: boolean;
}

export interface Project {
  id: string;
  title: string;
  prompt: string;
  createdAt: number;
  taskIds: string[];
  background?: boolean;
  doneAt?: number;
}

export interface Activity {
  id: string;
  at: number;
  agentId: string;
  text: string;
  kind: "info" | "start" | "complete" | "handoff" | "alert" | "user";
}

export interface ChatMessage {
  id: string;
  at: number;
  role: "user" | "atlas" | "agent";
  agentId?: string;
  text: string;
  projectId?: string;
  typing?: boolean;
  taskId?: string;
  options?: string[];
}

export interface Transfer {
  id: string;
  from: string;
  to: string;
  at: number;
}

export interface PendingPlan {
  prompt: string;
  /** simulated plans materialize at this time; for AI plans it is the timeout that falls back to the simulation */
  readyAt: number;
  messageId: string;
  ai?: boolean;
  requested?: boolean;
}

/** A plan produced by the AI (validated server-side). */
export interface AiPlan {
  title: string;
  reply: string;
  tasks: { key: string; agentId: string; title: string; steps: string[]; deps: string[]; ask?: { text: string; options: string[] } }[];
}

export type View = "chat" | "team" | "tasks" | "activity";

export interface State {
  agents: Agent[];
  tasks: Record<string, Task>;
  projects: Project[];
  activity: Activity[];
  messages: ChatMessage[];
  transfers: Transfer[];
  pending: PendingPlan[];
  selectedAgentId: string | null;
  view: View;
  commandCenter: boolean;
  createOpen: boolean;
  workAgentId: string | null;
  /** the server has an AI key configured */
  ai: boolean;
}
