"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Icon } from "./ui";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

const Ctx = createContext<{ user: AuthUser; signOut: () => void } | null>(null);
export const useAuth = () => useContext(Ctx);

const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't set up on this server yet.",
  google_cancelled: "Google sign-in was cancelled.",
  google_state: "Google sign-in expired. Please try again.",
  google_failed: "Google sign-in failed. Please try again.",
  google_unverified: "Your Google email isn't verified.",
};

type Status = { s: "loading" } | { s: "anon" } | { s: "authed"; user: AuthUser };

/** Shows the login screen until a session exists, then renders `children(user)`. */
export function AuthGate({ children, backdrop }: { children: ReactNode; backdrop: ReactNode }) {
  const [status, setStatus] = useState<Status>({ s: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const err = q.get("auth_error");
    if (err) {
      setUrlError(GOOGLE_ERRORS[err] ?? "Sign-in failed.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setStatus(d.user ? { s: "authed", user: d.user } : { s: "anon" }))
      .catch(() => setStatus({ s: "anon" }));
  }, []);

  const signOut = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).finally(() => {
      setNotice(null);
      setStatus({ s: "anon" });
    });
  }, []);

  const onAuthed = (user: AuthUser, welcome?: string) => {
    if (welcome) setNotice(welcome === "failed" ? "Account created. We couldn't send your welcome email right now." : `Welcome email sent to ${user.email}`);
    setStatus({ s: "authed", user });
    if (welcome) setTimeout(() => setNotice(null), 6000);
  };

  useEffect(() => {
    // Google redirects back with a fresh session cookie; /me above already picked it up. Welcome notice for new Google users:
    if (status.s === "authed" && document.referrer.includes("accounts.google.com")) setNotice(`Signed in as ${status.user.email}`);
  }, [status]);

  if (status.s === "loading") return null;
  if (status.s === "anon") return <LoginScreen backdrop={backdrop} onAuthed={onAuthed} initialError={urlError} />;
  return (
    <Ctx.Provider value={{ user: status.user, signOut }}>
      {children}
      <AnimatePresence>
        {notice && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="glass fixed left-1/2 top-20 z-[70] flex -translate-x-1/2 items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6ff0c6]/15 text-[#6ff0c6]">
              <Icon name="check" className="h-3 w-3" strokeWidth={2.4} />
            </span>
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

function LoginScreen({ backdrop, onAuthed, initialError }: { backdrop: ReactNode; onAuthed: (u: AuthUser, welcome?: string) => void; initialError: string | null }) {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [google, setGoogle] = useState(false);

  useEffect(() => {
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((d) => setGoogle(!!d.google))
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error ?? "Something went wrong. Please try again.");
      else onAuthed(d.user, mode === "signup" ? d.welcomeEmail : undefined);
    } catch {
      setError("Can't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0">
      {backdrop}
      <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 24, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} className="glass w-full max-w-[420px] rounded-[28px] p-7 sm:p-9">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(196,155,255,0.55),transparent_70%)]" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_12px_4px_rgba(220,210,255,0.8)]" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Everyday</span>
          </div>
          <h1 className="text-gradient text-[28px] font-semibold leading-tight tracking-[-0.03em]">{mode === "signup" ? "Meet your team." : "Welcome back."}</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-mist">{mode === "signup" ? "Create your account with just an email and password. We'll send you a welcome email." : "Sign in to pick up where your agents left off."}</p>

          {google && (
            <>
              <a href="/api/auth/google" className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-white py-3 text-[14px] font-medium text-[#0b0e1c] transition hover:shadow-[0_0_30px_-6px_rgba(196,155,255,0.9)]">
                <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
                  <path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 019.5 24c0-1.6.3-3.2.9-4.7l-7.8-6.1A24 24 0 000 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z" />
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
                </svg>
                Continue with Google
              </a>
              <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-haze">
                <span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" />
              </div>
            </>
          )}

          <form onSubmit={submit} className={google ? "" : "mt-6"} noValidate>
            <label htmlFor="email" className="mb-1.5 block text-[12px] text-mist">Email</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl bg-white/[0.04] px-4 py-3 text-[14.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] placeholder:text-haze focus:shadow-[inset_0_0_0_1px_rgba(196,155,255,0.55)] focus:outline-none" />
            <label htmlFor="password" className="mb-1.5 mt-4 block text-[12px] text-mist">Password</label>
            <div className="relative">
              <input id="password" type={show ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} className="w-full rounded-xl bg-white/[0.04] py-3 pl-4 pr-16 text-[14.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] placeholder:text-haze focus:shadow-[inset_0_0_0_1px_rgba(196,155,255,0.55)] focus:outline-none" />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[12px] text-haze transition hover:text-white">
                {show ? "Hide" : "Show"}
              </button>
            </div>
            <AnimatePresence>
              {error && (
                <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-3 text-[13px] text-[#ff8a6b]">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={busy} className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-medium transition disabled:opacity-60 ${google ? "bg-white/10 text-white hover:bg-white/[0.16]" : "bg-white text-[#0b0e1c] hover:shadow-[0_0_30px_-6px_rgba(196,155,255,0.9)]"}`}>
              {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
              {!busy && <Icon name="arrow" className="h-4 w-4" />}
            </motion.button>
          </form>

          <p className="mt-5 text-center text-[13px] text-mist">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }} className="font-medium text-white underline-offset-4 hover:underline">
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
