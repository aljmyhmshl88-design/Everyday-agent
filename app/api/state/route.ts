import { getUser, isJson, json } from "@/lib/auth";
import { isEmpty, loadSnapshot, parseSnapshot, resetAll, saveSnapshot } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => json({ error: "Sign in required" }, 401);

/** GET /api/state → { empty, snapshot } for the signed-in user */
export async function GET(req: Request) {
  const user = getUser(req);
  if (!user) return unauthorized();
  try {
    if (isEmpty(user.id)) return json({ empty: true, snapshot: null });
    return json({ empty: false, snapshot: loadSnapshot(user.id) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}

/** POST /api/state ← Snapshot (replaces this user's stored state atomically) */
export async function POST(req: Request) {
  const user = getUser(req);
  if (!user) return unauthorized();
  if (!isJson(req)) return json({ error: "Unsupported content type" }, 415);
  const body = await req.json().catch(() => undefined);
  if (body === undefined) return json({ error: "Invalid JSON" }, 400);
  const snap = parseSnapshot(body);
  if (!snap) return json({ error: "Invalid snapshot" }, 422);
  try {
    saveSnapshot(user.id, snap);
    return json({ ok: true, savedAt: Date.now() });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}

/** DELETE /api/state → wipe this user's data (the client re-seeds the demo team) */
export async function DELETE(req: Request) {
  const user = getUser(req);
  if (!user) return unauthorized();
  try {
    resetAll(user.id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}
