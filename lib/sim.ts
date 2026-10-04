import type { Snapshot } from "./repo";
import type {
  Activity,
  AiPlan,
  Agent,
  AgentStatus,
  ChatMessage,
  Project,
  State,
  Task,
  TaskStatus,
  View,
} from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

const MILESTONES = [20, 45, 70, 100];
const ACTIVE: TaskStatus[] = ["thinking", "working", "needs-input", "error"];
const DONE: TaskStatus[] = ["complete", "cancelled"];

/* ------------------------------------------------------------------ seed */

function mkAgent(
  id: string,
  name: string,
  role: string,
  color: string,
  description: string,
  skills: string[],
): Agent {
  return { id, name, role, color, description, skills, status: "idle", statusSince: 0, thread: [] };
}

export const SEED_AGENTS: Agent[] = [
  mkAgent("atlas", "Atlas", "Orchestrator", "#E9E6FF", "Plans the work, assembles the team and keeps every agent in sync.", ["Planning", "Delegation", "Synthesis"]),
  mkAgent("nova", "Nova", "Designer", "#C49BFF", "Brand systems, interfaces and visual direction.", ["UI design", "Branding", "Prototyping"]),
  mkAgent("forge", "Forge", "Developer", "#FFA866", "Ships production code — frontends, APIs and integrations.", ["Next.js", "APIs", "Infra"]),
  mkAgent("scout", "Scout", "Research", "#62D4FF", "Finds signal: markets, competitors, users and sources.", ["Market research", "Synthesis", "Sourcing"]),
  mkAgent("pulse", "Pulse", "Marketing", "#FF7AA8", "Positioning, copy, campaigns and launch plans.", ["Copywriting", "SEO", "Campaigns"]),
  mkAgent("vector", "Vector", "Data", "#6FF0C6", "Metrics, analysis, dashboards and forecasting.", ["Analytics", "SQL", "Forecasting"]),
  mkAgent("sentinel", "Sentinel", "QA", "#8AA6FF", "Tests everything before it ships. Nothing gets past.", ["Testing", "Accessibility", "Performance"]),
];

/* ------------------------------------------------------------- planning */

interface PlanTask {
  key: string;
  agentId: string;
  title: string;
  steps: string[];
  deps?: string[];
  askAt?: number;
  question?: { text: string; options: string[] };
  errorAt?: number;
  errorNote?: string;
}

function titleFrom(prompt: string) {
  const t = prompt
    .trim()
    .replace(/[.!?]+$/, "")
    .replace(/^(please\s+|can you\s+|could you\s+|help me\s+)/i, "");
  const c = t.charAt(0).toUpperCase() + t.slice(1);
  return c.length > 52 ? c.slice(0, 50).trimEnd() + "…" : c;
}

