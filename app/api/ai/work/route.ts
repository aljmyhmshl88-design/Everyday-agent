import { runTask } from "@/lib/ai";
import { failure, guard, parseAgents, str } from "@/lib/aiRoute";
import { json } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** One agent produces the deliverable for one task. */
export async function POST(req: Request) {
  const g = await guard(req);
  if (g instanceof Response) return g;
  const [agent] = parseAgents([g.body.agent]);
  const taskTitle = str(g.body.taskTitle, 200).trim();
  if (!agent || !taskTitle) return json({ error: "Invalid request" }, 422);
  const steps = (Array.isArray(g.body.steps) ? g.body.steps : []).slice(0, 6).map((s) => str(s, 60)).filter(Boolean);
  const upstream = (Array.isArray(g.body.upstream) ? g.body.upstream : []).slice(0, 6).map((u) => {
    const o = u as Record<string, unknown>;
    return { agent: str(o?.agent, 40), title: str(o?.title, 120), output: str(o?.output, 4000) };
  });
  try {
    const output = await runTask({ agent, request: str(g.body.request, 2000), projectTitle: str(g.body.projectTitle, 120), taskTitle, steps, upstream });
    return json({ output });
  } catch (e) {
    return failure(e);
  }
}
