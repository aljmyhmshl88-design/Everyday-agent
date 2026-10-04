import { clearCookie, destroySession, isJson, json } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isJson(req)) return json({ error: "Unsupported content type" }, 415);
  destroySession(req);
  return json({ ok: true }, 200, clearCookie());
}