function planFor(prompt: string): PlanTask[] {
  const p = prompt.toLowerCase();
  if (/(web ?site|landing|site|web app|app|page|startup)/.test(p)) {
    return [
      { key: "research", agentId: "scout", title: "Market & competitor research", steps: ["Scanning competitors", "Audience insights", "Positioning brief"] },
      {
        key: "design", agentId: "nova", title: "Brand & UI design", deps: ["research"],
        steps: ["Moodboard", "UI structure", "Design system", "Hi-fi screens"],
        askAt: 45, question: { text: "Quick direction check — which visual tone fits your brand?", options: ["Dark & cinematic", "Light & minimal", "Bold & colorful"] },
      },
      { key: "copy", agentId: "pulse", title: "Launch copy & messaging", deps: ["research"], steps: ["Value proposition", "Headlines", "SEO metadata"] },
      { key: "build", agentId: "forge", title: "Build the website", deps: ["design", "copy"], steps: ["Planning", "UI structure", "Building components", "Testing"] },
      { key: "data", agentId: "vector", title: "Analytics & tracking", deps: ["build"], steps: ["Event schema", "Conversion funnels", "Dashboard"] },
      {
        key: "qa", agentId: "sentinel", title: "QA & launch checks", deps: ["build"],
        steps: ["Cross-browser", "Accessibility", "Performance", "Sign-off"],
        errorAt: 70, errorNote: "2 contrast issues found — auto-fixing with Forge",
      },
    ];
  }
  if (/(market|campaign|launch|growth|social|seo|brand|ads?)\b/.test(p)) {
    return [
      { key: "research", agentId: "scout", title: "Audience & channel research", steps: ["Segments", "Channel analysis", "Insights brief"] },
      {
        key: "strategy", agentId: "pulse", title: "Campaign strategy & copy", deps: ["research"],
        steps: ["Positioning", "Messaging pillars", "Copy variants"],
        askAt: 45, question: { text: "Which goal should this campaign optimize for?", options: ["Signups", "Revenue", "Awareness"] },
      },
      { key: "creative", agentId: "nova", title: "Campaign creatives", deps: ["strategy"], steps: ["Concepts", "Key visuals", "Ad variants"] },
      { key: "tracking", agentId: "vector", title: "Attribution & tracking", deps: ["strategy"], steps: ["UTM plan", "Attribution model", "Live dashboard"] },
      { key: "review", agentId: "sentinel", title: "Brand & compliance review", deps: ["creative", "tracking"], steps: ["Brand check", "Legal check", "Sign-off"] },
    ];
  }
  if (/(data|analy|report|metric|dashboard|forecast|kpi|numbers)/.test(p)) {
    return [
      { key: "data", agentId: "vector", title: "Data pull & analysis", steps: ["Collecting sources", "Cleaning", "Modeling", "Findings"] },
      { key: "bench", agentId: "scout", title: "Industry benchmarks", steps: ["Sourcing", "Normalizing", "Comparison"] },
      { key: "viz", agentId: "nova", title: "Report visuals", deps: ["data", "bench"], steps: ["Layout", "Charts", "Polish"] },
      { key: "summary", agentId: "pulse", title: "Executive summary", deps: ["viz"], steps: ["Key takeaways", "Narrative", "Final draft"] },
      { key: "qa", agentId: "sentinel", title: "Number verification", deps: ["viz"], steps: ["Cross-checks", "Sign-off"] },
    ];
  }
  return [
    { key: "research", agentId: "scout", title: "Research & scoping", steps: ["Understanding the ask", "Gathering context", "Brief"] },
    { key: "design", agentId: "nova", title: "Solution design", deps: ["research"], steps: ["Options", "Structure", "Decision"] },
    { key: "build", agentId: "forge", title: "Execution", deps: ["design"], steps: ["Planning", "Building", "Integrating", "Wrap-up"] },
    { key: "review", agentId: "sentinel", title: "Quality review", deps: ["build"], steps: ["Checks", "Fixes", "Sign-off"] },
  ];
}

const AMBIENT: { title: string; tasks: PlanTask[] }[] = [
  {
    title: "Weekly insights digest",
    tasks: [
      { key: "a", agentId: "scout", title: "Scan market signals", steps: ["Sources", "Signals", "Shortlist"] },
      { key: "b", agentId: "vector", title: "Crunch weekly metrics", deps: ["a"], steps: ["Pull", "Analyze", "Summarize"] },
      { key: "c", agentId: "pulse", title: "Draft insights newsletter", deps: ["b"], steps: ["Outline", "Draft", "Polish"] },
    ],
  },
  {
    title: "Nightly regression sweep",
    tasks: [
      { key: "a", agentId: "sentinel", title: "Regression & uptime sweep", steps: ["Smoke tests", "Visual diffs", "Report"] },
      { key: "b", agentId: "forge", title: "Patch minor issues", deps: ["a"], steps: ["Triage", "Patch", "Deploy"] },
    ],
  },
  {
    title: "Dashboard refresh",
    tasks: [
      { key: "a", agentId: "vector", title: "Funnel analysis", steps: ["Query", "Segment", "Insights"] },
      { key: "b", agentId: "nova", title: "Refresh dashboard visuals", deps: ["a"], steps: ["Layout", "Charts", "Polish"] },
    ],
  },
];

function outputFor(agent: Agent | undefined, task: Task, project: Project | undefined): string {
  const subject = project?.title ?? task.title;
  switch (agent?.id) {
    case "forge":
      return `// app/page.tsx — ${subject}\nexport default function Page() {\n  return (\n    <main className="hero">\n      <Hero />\n      <Features />\n      <Pricing />\n      <CTA />\n    </main>\n  );\n}\n\n✓ 24 components · ✓ Lighthouse 98 · ✓ Deployed to preview`;
    case "nova":
      return `Design direction — ${subject}\n\n• Palette: Midnight #0A0F1F · Aurora #C49BFF · Ember #FFA866\n• Type: Geist Display / Geist Sans, tight tracking\n• Grid: 12 col, 80px gutters, 8pt rhythm\n• 14 screens · 46 components · dark + light`;
    case "scout":
      return `Research brief — ${subject}\n\n1. 12 direct competitors mapped; 3 leaders own 61% share\n2. Core audience: technical founders, 25–40\n3. Gap: nobody owns "effortless + premium"\n4. Recommended angle: speed-to-value in under 5 minutes`;
    case "pulse":
      return `Messaging — ${subject}\n\nHeadline: "Your whole team, working while you sleep."\nSub: "Describe the outcome. Your agents handle the rest."\nCTA: "Start free"\nSEO: 18 keywords · meta + OG tags written`;
    case "vector":
      return `Metrics — ${subject}\n\n• 9 tracked events · 3 funnels\n• Baseline conversion: 3.4% → target 5.2%\n• Weekly retention model ready\n• Live dashboard: 6 panels`;
    case "sentinel":
      return `QA report — ${subject}\n\n✓ 142 checks passed\n✓ WCAG AA after 2 fixes\n✓ Chrome · Safari · Firefox · Mobile\n✓ LCP 1.1s · CLS 0.01\nStatus: cleared for launch`;
    case "atlas":
      return `Orchestration summary — ${subject}\n\nAll workstreams coordinated and delivered.`;
    default:
      return `${agent?.name ?? "Agent"} report — ${task.title}\n\n✓ Configured for your workspace\n✓ Baseline established\n✓ Monitoring active · alerts routed to Activity`;
  }
}

