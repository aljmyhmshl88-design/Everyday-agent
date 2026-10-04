import { isEmpty, loadSnapshot, parseSnapshot, resetAll, saveSnapshot } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/state → { empty, snapshot } */
export async function GET() {
  try {
    if (isEmpty()) return Response.json({ empty: true, snapshot: null });
    return Response.json({ empty: false, snapshot: loadSnapshot() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** POST /api/state ← Snapshot (replaces stored state atomically) */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const snap = parseSnapshot(body);
  if (!snap) return Response.json({ error: "Invalid snapshot" }, { status: 422 });
  try {
    saveSnapshot(snap);
    return Response.json({ ok: true, savedAt: Date.now() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** DELETE /api/state → wipe everything (the client then re-seeds the demo team) */
export async function DELETE() {
  try {
    resetAll();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
