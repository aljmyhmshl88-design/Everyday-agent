import Anthropic from "@anthropic-ai/sdk";
import type { AiPlan } from "./types";

/** Model for every call. Override with AI_MODEL. */
export const MODEL = process.env.AI_MODEL ?? "claude-opus-5-5";
export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

export class AiRefusal extends Error {}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

interface Resp {
  content: { type: string; text?: string }[];
  stop_reason: string | null;
}

/**
 * One Claude call. Opus 5.5 always thinks, so `effort` is the speed/depth control.
 * Refusal fallbacks (server-side, beta) are on by default; AI_FALLBACK=off disables them.
 */
async function ask(opts: { system: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens: number; effort: "low" | "medium" | "high" }): Promise<string> {
  const base = { model: MODEL, max_tokens: opts.maxTokens, system: opts.system, messages: opts.messages, output_config: { effort: opts.effort } };
  const withFallback = process.env.AI_FALLBACK !== "off";
  const run = (fb: boolean) =>
    (fb
      ? getClient().beta.messages.create({ ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } as never)
      : getClient().messages.create(base as never)) as unknown as Promise<Resp>;

  let res: Resp;
  try {
    res = await run(withFallback);
  } catch (e) {
    // an API that rejects the fallback parameter must not take the feature down
    if (withFallback && e instanceof Anthropic.BadRequestError) res = await run(false);
    else throw e;
  }
  if (res.stop_reason === "refusal") throw new AiRefusal("The AI declined this request.");
  return res.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
}

/* ------------------------------------------------------------------ plan */

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  description: string;
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

