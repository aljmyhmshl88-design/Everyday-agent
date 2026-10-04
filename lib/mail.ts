import crypto from "node:crypto";
import { getDb } from "./db";

export type MailStatus = "sent" | "logged" | "failed";

/**
 * Sends through Resend's HTTP API when RESEND_API_KEY is set (MAIL_FROM must be a verified sender).
 * Without a key, mail is only logged and stored in the `outbox` table, so local development works.
 */
export async function sendMail(to: string, subject: string, text: string, html: string): Promise<MailStatus> {
  const db = getDb();
  const id = crypto.randomUUID();
  const save = (status: MailStatus, error?: string) =>
    db.prepare("INSERT INTO outbox (id, to_email, subject, body, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, to, subject, text, status, error ?? null, Date.now());
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[mail:not configured] to=${to} subject="${subject}"`);
    save("logged");
    return "logged";
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM ?? "Orqivio AI <onboarding@resend.dev>", to: [to], subject, text, html }),
    });
    if (!res.ok) throw new Error(`mail provider ${res.status}: ${(await res.text()).slice(0, 200)}`);
    save("sent");
    return "sent";
  } catch (e) {
    console.error("[mail] failed", (e as Error).message);
    save("failed", (e as Error).message);
    return "failed";
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function sendWelcome(email: string, name?: string | null): Promise<MailStatus> {
  const who = name?.trim() || email.split("@")[0];
  const url = process.env.APP_URL ?? "http://localhost:3000";
  const text = `Welcome to Orqivio AI, ${who}!\n\nYour account is ready and your team of agents is waiting. Tell Atlas what you want to build and watch the constellation light up.\n\nOpen your workspace: ${url}\n\n— The Orqivio AI team`;
  const html = `<div style="background:#05070f;padding:40px 16px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif"><div style="max-width:480px;margin:0 auto;background:#0d1124;border:1px solid #1e2542;border-radius:20px;padding:36px;color:#eceefe"><div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#8a93b8">Orqivio AI</div><h1 style="margin:14px 0 10px;font-size:26px;line-height:1.2;color:#fff">Welcome, ${esc(who)}.</h1><p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#b4bad6">Your account is ready and your team of agents is waiting. Tell Atlas what you want to build and watch the constellation light up.</p><a href="${esc(url)}" style="display:inline-block;background:#fff;color:#0b0e1c;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:12px">Open your workspace</a></div></div>`;
  return sendMail(email, "Welcome to Orqivio AI", text, html);
}
