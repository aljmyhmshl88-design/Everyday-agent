import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Starts "Continue with Google": redirects to Google's consent screen. */
export async function GET() {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id || !process.env.GOOGLE_CLIENT_SECRET) return Response.redirect(`${appUrl()}/?auth_error=google_not_configured`, 302);
  const state = crypto.randomBytes(16).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: id,
    redirect_uri: `${appUrl()}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  const headers = new Headers({ Location: url.toString() });
  headers.append("Set-Cookie", `ea_oauth=${state}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600${appUrl().startsWith("https://") ? "; Secure" : ""}`);
  return new Response(null, { status: 302, headers });
}
