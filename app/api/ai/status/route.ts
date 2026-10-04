import { MODEL, aiEnabled } from "@/lib/ai";
import { json } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether the server has an AI key (never returns the key itself). */
export async function GET() {
  return json({ enabled: aiEnabled(), model: aiEnabled() ? MODEL : null });
}
