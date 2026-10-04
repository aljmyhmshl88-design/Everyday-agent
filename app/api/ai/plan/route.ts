import { planProject } from "@/lib/ai";
import { failure, guard, parseAgents, str } from "@/lib/aiRoute";
import { json } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Atlas: turn the user's message into a plan, or just answer it. */
export async function POST(req: Request) {
  const g = await guard(req);
  if (g instanceof Response) return g;
  const prompt = str(g.body.prompt, 4000).trim();
  const agents = parseAgents(g.body.agents);
  if (!prompt || agents.length < 2) return json({ error: "Invalid request" }, 422);
  const history = (Array.isArray(g.body.history) ? g.body.history : []).slice(-8).map((m) => ({ role: str((m as Record<string, unknown>)?.role, 10), text: str((m as Record<string, unknown>)?.text, 1500) }));
  try {
    return json({ plan: await planProject(prompt, agents, history, str(g.body.status, 2000)) });
  } catch (e) {
    return failure(e);
  }
}
