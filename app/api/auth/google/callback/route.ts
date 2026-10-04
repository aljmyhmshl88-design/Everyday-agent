import { createSession, createUser, findByEmail, normEmail, readCookie, sessionCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendWelcome } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

function back(error?: string, cookie?: string) {
  const headers = new Headers({ Location: `${appUrl()}/${error ? `?auth_error=${error}` : ""}` });
  if (cookie) headers.append("Set-Cookie", cookie);
  headers.append("Set-Cookie", "ea_oauth=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0");
  return new Response(null, { status: 302, headers });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error") || !code) return back("google_cancelled");
  if (!state || state !== readCookie(req, "ea_oauth")) return back("google_state");
  try {
    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: `${appUrl()}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tok.ok) return back("google_failed");
    const { access_token } = (await tok.json()) as { access_token: string };
    const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
    if (!info.ok) return back("google_failed");
    const p = (await info.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
    const email = normEmail(p.email);
    if (!email || !p.email_verified) return back("google_unverified");

    let user = findByEmail(email);
    let isNew = false;
    if (!user) {
      createUser(email, { googleId: p.sub, name: p.name ?? null });
      user = findByEmail(email)!;
      isNew = true;
    } else if (!user.google_id) {
      // Google verified this address, so link it to the existing account
      getDb().prepare("UPDATE users SET google_id = ? WHERE id = ?").run(p.sub, user.id);
    }
    const cookie = sessionCookie(createSession(user.id));
    if (isNew) await sendWelcome(email, p.name);
    return back(undefined, cookie);
  } catch {
    return back("google_failed");
  }
}
