"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion, useStore } from "@/lib/store";
import { currentTask } from "@/lib/sim";
import type { Agent, AgentStatus, State } from "@/lib/types";

/* One canvas renders everything: background field, agents, links, packets. */

interface BgStar { x: number; y: number; z: number; r: number; tw: number; hue: number }
interface Shooting { x: number; y: number; vx: number; vy: number; life: number }
interface Live { x: number; y: number; status: AgentStatus; since: number; hover: number; sel: number; prevStatus: AgentStatus; flashAt: number }

const TAU = Math.PI * 2;
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

const spriteCache = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string): HTMLCanvasElement {
  const hit = spriteCache.get(color);
  if (hit) return hit;
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, rgba(color, 1));
  grd.addColorStop(0.12, rgba(color, 0.65));
  grd.addColorStop(0.35, rgba(color, 0.18));
  grd.addColorStop(0.7, rgba(color, 0.04));
  grd.addColorStop(1, rgba(color, 0));
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  spriteCache.set(color, c);
  return c;
}

/** Target layout: chat mode rings the centered chat; command mode puts Atlas at the core. */
function layout(agents: Agent[], w: number, h: number, mode: number, t: number) {
  const out: Record<string, { x: number; y: number }> = {};
  const others = agents.filter((a) => a.id !== "atlas");
  const n = others.length;
  const cx = w / 2;
  const cy = h / 2;
  const mobile = w < 720;
  // chat layout
  const rxA = mobile ? w * 0.42 : Math.min(w * 0.4, 680);
  const ryA = mobile ? h * 0.4 : Math.min(h * 0.37, 380);
  // command layout
  const R = Math.min(w, h) * (mobile ? 0.34 : 0.3);
  const spin = t * 0.012;
  others.forEach((a, i) => {
    const base = -Math.PI / 2 + ((i + 0.5) / n) * TAU;
    const ax = cx + Math.cos(base) * rxA;
    const ay = cy + Math.sin(base) * ryA * (mobile ? 1 : 1.02);
    const ring = R * (i % 2 ? 1.12 : 0.92);
    const bx = cx + Math.cos(base + spin) * ring;
    const by = cy + Math.sin(base + spin) * ring * 0.82;
    const wob = Math.sin(t * 0.35 + i * 1.7) * 6;
    const wob2 = Math.cos(t * 0.28 + i * 2.3) * 5;
    out[a.id] = { x: lerp(ax, bx, mode) + wob, y: lerp(ay, by, mode) + wob2 };
  });
  out.atlas = {
    x: cx + Math.sin(t * 0.3) * 4,
    y: lerp(mobile ? h * 0.12 : cy - ryA - 10, cy, mode) + Math.cos(t * 0.25) * 4,
  };
  // keep chat-mode stars off the very top bar
  if (mode < 1) for (const id in out) out[id].y = Math.max(out[id].y, 90 * (1 - mode));
  return out;
}

function intensity(st: AgentStatus, t: number, since: number, reduced: boolean): number {
  const k = reduced ? 0 : 1;
  switch (st) {
    case "idle": return 0.38 + 0.04 * Math.sin(t * 0.9) * k;
    case "thinking": return 0.62 + 0.16 * Math.sin(t * 2.2) * k;
    case "working": return 0.98 + 0.08 * Math.sin(t * 6) * k;
    case "waiting": return 0.5 + 0.14 * Math.sin(t * 1.3) * k;
    case "needs-input": return 0.85 + 0.25 * Math.sin(t * 4.5) * k;
    case "complete": return 0.85 + 0.6 * Math.max(0, 1 - (Date.now() - since) / 1200);
    case "error": return 0.7 + 0.15 * Math.sin(t * 9) * k;
    case "paused": return 0.3;
  }
}

