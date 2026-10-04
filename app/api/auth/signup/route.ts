import { clientIp, createSession, createUser, findByEmail, hashPassword, isJson, json, normEmail, rateLimit, sessionCookie, validEmail } from "@/lib/auth";
import { sendWelcome } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isJson(req)) return json({ error: "Unsupported content type" }, 415);
  if (!rateLimit(`signup|${clientIp(req)}`, 10)) return json({ error: "Too many attempts. Try again later." }, 429);
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown; name?: unknown } | null;
  const email = normEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!validEmail(email)) return json({ error: "Enter a valid email address." }, 422);
  if (password.length < 8 || password.length > 200) return json({ error: "Password must be at least 8 characters." }, 422);
  if (findByEmail(email)) return json({ error: "An account with this email already exists. Sign in instead." }, 409);

  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : null;
  const user = createUser(email, { passwordHash: hashPassword(password), name });
  const cookie = sessionCookie(createSession(user.id));
  // the welcome email must not block or fail the signup
  const welcome = await sendWelcome(email, name);
  return json({ user, welcomeEmail: welcome }, 201, cookie);
}