function buildProject(prompt: string, title: string, plan: PlanTask[], now: number, background = false) {
  const projectId = uid();
  const keyToId: Record<string, string> = {};
  plan.forEach((t) => (keyToId[t.key] = uid()));
  const tasks: Task[] = plan.map((t) => ({
    id: keyToId[t.key],
    projectId,
    title: t.title,
    agentId: t.agentId,
    status: "queued",
    progress: 0,
    steps: t.steps,
    dependsOn: (t.deps ?? []).map((k) => keyToId[k]),
    ticks: 0,
    askAt: t.askAt,
    question: t.question,
    errorAt: t.errorAt,
    errorNote: t.errorNote,
  }));
  const project: Project = { id: projectId, title, prompt, createdAt: now, taskIds: tasks.map((t) => t.id), background };
  return { project, tasks };
}

/* -------------------------------------------------------------- reducer */

export type Action =
  | { type: "TICK"; now: number }
  | { type: "USER_MESSAGE"; text: string }
  | { type: "AGENT_MESSAGE"; agentId: string; text: string }
  | { type: "ANSWER"; taskId: string; answer: string }
  | { type: "PAUSE"; agentId: string }
  | { type: "RESUME"; agentId: string }
  | { type: "CANCEL"; agentId: string }
  | { type: "SELECT"; id: string | null }
  | { type: "VIEW"; view: View }
  | { type: "COMMAND"; on?: boolean }
  | { type: "CREATE_OPEN"; open: boolean }
  | { type: "ADD_AGENT"; agent: Pick<Agent, "name" | "role" | "color" | "description" | "skills"> }
  | { type: "OPEN_WORK"; agentId: string | null }
  | { type: "HYDRATE"; snapshot: Snapshot }
  | { type: "AI_STATUS"; enabled: boolean }
  | { type: "PLAN_REQUESTED"; messageId: string }
  | { type: "PLAN_READY"; messageId: string; plan: AiPlan }
  | { type: "PLAN_FAILED"; messageId: string }
  | { type: "TASK_REQUESTED"; taskId: string }
  | { type: "TASK_OUTPUT"; taskId: string; output?: string; failed?: boolean }
  | { type: "AGENT_REQUESTED"; agentId: string; msgId: string }
  | { type: "AGENT_REPLY"; agentId: string; msgId: string; text?: string; failed?: boolean };

export function initialState(): State {
  const now = Date.now();
  const amb = AMBIENT[0];
  const { project, tasks } = buildProject(amb.title, amb.title, amb.tasks, now, true);
  return {
    agents: SEED_AGENTS.map((a) => ({ ...a, statusSince: now })),
    tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
    projects: [project],
    activity: [{ id: uid(), at: now, agentId: "atlas", text: "Team online — 7 agents ready", kind: "info" }],
    messages: [],
    transfers: [],
    pending: [],
    selectedAgentId: null,
    view: "chat",
    commandCenter: false,
    createOpen: false,
    workAgentId: null,
    ai: false,
  };
}

const name = (s: State, id: string) => s.agents.find((a) => a.id === id)?.name ?? id;

function act(agentId: string, text: string, kind: Activity["kind"], now: number): Activity {
  return { id: uid(), at: now, agentId, text, kind };
}