export default function Constellation() {
  const { stateRef, dispatch } = useStore();
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0, h = 0, dpr = 1;
    let raf = 0;
    const stars: BgStar[] = [];
    const shooting: Shooting[] = [];
    const live = new Map<string, Live>();
    const linkAlpha = new Map<string, number>();
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, px: -999, py: -999 };
    let mode = stateRef.current.commandCenter ? 1 : 0;
    let hoverId: string | null = null;
    let nextShoot = performance.now() + 2500;
    let last = performance.now();
    const family = getComputedStyle(document.body).fontFamily || "ui-sans-serif, system-ui";

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(Math.min(520, (w * h) / 3200));
      stars.length = 0;
      for (let i = 0; i < target; i++) {
        const z = Math.pow(Math.random(), 1.8) * 0.9 + 0.1;
        stars.push({ x: Math.random() * 1.2 - 0.1, y: Math.random() * 1.2 - 0.1, z, r: 0.3 + z * 1.1 * Math.random() + 0.2, tw: Math.random() * TAU, hue: Math.random() });
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / w - 0.5) * 2;
      mouse.ty = (e.clientY / h - 0.5) * 2;
      mouse.px = e.clientX;
      mouse.py = e.clientY;
    };
    const onLeave = () => { mouse.px = mouse.py = -999; };
    const onClick = () => dispatch({ type: "SELECT", id: hoverId });
    window.addEventListener("pointermove", onMove, { passive: true });
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);

    const draw = (nowMs: number) => {
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      const t = nowMs / 1000;
      const now = Date.now();
      const s: State = stateRef.current;
      const red = reducedRef.current;

      const targetMode = s.commandCenter ? 1 : 0;
      mode = red ? targetMode : lerp(mode, targetMode, 1 - Math.pow(0.02, dt));
      if (!red) {
        mouse.x = lerp(mouse.x, mouse.tx, 1 - Math.pow(0.05, dt));
        mouse.y = lerp(mouse.y, mouse.ty, 1 - Math.pow(0.05, dt));
      }

      ctx.clearRect(0, 0, w, h);

      /* -------- background field (zooms out with command mode) -------- */
      const zoom = 1 - mode * 0.28;
      const cx = w / 2, cy = h / 2;
      for (const st of stars) {
        if (!red) {
          st.x += dt * 0.004 * st.z;
          st.y += dt * 0.0012 * st.z;
          if (st.x > 1.1) st.x -= 1.2;
          if (st.y > 1.1) st.y -= 1.2;
        }
        const pz = zoom + (1 - zoom) * (1 - st.z) * 0.6;
        const x = cx + (st.x * w - cx) * pz - mouse.x * st.z * 18;
        const y = cy + (st.y * h - cy) * pz - mouse.y * st.z * 12;
        const a = (0.25 + st.z * 0.6) * (red ? 1 : 0.75 + 0.25 * Math.sin(t * (0.6 + st.z) + st.tw));
        ctx.fillStyle = st.hue > 0.85 ? `rgba(196,170,255,${a})` : st.hue > 0.7 ? `rgba(150,200,255,${a})` : `rgba(235,238,255,${a})`;
        const r = st.r;
        if (r < 1) ctx.fillRect(x, y, r * 1.4, r * 1.4);
        else { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      }

      /* -------- shooting stars -------- */
      if (!red && nowMs > nextShoot) {
        nextShoot = nowMs + 3500 + Math.random() * 6000;
        const fromLeft = Math.random() < 0.5;
        shooting.push({ x: fromLeft ? Math.random() * w * 0.5 : w * 0.5 + Math.random() * w * 0.5, y: Math.random() * h * 0.35, vx: (fromLeft ? 1 : -1) * (520 + Math.random() * 300), vy: 160 + Math.random() * 120, life: 1 });
      }
      for (let i = shooting.length - 1; i >= 0; i--) {
        const sh = shooting[i];
        sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt * 0.9;
        if (sh.life <= 0) { shooting.splice(i, 1); continue; }
        const tx = sh.x - sh.vx * 0.16, ty = sh.y - sh.vy * 0.16;
        const g = ctx.createLinearGradient(sh.x, sh.y, tx, ty);
        g.addColorStop(0, `rgba(255,255,255,${0.8 * sh.life})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = g; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(tx, ty); ctx.stroke();
      }

      /* -------- agent positions -------- */
      const targets = layout(s.agents, w, h, mode, red ? 0 : t);
      const pos: Record<string, Live> = {};
      for (const a of s.agents) {
        const tg = targets[a.id];
        let L = live.get(a.id);
        if (!L) {
          L = { x: tg.x, y: tg.y, status: a.status, since: a.statusSince, hover: 0, sel: 0, prevStatus: a.status, flashAt: 0 };
          live.set(a.id, L);
        }
        const k = red ? 1 : 1 - Math.pow(0.03, dt);
        L.x = lerp(L.x, tg.x - mouse.x * 26, k);
        L.y = lerp(L.y, tg.y - mouse.y * 18, k);
        if (a.status !== L.status) {
          L.prevStatus = L.status;
          L.status = a.status;
          L.since = now;
          if (a.status === "complete") L.flashAt = now;
        }
        L.hover = lerp(L.hover, hoverId === a.id ? 1 : 0, 1 - Math.pow(0.001, dt));
        L.sel = lerp(L.sel, s.selectedAgentId === a.id ? 1 : 0, 1 - Math.pow(0.001, dt));
        pos[a.id] = L;
      }
      for (const id of Array.from(live.keys())) if (!pos[id]) live.delete(id);

      /* -------- hover hit test -------- */
      let best: string | null = null, bestD = 26 * 26;
      for (const a of s.agents) {
        const p = pos[a.id];
        const d = (p.x - mouse.px) ** 2 + (p.y - mouse.py) ** 2;
        if (d < bestD) { bestD = d; best = a.id; }
      }
      hoverId = best;
      canvas.style.cursor = best ? "pointer" : "default";

      /* -------- collaboration links -------- */
      const activeLinks = new Set<string>();
      for (const p of s.projects) {
        if (p.doneAt && now - p.doneAt > 2500) continue;
        for (const tid of p.taskIds) {
          const tk = s.tasks[tid];
          if (!tk) continue;
          const running = ["thinking", "working", "needs-input", "error", "paused"].includes(tk.status);
          if (!running) continue;
          for (const d of tk.dependsOn) {
            const dt2 = s.tasks[d];
            if (dt2 && dt2.agentId !== tk.agentId) activeLinks.add(`${dt2.agentId}|${tk.agentId}`);
          }
          if (!tk.dependsOn.length && !p.background) activeLinks.add(`atlas|${tk.agentId}`);
        }
      }
      for (const k of activeLinks) if (!linkAlpha.has(k)) linkAlpha.set(k, 0);
      ctx.lineCap = "round";
      for (const [k, a0] of linkAlpha) {
        const target = activeLinks.has(k) ? 1 : 0;
        const a = red ? target : lerp(a0, target, 1 - Math.pow(0.15, dt));
        if (a < 0.01 && !target) { linkAlpha.delete(k); continue; }
        linkAlpha.set(k, a);
        const [f, to] = k.split("|");
        const A = pos[f], B = pos[to];
        if (!A || !B) continue;
        const ca = s.agents.find((x) => x.id === f)!.color;
        const cb = s.agents.find((x) => x.id === to)!.color;
        const strength = (0.25 + mode * 0.35) * a;
        const g = ctx.createLinearGradient(A.x, A.y, B.x, B.y);
        g.addColorStop(0, rgba(ca, strength));
        g.addColorStop(1, rgba(cb, strength));
        ctx.strokeStyle = g;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 6]);
        ctx.lineDashOffset = red ? 0 : -t * 18;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        ctx.setLineDash([]);
        // ambient particles along the link
        if (!red) {
          for (let i = 0; i < 2; i++) {
            const u = (t * 0.22 + i * 0.5 + (k.length % 7) * 0.13) % 1;
            const x = lerp(A.x, B.x, u), y = lerp(A.y, B.y, u);
            ctx.fillStyle = rgba(cb, 0.7 * a * Math.sin(u * Math.PI));
            ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fill();
          }
        }
      }

      /* -------- work transfer packets -------- */
      for (const tr of s.transfers) {
        const u0 = (now - tr.at) / 1500;
        if (u0 < 0 || u0 > 1.25) continue;
        const A = pos[tr.from], B = pos[tr.to];
        if (!A || !B) continue;
        const col = s.agents.find((x) => x.id === tr.from)?.color ?? "#fff";
        const mx = (A.x + B.x) / 2 + (B.y - A.y) * 0.18;
        const my = (A.y + B.y) / 2 - (B.x - A.x) * 0.18;
        const at = (u: number) => {
          const v = 1 - u;
          return [v * v * A.x + 2 * v * u * mx + u * u * B.x, v * v * A.y + 2 * v * u * my + u * u * B.y];
        };
        if (u0 <= 1) {
          const u = ease(u0);
          const trail = red ? 1 : 7;
          for (let i = trail - 1; i >= 0; i--) {
            const uu = Math.max(0, u - i * 0.025);
            const [x, y] = at(uu);
            const fall = 1 - i / trail;
            ctx.fillStyle = rgba(i === 0 ? "#ffffff" : col, 0.9 * fall);
            ctx.beginPath(); ctx.arc(x, y, i === 0 ? 2.4 : 1.8 * fall, 0, TAU); ctx.fill();
          }
          const [hx, hy] = at(u);
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(glowSprite(col), hx - 14, hy - 14, 28, 28);
          ctx.globalCompositeOperation = "source-over";
        } else {
          // arrival ripple
          const r = (u0 - 1) / 0.25;
          ctx.strokeStyle = rgba(col, 0.6 * (1 - r));
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(B.x, B.y, 10 + r * 18, 0, TAU); ctx.stroke();
        }
      }

      /* -------- agent stars -------- */
      ctx.globalCompositeOperation = "lighter";
      for (const a of s.agents) {
        const p = pos[a.id];
        const isAtlas = a.id === "atlas";
        let I = intensity(a.status, t, p.since, red);
        let scale = 1;
        const birth = a.bornAt ? (now - a.bornAt) / 3000 : 2;
        if (birth < 1) {
          // tiny particle → expanding glow → stable star
          if (birth < 0.35) {
            const q = birth / 0.35;
            for (let i = 0; i < 18; i++) {
              const ang = (i / 18) * TAU + q * 3;
              const r = (1 - ease(q)) * 70 + 2;
              ctx.fillStyle = rgba(a.color, 0.8 * q);
              ctx.beginPath(); ctx.arc(p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r, 1.2, 0, TAU); ctx.fill();
            }
            I = 0.3 * q; scale = 0.2;
          } else if (birth < 0.7) {
            const q = (birth - 0.35) / 0.35;
            I = 1 + 1.6 * Math.sin(q * Math.PI); scale = 0.3 + ease(q) * 1.6;
            ctx.strokeStyle = rgba(a.color, 0.5 * (1 - q));
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(p.x, p.y, 8 + ease(q) * 90, 0, TAU); ctx.stroke();
          } else {
            const q = (birth - 0.7) / 0.3;
            scale = lerp(1.9, 1, ease(q)); I = lerp(1.6, 0.8, ease(q));
          }
        }
        const baseR = (isAtlas ? 30 : 22) * (1 + mode * 0.2);
        const R = baseR * scale * (0.7 + I * 0.55) * (1 + p.hover * 0.18 + p.sel * 0.15);
        const sprite = glowSprite(a.status === "error" ? "#FF8A6B" : a.color);
        ctx.globalAlpha = Math.min(1, 0.35 + I * 0.6);
        ctx.drawImage(sprite, p.x - R * 2, p.y - R * 2, R * 4, R * 4);
        ctx.globalAlpha = 1;
        // core
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, 0.55 + I * 0.45)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, (isAtlas ? 3.4 : 2.4) * scale * (0.8 + I * 0.3), 0, TAU); ctx.fill();
        // diffraction spikes for bright stars
        if (I > 0.8 || isAtlas) {
          const len = R * 1.4 * Math.min(1.2, I);
          const g = ctx.createLinearGradient(p.x - len, p.y, p.x + len, p.y);
          g.addColorStop(0, rgba(a.color, 0)); g.addColorStop(0.5, rgba(a.color, 0.5)); g.addColorStop(1, rgba(a.color, 0));
          ctx.fillStyle = g; ctx.fillRect(p.x - len, p.y - 0.5, len * 2, 1);
          const g2 = ctx.createLinearGradient(p.x, p.y - len, p.x, p.y + len);
          g2.addColorStop(0, rgba(a.color, 0)); g2.addColorStop(0.5, rgba(a.color, 0.4)); g2.addColorStop(1, rgba(a.color, 0));
          ctx.fillStyle = g2; ctx.fillRect(p.x - 0.5, p.y - len * 0.8, 1, len * 1.6);
        }
      }
      ctx.globalCompositeOperation = "source-over";

      // rings, arcs and labels
      for (const a of s.agents) {
        const p = pos[a.id];
        if (a.bornAt && now - a.bornAt < 2100) continue;
        const isAtlas = a.id === "atlas";
        const ringR = isAtlas ? 17 : 13;
        // working: progress arc + orbiting sparks
        if (a.status === "working" || a.status === "thinking") {
          const tk = currentTask(s, a.id);
          const prog = tk ? tk.progress / 100 : 0;
          ctx.strokeStyle = "rgba(255,255,255,0.08)";
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, ringR, 0, TAU); ctx.stroke();
          ctx.strokeStyle = rgba(a.color, 0.9);
          ctx.beginPath(); ctx.arc(p.x, p.y, ringR, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.03, prog)); ctx.stroke();
          if (!red && a.status === "working") {
            for (let i = 0; i < 2; i++) {
              const ang = t * 2.4 + i * Math.PI;
              ctx.fillStyle = rgba(a.color, 0.9);
              ctx.beginPath(); ctx.arc(p.x + Math.cos(ang) * (ringR + 5), p.y + Math.sin(ang) * (ringR + 5) * 0.6, 1.2, 0, TAU); ctx.fill();
            }
          }
          if (a.status === "thinking" && !red) {
            ctx.strokeStyle = rgba(a.color, 0.35);
            ctx.setLineDash([1, 5]);
            ctx.lineDashOffset = -t * 10;
            ctx.beginPath(); ctx.arc(p.x, p.y, ringR + 6, 0, TAU); ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        if (a.status === "needs-input") {
          const q = red ? 0.3 : (t * 0.8) % 1;
          ctx.strokeStyle = `rgba(255,200,110,${0.7 * (1 - q)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, ringR + q * 26, 0, TAU); ctx.stroke();
        }
        if (a.status === "error") {
          ctx.strokeStyle = `rgba(255,130,100,${0.5 + 0.3 * Math.sin(t * 8)})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.arc(p.x, p.y, ringR + 2, 0, TAU); ctx.stroke();
          ctx.setLineDash([]);
        }
        if (p.flashAt && now - p.flashAt < 1400) {
          const q = (now - p.flashAt) / 1400;
          ctx.strokeStyle = rgba(a.color, 0.8 * (1 - q));
          ctx.lineWidth = 1.5 * (1 - q) + 0.3;
          ctx.beginPath(); ctx.arc(p.x, p.y, ringR + ease(q) * 44, 0, TAU); ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - q)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, ringR + ease(q) * 24, 0, TAU); ctx.stroke();
        }
        if (p.sel > 0.02) {
          ctx.strokeStyle = `rgba(255,255,255,${0.5 * p.sel})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, ringR + 10, 0, TAU); ctx.stroke();
        }
        // labels
        const labelA = 0.42 + mode * 0.3 + p.hover * 0.5 + p.sel * 0.4 + (a.status === "working" ? 0.15 : 0);
        ctx.textAlign = "center";
        ctx.font = `500 ${isAtlas ? 12 : 11}px ${family}`;
        ctx.fillStyle = `rgba(236,238,255,${Math.min(1, labelA)})`;
        ctx.fillText(a.name.toUpperCase().split("").join(" "), p.x, p.y + ringR + 20);
        if (p.hover > 0.05 || mode > 0.5 || p.sel > 0.5) {
          ctx.font = `400 10.5px ${family}`;
          ctx.fillStyle = `rgba(170,178,210,${Math.min(1, Math.max(p.hover, mode * 0.8, p.sel))})`;
          const tk = currentTask(s, a.id);
          const sub = a.status === "idle" ? a.role : `${a.role} · ${a.status === "working" && tk ? tk.progress + "%" : a.status.replace("-", " ")}`;
          ctx.fillText(sub, p.x, p.y + ringR + 34);
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, [stateRef, dispatch]);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0" aria-label="Agent constellation" />;
}
