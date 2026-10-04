import { clientIp, createSession, findByEmail, isJson, json, normEmail, rateLimit, sessionCookie, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isJson(req)) return json({ error: "Unsupported content type" }, 415);
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = normEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!rateLimit(`login|${clientIp(req)}|${email}`)) return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
  const row = email ? findByEmail(email) : undefined;
  // same message and similar timing whether the email exists or not
  if (!verifyPassword(password, row?.password_hash ?? null) || !row) return json({ error: "Incorrect email or password." }, 401);
  return json({ user: { id: row.id, email: row.email, name: row.name } }, 200, sessionCookie(createSession(row.id)));
}