/** The task that best represents what an agent is doing right now. */
export function currentTask(s: State, agentId: string): Task | undefined {
  const all = Object.values(s.tasks).filter((t) => t.agentId === agentId);
  const fg = (t: Task) => !s.projects.find((p) => p.id === t.projectId)?.background;
  const rank = (t: Task) =>
    (t.status === "needs-input" ? 60 : ACTIVE.includes(t.status) ? 50 : t.status === "paused" ? 40 : t.status === "queued" ? 30 : t.status === "complete" ? 10 : 0) +
    (fg(t) ? 5 : 0);
  return all.sort((a, b) => rank(b) - rank(a) || (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
}

function deriveStatuses(s: State, now: number): Agent[] {
  return s.agents.map((a) => {
    let st: AgentStatus = "idle";
    if (a.bornAt && now - a.bornAt < 3200) st = "idle";
    else if (a.id === "atlas") {
      const activeProj = s.projects.some((p) => !p.doneAt && !p.background);
      const recent = s.projects.some((p) => p.doneAt && !p.background && now - p.doneAt < 3500);
      st = s.pending.length ? "thinking" : activeProj ? "working" : recent ? "complete" : s.projects.some((p) => !p.doneAt) ? "waiting" : "idle";
    } else {
      const t = currentTask(s, a.id);
      if (t) {
        if (t.status === "thinking") st = "thinking";
        else if (t.status === "working") st = "working";
        else if (t.status === "needs-input") st = "needs-input";
        else if (t.status === "error") st = "error";
        else if (t.status === "paused") st = "paused";
        else if (t.status === "queued") st = "waiting";
        else if (t.status === "complete" && t.completedAt && now - t.completedAt < 3000) st = "complete";
      }
    }
    return st === a.status ? a : { ...a, status: st, statusSince: now };
  });
}

function materialize(s: State, prompt: string, messageId: string, now: number): State {
  const { project, tasks } = buildProject(prompt, titleFrom(prompt), planFor(prompt), now);
  const agentNames = Array.from(new Set(tasks.map((t) => name(s, t.agentId))));
  return {
    ...s,
    projects: [...s.projects, project],
    tasks: { ...s.tasks, ...Object.fromEntries(tasks.map((t) => [t.id, t])) },
    messages: s.messages.map((m) =>
      m.id === messageId
        ? {
            ...m,
            typing: false,
            projectId: project.id,
            text: `Here's the plan. I've split this into ${tasks.length} workstreams and assembled ${agentNames.join(", ")}. Work starts now — I'll keep you posted.`,
          }
        : m,
    ),
    activity: [act("atlas", `Planned "${project.title}" → ${tasks.length} subtasks`, "info", now), ...s.activity],
  };
}

function maybeSpawnAmbient(s: State, now: number): State {
  const bg = s.projects.filter((p) => p.background);
  if (bg.some((p) => !p.doneAt)) return s;
  const last = bg[bg.length - 1];
  if (last?.doneAt && now - last.doneAt < 14000) return s;
  const amb = AMBIENT[bg.length % AMBIENT.length];
  const { project, tasks } = buildProject(amb.title, amb.title, amb.tasks, now, true);
  // keep history small
  const keepProjects = s.projects.filter((p) => !p.background || !p.doneAt || now - p.doneAt < 60000);
  const keepTasks = Object.fromEntries(keepProjects.flatMap((p) => p.taskIds).filter((id) => s.tasks[id]).map((id) => [id, s.tasks[id]]));
  return {
    ...s,
    projects: [...keepProjects, project],
    tasks: { ...keepTasks, ...Object.fromEntries(tasks.map((t) => [t.id, t])) },
  };
}

function tick(state: State, now: number): State {
  let s: State = { ...state, transfers: state.transfers.filter((t) => now - t.at < 4000) };

  // pending plans
  for (const p of s.pending) if (now >= p.readyAt) s = materialize(s, p.prompt, p.messageId, now);
  s = { ...s, pending: s.pending.filter((p) => now < p.readyAt) };

  const tasks = { ...s.tasks };
  const activity: Activity[] = [];
  const messages: ChatMessage[] = [];
  const transfers = [...s.transfers];
  const isBg = (t: Task) => !!s.projects.find((p) => p.id === t.projectId)?.background;

  const busyFg = new Set<string>();
  const busyAny = new Set<string>();
  for (const t of Object.values(tasks)) {
    if (ACTIVE.includes(t.status)) {
      busyAny.add(t.agentId);
      if (!isBg(t)) busyFg.add(t.agentId);
    }
  }
  const queuedFg = new Set(Object.values(tasks).filter((t) => t.status === "queued" && !isBg(t)).map((t) => t.agentId));

  const ordered = s.projects.slice().sort((a, b) => Number(!!a.background) - Number(!!b.background)).flatMap((p) => p.taskIds);

  for (const id of ordered) {
    const t0 = tasks[id];
    if (!t0) continue;
    const bg = isBg(t0);
    let t: Task = { ...t0 };
    const nm = name(s, t.agentId);

    switch (t.status) {
      case "queued": {
        const depsDone = t.dependsOn.every((d) => !tasks[d] || DONE.includes(tasks[d].status));
        const blocked = bg ? busyAny.has(t.agentId) || queuedFg.has(t.agentId) : busyFg.has(t.agentId);
        if (depsDone && !blocked && (!t.startAt || now >= t.startAt)) {
          t = { ...t, status: "thinking", ticks: 0 };
          busyAny.add(t.agentId);
          if (!bg) busyFg.add(t.agentId);
          const froms = t.dependsOn.map((d) => tasks[d]?.agentId).filter((a): a is string => !!a && a !== t.agentId);
          const sources = froms.length ? Array.from(new Set(froms)) : ["atlas"];
          sources.forEach((f, i) => transfers.push({ id: uid(), from: f, to: t.agentId, at: now + i * 180 }));
          activity.push(
            froms.length
              ? act(t.agentId, `${sources.map((f) => name(s, f)).join(" + ")} → ${nm}: handed off “${t.title}”`, "handoff", now)
              : act(t.agentId, `Atlas assigned ${nm} “${t.title}”`, "start", now),
          );
        }
        break;
      }
      case "thinking":
        t.ticks++;
        if (t.ticks >= 2) t = { ...t, status: "working", ticks: 0 };
        break;
      case "working": {
        t.ticks++;
        const pace = bg ? 3 : 2;
        if (t.ticks >= pace + (Math.random() < 0.35 ? 1 : 0)) {
          t.ticks = 0;
          const next = MILESTONES.find((m) => m > t.progress) ?? 100;
          // real-AI work waits at 70% until the deliverable arrives
          if (t.ai && !t.output && next >= 100) break;
          t.progress = next;
          const q = t.question;
          if (t.askAt && q && !t.askedAt && t.progress >= t.askAt) {
            t = { ...t, status: "needs-input", askedAt: now };
            messages.push({ id: uid(), at: now, role: "agent", agentId: t.agentId, text: q.text, taskId: t.id, options: q.options });
            activity.push(act(t.agentId, `${nm} needs your input on “${t.title}”`, "alert", now));
          } else if (t.errorAt && t.progress >= t.errorAt) {
            t = { ...t, status: "error", errorAt: undefined, ticks: 0 };
            activity.push(act(t.agentId, `${nm}: ${t.errorNote ?? "issue detected"}`, "alert", now));
            const fixer = Object.values(tasks).find((x) => x.projectId === t.projectId && x.agentId === "forge");
            if (fixer && fixer.agentId !== t.agentId) transfers.push({ id: uid(), from: t.agentId, to: fixer.agentId, at: now });
          } else if (t.progress >= 100) {
            const project = s.projects.find((p) => p.id === t.projectId);
            t = { ...t, status: "complete", completedAt: now, output: t.output ?? outputFor(s.agents.find((a) => a.id === t.agentId), t, project) };
            activity.push(act(t.agentId, `${nm} completed “${t.title}”`, "complete", now));
          }
        }
        break;
      }
      case "needs-input":
        if (t.askedAt && now - t.askedAt > 25000) {
          t = { ...t, status: "working", question: undefined, ticks: 0 };
          activity.push(act(t.agentId, `${nm} proceeded with best judgment (no reply)`, "info", now));
          if (!bg) messages.push({ id: uid(), at: now, role: "agent", agentId: t.agentId, text: "No reply — proceeding with my best judgment. You can redirect me anytime." });
        }
        break;
      case "error":
        t.ticks++;
        if (t.ticks >= 3) {
          t = { ...t, status: "working", ticks: 0 };
          activity.push(act(t.agentId, `${nm} resolved the issues — resuming`, "info", now));
          const fixer = Object.values(tasks).find((x) => x.projectId === t.projectId && x.agentId === "forge");
          if (fixer && fixer.agentId !== t.agentId) transfers.push({ id: uid(), from: fixer.agentId, to: t.agentId, at: now });
        }
        break;
    }
    tasks[id] = t;
  }

  // project completion
  const projects = s.projects.map((p) => {
    if (p.doneAt) return p;
    const ts = p.taskIds.map((id) => tasks[id]).filter(Boolean);
    if (ts.length && ts.every((t) => DONE.includes(t.status))) {
      if (!p.background) {
        const done = ts.filter((t) => t.status === "complete").length;
        messages.push({
          id: uid(), at: now, role: "atlas", projectId: p.id,
          text: `“${p.title}” is complete. ${done} of ${ts.length} workstreams delivered — open any agent to review their work.`,
        });
        activity.push(act("atlas", `Project “${p.title}” delivered`, "complete", now));
        ts.forEach((t, i) => t.status === "complete" && t.agentId !== "atlas" && transfers.push({ id: uid(), from: t.agentId, to: "atlas", at: now + i * 120 }));
      }
      return { ...p, doneAt: now };
    }
    return p;
  });

  s = {
    ...s,
    tasks,
    projects,
    transfers,
    activity: [...activity.reverse(), ...s.activity].slice(0, 200),
    messages: messages.length ? [...s.messages, ...messages] : s.messages,
  };
  s = maybeSpawnAmbient(s, now);
  return { ...s, agents: deriveStatuses(s, now) };
}

function answer(s: State, taskId: string, ans: string, now: number): State {
  const t = s.tasks[taskId];
  if (!t || t.status !== "needs-input") return s;
  const nm = name(s, t.agentId);
  return {
    ...s,
    tasks: { ...s.tasks, [taskId]: { ...t, status: "working", question: undefined, ticks: 0 } },
    messages: [
      ...s.messages.map((m) => (m.taskId === taskId ? { ...m, options: undefined } : m)),
      { id: uid(), at: now, role: "agent", agentId: t.agentId, text: `Perfect — going with “${ans}”. Resuming ${t.title.toLowerCase()}.` },
    ],
    activity: [act(t.agentId, `You answered ${nm}: “${ans}”`, "user", now), ...s.activity],
    transfers: [...s.transfers, { id: uid(), from: "atlas", to: t.agentId, at: now }],
  };
}

function pendingQuestion(s: State): Task | undefined {
  return Object.values(s.tasks).find((t) => t.status === "needs-input");
}

function userMessage(s: State, text: string, now: number): State {
  const userMsg: ChatMessage = { id: uid(), at: now, role: "user", text };
  const q = pendingQuestion(s);
  if (q) return answer({ ...s, messages: [...s.messages, userMsg] }, q.id, text, now);
  const typingId = uid();
  return {
    ...s,
    messages: [...s.messages, userMsg, { id: typingId, at: now, role: "atlas", text: "", typing: true }],
    pending: [...s.pending, s.ai ? { prompt: text, readyAt: now + 90000, messageId: typingId, ai: true } : { prompt: text, readyAt: now + 1700, messageId: typingId }],
    activity: [act("atlas", `New request: “${titleFrom(text)}”`, "user", now), ...s.activity],
  };
}

function agentMessage(s: State, agentId: string, text: string, now: number): State {
  if (agentId === "atlas") return userMessage(s, text, now);
  const agent = s.agents.find((a) => a.id === agentId);
  if (!agent) return s;
  const withUser = (st: State, reply: string): State => ({
    ...st,
    agents: st.agents.map((a) =>
      a.id === agentId
        ? {
            ...a,
            thread: [
              ...a.thread,
              { id: uid(), from: "user", text, at: now },
              s.ai ? { id: uid(), from: "agent", text: "", at: now + 1, typing: true } : { id: uid(), from: "agent", text: reply, at: now + 1 },
            ],
          }
        : a,
    ),
    activity: [act(agentId, `You → ${agent.name}: “${text.length > 60 ? text.slice(0, 58) + "…" : text}”`, "user", now), ...st.activity],
  });
  const t = currentTask(s, agentId);
  if (t?.status === "needs-input") return withUser(answer(s, t.id, text, now), `Got it — going with that. Back to work.`);
  if (t && (ACTIVE.includes(t.status) || t.status === "paused")) {
    return withUser(s, `On it — I'll fold that into “${t.title}”.`);
  }
  const { project, tasks } = buildProject(text, titleFrom(text), [
    { key: "x", agentId, title: titleFrom(text), steps: ["Understanding", "Planning", "Executing", "Review"] },
  ], now);
  if (s.ai) tasks.forEach((x) => (x.ai = true));
  return withUser(
    { ...s, projects: [...s.projects, project], tasks: { ...s.tasks, ...Object.fromEntries(tasks.map((x) => [x.id, x])) } },
    `Starting now. I'll report progress here and in Activity.`,
  );
}

function forAgentTasks(s: State, agentId: string, fn: (t: Task) => Task | null, log: string, now: number): State {
  let changed = false;
  const tasks = { ...s.tasks };
  for (const t of Object.values(tasks)) {
    if (t.agentId !== agentId) continue;
    const n = fn(t);
    if (n) {
      tasks[t.id] = n;
      changed = true;
    }
  }
  if (!changed) return s;
  const next = { ...s, tasks, activity: [act(agentId, log, "info", now), ...s.activity] };
  return { ...next, agents: deriveStatuses(next, now) };
}

function materializeAi(s: State, plan: AiPlan, messageId: string, prompt: string, now: number): State {
  if (!plan.tasks.length) {
    // conversational answer, no project
    return { ...s, messages: s.messages.map((m) => (m.id === messageId ? { ...m, typing: false, text: plan.reply } : m)) };
  }
  const planTasks: PlanTask[] = plan.tasks.map((t) => ({
    key: t.key,
    agentId: t.agentId,
    title: t.title,
    steps: t.steps,
    deps: t.deps,
    askAt: t.ask ? 45 : undefined,
    question: t.ask,
  }));
  const { project, tasks } = buildProject(prompt, plan.title || titleFrom(prompt), planTasks, now);
  tasks.forEach((t) => (t.ai = true));
  return {
    ...s,
    projects: [...s.projects, project],
    tasks: { ...s.tasks, ...Object.fromEntries(tasks.map((t) => [t.id, t])) },
    messages: s.messages.map((m) => (m.id === messageId ? { ...m, typing: false, projectId: project.id, text: plan.reply } : m)),
    activity: [act("atlas", `Planned "${project.title}" → ${tasks.length} subtasks`, "info", now), ...s.activity],
  };
}

function patchThread(s: State, agentId: string, msgId: string, fn: (m: Agent["thread"][number]) => Agent["thread"][number]): State {
  return { ...s, agents: s.agents.map((a) => (a.id === agentId ? { ...a, thread: a.thread.map((m) => (m.id === msgId ? fn(m) : m)) } : a)) };
}

export function reducer(s: State, a: Action): State {
  const now = Date.now();
  switch (a.type) {
    case "TICK":
      return tick(s, a.now);
    case "USER_MESSAGE":
      return userMessage(s, a.text, now);
    case "AGENT_MESSAGE":
      return agentMessage(s, a.agentId, a.text, now);
    case "ANSWER":
      return answer(s, a.taskId, a.answer, now);
    case "PAUSE":
      return forAgentTasks(s, a.agentId, (t) => (ACTIVE.includes(t.status) ? { ...t, status: "paused", resumeTo: t.status === "needs-input" ? "needs-input" : "working" } : null), `${name(s, a.agentId)} paused`, now);
    case "RESUME":
      return forAgentTasks(s, a.agentId, (t) => (t.status === "paused" ? { ...t, status: t.resumeTo ?? "working", resumeTo: undefined, askedAt: t.askedAt ? now : undefined } : null), `${name(s, a.agentId)} resumed`, now);
    case "CANCEL":
      return forAgentTasks(s, a.agentId, (t) => (!DONE.includes(t.status) ? { ...t, status: "cancelled" } : null), `${name(s, a.agentId)}'s work was cancelled`, now);
    case "SELECT":
      return { ...s, selectedAgentId: a.id };
    case "VIEW":
      return { ...s, view: a.view, commandCenter: false };
    case "COMMAND":
      return { ...s, commandCenter: a.on ?? !s.commandCenter };
    case "CREATE_OPEN":
      return { ...s, createOpen: a.open };
    case "OPEN_WORK":
      return { ...s, workAgentId: a.agentId };
    case "AI_STATUS":
      return s.ai === a.enabled ? s : { ...s, ai: a.enabled };
    case "PLAN_REQUESTED":
      return { ...s, pending: s.pending.map((p) => (p.messageId === a.messageId ? { ...p, requested: true } : p)) };
    case "PLAN_READY": {
      const p = s.pending.find((x) => x.messageId === a.messageId);
      if (!p) return s; // already fell back to the simulation
      return materializeAi({ ...s, pending: s.pending.filter((x) => x.messageId !== a.messageId) }, a.plan, a.messageId, p.prompt, now);
    }
    case "PLAN_FAILED": {
      const p = s.pending.find((x) => x.messageId === a.messageId);
      if (!p) return s;
      return materialize({ ...s, pending: s.pending.filter((x) => x.messageId !== a.messageId) }, p.prompt, a.messageId, now);
    }
    case "TASK_REQUESTED": {
      const t = s.tasks[a.taskId];
      return t ? { ...s, tasks: { ...s.tasks, [t.id]: { ...t, requested: true } } } : s;
    }
    case "TASK_OUTPUT": {
      const t = s.tasks[a.taskId];
      if (!t) return s;
      const out = a.failed || !a.output
        ? outputFor(s.agents.find((x) => x.id === t.agentId), t, s.projects.find((p) => p.id === t.projectId)) + "\n\n(The AI was unreachable, so this is a simulated result.)"
        : a.output;
      return { ...s, tasks: { ...s.tasks, [t.id]: { ...t, output: out } } };
    }
    case "AGENT_REQUESTED":
      return patchThread(s, a.agentId, a.msgId, (m) => ({ ...m, requested: true }));
    case "AGENT_REPLY":
      return patchThread(s, a.agentId, a.msgId, (m) => ({ ...m, typing: false, text: a.failed || !a.text ? "I couldn't reach my AI brain just now, but I've noted your message." : a.text }));
    case "HYDRATE": {
      const sn = a.snapshot;
      if (!sn.agents.length) return s;
      return {
        ...s,
        agents: sn.agents.map((x) => ({ ...x, statusSince: now, thread: x.thread.filter((m) => !m.typing) })),
        projects: sn.projects,
        // AI work that never delivered gets requested again after a reload
        tasks: Object.fromEntries(sn.tasks.map((t) => [t.id, t.ai && !t.output ? { ...t, requested: false } : t])),
        activity: sn.activity,
        // plans that were still "typing" died with the old session
        messages: sn.messages.filter((m) => !m.typing),
        pending: [],
        transfers: [],
      };
    }
    case "ADD_AGENT": {
      const id = a.agent.name.toLowerCase().replace(/[^a-z0-9]/g, "") + "-" + uid().slice(0, 4);
      const agent: Agent = { ...a.agent, id, status: "idle", statusSince: now, bornAt: now, custom: true, thread: [] };
      const { project, tasks } = buildProject(`Onboard ${agent.name}`, `Onboarding ${agent.name}`, [
        { key: "x", agentId: id, title: "Calibrating to your workspace", steps: ["Connecting tools", "Learning context", "Baseline", "Going live"] },
      ], now, true);
      tasks[0].startAt = now + 3400;
      return {
        ...s,
        agents: [...s.agents, agent],
        projects: [...s.projects, project],
        tasks: { ...s.tasks, [tasks[0].id]: tasks[0] },
        activity: [act(id, `${agent.name} joined the team as ${agent.role}`, "complete", now), ...s.activity],
        transfers: [...s.transfers, { id: uid(), from: "atlas", to: id, at: now + 3000 }],
        createOpen: false,
      };
    }
  }
}

/* ------------------------------------------------------- agent generator */

const NAMES = ["Orion", "Lyra", "Vega", "Halo", "Echo", "Rigel", "Iris", "Cygnus", "Juno", "Lumen", "Atlas II", "Polaris"];
const COLORS = ["#7EE7FF", "#FFD36E", "#B6FF8A", "#FF9EDB", "#A18BFF", "#FFB38A", "#8AFFEA"];

export function generateAgentProfile(desc: string, taken: string[]) {
  const d = desc.toLowerCase();
  const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];
  const seed = Array.from(desc).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  let role = "Specialist";
  let skills = ["Automation", "Reporting", "Integrations"];
  if (/(bug|monitor|uptime|error|crash|incident)/.test(d)) { role = "Reliability Monitor"; skills = ["Uptime checks", "Error tracking", "Alerting"]; }
  else if (/(support|customer|ticket|help ?desk|inbox)/.test(d)) { role = "Customer Support"; skills = ["Ticket triage", "Replies", "Escalation"]; }
  else if (/(social|twitter|linkedin|content|post|blog)/.test(d)) { role = "Content Creator"; skills = ["Social posts", "Scheduling", "Engagement"]; }
  else if (/(sales|lead|outreach|crm|prospect)/.test(d)) { role = "Sales Outreach"; skills = ["Prospecting", "Sequences", "CRM sync"]; }
  else if (/(financ|invoice|budget|expense|account)/.test(d)) { role = "Finance Ops"; skills = ["Invoicing", "Reconciliation", "Forecasts"]; }
  else if (/(email|newsletter)/.test(d)) { role = "Email Strategist"; skills = ["Newsletters", "Segmentation", "A/B tests"]; }
  else if (/(seo|search|rank)/.test(d)) { role = "SEO Specialist"; skills = ["Keyword research", "On-page", "Rank tracking"]; }
  const free = NAMES.filter((n) => !taken.includes(n));
  const nm = pick(free.length ? free : NAMES, seed);
  const clean = desc.trim().replace(/^(create|make|build)\s+(an?\s+)?agent\s+(that|to|who)\s+/i, "").replace(/[.!]+$/, "");
  return {
    name: nm,
    role,
    color: pick(COLORS, seed >> 3),
    description: clean ? clean.charAt(0).toUpperCase() + clean.slice(1) + "." : "A custom agent for your team.",
    skills,
  };
}
