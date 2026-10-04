import crypto from "node:crypto";
import { getDb } from "./db";

export const COOKIE = "ea_session";
const SESSION_MS = 30 * 24 * 3600 * 1000;

export interface User {
  id: string;
  email: string;
  name: string | null;
}

/* ------------------------------------------------------------ passwords */

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(pw: string, stored: string | null): boolean {
  if (!stored) {
    // keep timing similar for unknown users / Google-only accounts
    crypto.scryptSync(pw, "x".repeat(16), 64, { N: 16384, r: 8, p: 1 });
    return false;
  }
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt") return false;
  const want = Buffer.from(hash, "base64");
  const got = crypto.scryptSync(pw, Buffer.from(salt, "base64"), want.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(want, got);
}

export const normEmail = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : "");
export const validEmail = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

/* ---------------------------------------------------------------- users */

export function findByEmail(email: string) {
  return getDb().prepare("SELECT id, email, name, password_hash, google_id FROM users WHERE email = ?").get(email) as
    | { id: string; email: string; name: string | null; password_hash: string | null; google_id: string | null }
    | undefined;
}

export function createUser(email: string, opts: { passwordHash?: string; name?: string | null; googleId?: string }): User {
  const id = crypto.randomUUID();
  getDb()
    .prepare("INSERT INTO users (id, email, name, password_hash, google_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, email, opts.name ?? null, opts.passwordHash ?? null, opts.googleId ?? null, Date.now());
  return { id, email, name: opts.name ?? null };
}

/* -------------------------------------------------------------- sessions */

const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString("base64url");
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(sha(token), userId, Date.now() + SESSION_MS);
  return token;
}

const secure = () => (process.env.APP_URL ?? "").startsWith("https://");

export const sessionCookie = (token: string) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${secure() ? "; Secure" : ""}`;
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure() ? "; Secure" : ""}`;

export function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function getUser(req: Request): User | null {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const row = getDb()
    .prepare("SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?")
    .get(sha(token), Date.now()) as User | undefined;
  return row ?? null;
}

export function destroySession(req: Request) {
  const token = readCookie(req, COOKIE);
  if (token) getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
}

/* --------------------------------------------------------- request guards */

/** Browsers cannot send a cross-site `application/json` POST without a CORS preflight, so this blocks CSRF. */
export const isJson = (req: Request) => (req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");

const hits = new Map<string, { n: number; reset: number }>();
/** Returns false when `key` exceeded `max` attempts in the window. */
export function rateLimit(key: string, max = 8, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  h.n++;
  return h.n <= max;
}
export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();

export function json(data: unknown, status = 200, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.append("Set-Cookie", cookie);
  return Response.json(data, { status, headers });
}
