import { chatAgent } from "@/lib/ai";
import { failure, guard, parseAgents, str } from "@/lib/aiRoute";
import { json } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The user messages one agent directly. */
export async function POST(req: Request) {
  const g = await guard(req);
  if (g instanceof Response) return g;
  const [agent] = parseAgents([g.body.agent]);
  const thread = (Array.isArray(g.body.thread) ? g.body.thread : []).slice(-14).map((m) => {
    const o = m as Record<string, unknown>;
    return { from: str(o?.from, 10), text: str(o?.text, 1500) };
  });
  if (!agent || !thread.length) return json({ error: "Invalid request" }, 422);
  try {
    return json({ text: await chatAgent(agent, thread, str(g.body.taskLine, 600)) });
  } catch (e) {
    return failure(e);
  }
}
