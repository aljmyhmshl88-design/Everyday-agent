import { clientIp, getUser, isJson, json, rateLimit, type User } from "./auth";
import { AiRefusal, aiEnabled, type AgentInfo } from "./ai";

/** Shared guard for AI routes: key configured, signed in, JSON body, rate limited. */
export async function guard(req: Request): Promise<{ user: User; body: Record<string, unknown> } | Response> {
  if (!aiEnabled()) return json({ error: "ai_not_configured" }, 503);
  const user = getUser(req);
  if (!user) return json({ error: "Sign in required" }, 401);
  if (!isJson(req)) return json({ error: "Unsupported content type" }, 415);
  if (!rateLimit(`ai|${user.id}`, 150, 60 * 60 * 1000) || !rateLimit(`aiip|${clientIp(req)}`, 400, 60 * 60 * 1000)) return json({ error: "Too many AI requests. Try again later." }, 429);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Invalid JSON" }, 400);
  return { user, body: body as Record<string, unknown> };
}

export const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export function parseAgents(v: unknown): AgentInfo[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 30).flatMap((a) => {
    const o = a as Record<string, unknown>;
    const id = str(o?.id, 40);
    return id ? [{ id, name: str(o.name, 40), role: str(o.role, 60), description: str(o.description, 300) }] : [];
  });
}

/** Maps provider failures to a safe response; details stay in the server log. */
export function failure(e: unknown): Response {
  if (e instanceof AiRefusal) return json({ error: "refused" }, 422);
  console.error("[ai]", (e as Error)?.message ?? e);
  return json({ error: "ai_failed" }, 502);
}