export async function planProject(prompt: string, agents: AgentInfo[], history: { role: string; text: string }[], status: string): Promise<AiPlan> {
  const team = agents.filter((a) => a.id !== "atlas");
  const roster = team.map((a) => `- ${a.id}: ${a.name}, ${a.role}. ${a.description}`).join("\n");
  const system = `You are Atlas, the orchestrator of the user's team of AI agents. You talk to the user directly, plan work, and delegate it.

Your team:
${roster}

Current status of the team:
${status || "Nobody is working right now."}

Reply with ONE JSON object and nothing else (no markdown fences), shaped exactly like:
{"title": string (max 50 chars, names the project), "reply": string (1-3 friendly, concrete sentences to the user), "tasks": [{"key": string (unique, lowercase), "agentId": one of the ids above, "title": string (max 60 chars), "steps": [3-4 short progress steps], "deps": [keys of tasks that must finish first, may be empty]}], "ask": null or {"text": string, "options": [2-3 short options], "taskKey": key of the task it blocks}}

Rules:
- If the user wants something done, plan 2-6 tasks, each assigned to the best-fit agent. Only use dependencies that make real sense (research before design, build before QA). Never create cycles.
- If the user is only chatting, asking a question, or asking for status, answer it in "reply" and return "tasks": [] with "ask": null.
- Only ask a question (ask) when a real decision changes the outcome. At most one.
- The reply says what you are going to do and who will do it. No hype, no emojis.`;
  const msgs = [
    ...history.slice(-6).map((m) => ({ role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant", content: clip(m.text, 1500) })).filter((m) => m.content),
    { role: "user" as const, content: clip(prompt, 4000) },
  ];
  // the API needs a user message first and strictly useful alternation
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  const text = await ask({ system, messages: msgs, maxTokens: 6000, effort: "low" });
  return parsePlan(text, team);
}

export function parsePlan(text: string, team: AgentInfo[]): AiPlan {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("Plan was not JSON");
  const raw = JSON.parse(text.slice(a, b + 1)) as Record<string, unknown>;
  const ids = new Set(team.map((t) => t.id));
  const tasksIn = Array.isArray(raw.tasks) ? (raw.tasks as Record<string, unknown>[]) : [];
  const seen = new Set<string>();
  const tasks: AiPlan["tasks"] = [];
  const askRaw = raw.ask as { text?: unknown; options?: unknown; taskKey?: unknown } | null;
  for (const t of tasksIn.slice(0, 6)) {
    const key = clip(t.key, 24).toLowerCase().replace(/[^a-z0-9_]/g, "") || `t${tasks.length + 1}`;
    const agentId = clip(t.agentId, 40);
    const title = clip(t.title, 60);
    if (!ids.has(agentId) || !title || seen.has(key)) continue;
    // dependencies may only point at tasks defined earlier, which rules out cycles
    const deps = (Array.isArray(t.deps) ? t.deps : []).map((d) => clip(d, 24).toLowerCase().replace(/[^a-z0-9_]/g, "")).filter((d) => seen.has(d));
    const steps = (Array.isArray(t.steps) ? t.steps : []).map((s) => clip(s, 40)).filter(Boolean).slice(0, 4);
    const task: AiPlan["tasks"][number] = { key, agentId, title, steps: steps.length >= 2 ? steps : ["Understanding", "Working", "Reviewing"], deps };
    if (askRaw && typeof askRaw === "object" && clip(askRaw.taskKey, 24).toLowerCase() === key && clip(askRaw.text, 200)) {
      const options = (Array.isArray(askRaw.options) ? askRaw.options : []).map((o) => clip(o, 40)).filter(Boolean).slice(0, 3);
      if (options.length >= 2) task.ask = { text: clip(askRaw.text, 200), options };
    }
    seen.add(key);
    tasks.push(task);
  }
  const reply = clip(raw.reply, 800);
  if (!reply) throw new Error("Plan had no reply");
  return { title: clip(raw.title, 50), reply, tasks };
}

/* ------------------------------------------------------------------ work */

export interface WorkInput {
  agent: AgentInfo;
  request: string;
  projectTitle: string;
  taskTitle: string;
  steps: string[];
  upstream: { agent: string; title: string; output: string }[];
}

export async function runTask(w: WorkInput): Promise<string> {
  const system = `You are ${w.agent.name}, the ${w.agent.role} on the user's AI team. ${w.agent.description}
You are given one task from a project that Atlas, the orchestrator, planned. Produce the actual deliverable for it, not a description of what you would do.
- Be concrete and specific to the user's request: real copy, real structure, real findings, real code where it fits.
- 150-350 words. Plain text or light markdown. No preamble, no sign-off.
- You are drafting text. Do not claim you deployed, ran, tested or browsed anything you did not. If you lack facts (market numbers, user data), say what you assumed.`;
  const ctx = w.upstream.length ? `\n\nWork already done by teammates:\n${w.upstream.map((u) => `## ${u.agent}: ${u.title}\n${clip(u.output, 1800)}`).join("\n\n")}` : "";
  const user = `Original request from the user: ${clip(w.request, 2000)}\nProject: ${clip(w.projectTitle, 100)}\nYour task: ${clip(w.taskTitle, 120)}\nPlanned steps: ${w.steps.join(" → ")}${ctx}`;
  const out = await ask({ system, messages: [{ role: "user", content: user }], maxTokens: 6000, effort: "medium" });
  if (!out) throw new Error("Empty result");
  return out;
}

/* ------------------------------------------------------------------ chat */

export async function chatAgent(agent: AgentInfo, thread: { from: string; text: string }[], taskLine: string): Promise<string> {
  const system = `You are ${agent.name}, the ${agent.role} on the user's AI team. ${agent.description}
The user is messaging you directly. ${taskLine}
Reply in first person, in 1-4 short sentences. Be useful and specific: answer the question, accept or push back on the instruction, and say how it changes your work. No emojis, no filler.`;
  const msgs = thread
    .slice(-12)
    .map((m) => ({ role: (m.from === "user" ? "user" : "assistant") as "user" | "assistant", content: clip(m.text, 1500) }))
    .filter((m) => m.content);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length) throw new Error("No message");
  const out = await ask({ system, messages: msgs, maxTokens: 3000, effort: "low" });
  if (!out) throw new Error("Empty reply");
  return out;
}
