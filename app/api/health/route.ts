import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const n = getDb().prepare("SELECT COUNT(*) AS n FROM agents").get()?.n;
    return Response.json({ ok: true, db: "sqlite", agents: n });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
