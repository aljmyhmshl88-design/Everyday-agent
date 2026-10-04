import { json } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tells the login screen which sign-in options are configured on this server. */
export async function GET() {
  return json({ google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
}
