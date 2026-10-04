/** Orqivio AI identity: an open ring with a solid satellite dot, and a light geometric wordmark. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <circle cx="29" cy="29" r="20" stroke="currentColor" strokeWidth="3.6" />
      <circle cx="51" cy="49" r="5.2" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className = "text-[18px]" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-[0.32em] leading-none ${className}`}>
      <span className="font-light tracking-[-0.02em]">Orqivio</span>
      <span className="text-[0.72em] font-extralight tracking-[0.02em]">AI</span>
    </span>
  );
}

export const TAGLINE = "Build your agent team.";

/** Logo lockup: mark + wordmark, optionally with the tagline underneath. */
export default function Logo({ tagline = false, size = "md" }: { tagline?: boolean; size?: "sm" | "md" | "lg" }) {
  const s = { sm: ["h-7 w-7", "text-[16px]", "pl-[2.5rem]"], md: ["h-9 w-9", "text-[22px]", "pl-[3rem]"], lg: ["h-14 w-14", "text-[42px]", "pl-[4.25rem]"] }[size];
  return (
    <div className="inline-flex flex-col items-start gap-2.5">
      <div className="inline-flex items-center gap-3 text-white">
        <LogoMark className={s[0]} />
        <Wordmark className={s[1]} />
      </div>
      {tagline && <div className={`${s[2]} text-[11px] font-light tracking-[0.22em] text-mist`}>{TAGLINE}</div>}
    </div>
  );
}
