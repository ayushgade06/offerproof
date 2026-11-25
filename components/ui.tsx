import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type { Severity, Source, Verdict } from "@/lib/types";
import { IconGlobe, IconQuote, IconRule, IconSpinner } from "./icons";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,color,box-shadow,transform] duration-150",
        "active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0",
        size === "lg" ? "min-h-12 px-5 text-[15px]" : "min-h-11 px-4 text-sm",
        variant === "primary" &&
          "bg-ink text-paper shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_2px_6px_-2px_rgba(0,0,0,0.4)] hover:bg-ink-2",
        variant === "secondary" && "border border-rule-strong bg-card text-ink hover:border-ink/40 hover:bg-paper-2",
        variant === "ghost" && "text-ink-2 hover:bg-paper-2 hover:text-ink",
        className
      )}
    >
      {loading && <IconSpinner className="spin" size={16} />}
      {children}
    </button>
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx("rounded-xl border border-rule bg-card shadow-card", className)} />;
}

const SEVERITY: Record<Severity, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-risk text-paper" },
  high: { label: "High", cls: "border border-risk/60 text-risk-ink" },
  medium: { label: "Medium", cls: "border border-warn/70 text-warn-ink" },
  low: { label: "Low", cls: "border border-rule-strong text-muted" },
};

export function Chip({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity];
  return (
    <span className={cx("inline-flex h-5 items-center rounded px-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider", s.cls)}>
      {s.label}
    </span>
  );
}

const SOURCE: Record<Source, { label: string; icon: ReactNode }> = {
  rule: { label: "Rule", icon: <IconRule size={13} /> },
  lookup: { label: "Live lookup", icon: <IconGlobe size={13} /> },
  ai: { label: "AI, verified quote", icon: <IconQuote size={13} /> },
};

export function SourceBadge({ source }: { source: Source }) {
  const s = SOURCE[source];
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-muted">
      {s.icon}
      {s.label}
    </span>
  );
}

export const VERDICT_STYLE: Record<Verdict, { color: string; stamp: string }> = {
  high_risk: { color: "text-risk", stamp: "High risk" },
  suspicious: { color: "text-warn-ink", stamp: "Suspicious" },
  no_major_flags: { color: "text-ok", stamp: "No major flags" },
};

export function Stamp({ verdict, className }: { verdict: Verdict; className?: string }) {
  const v = VERDICT_STYLE[verdict];
  return (
    <span
      aria-hidden
      className={cx(
        "stamp stamp-in inline-block px-3 py-1.5 font-mono text-lg font-bold uppercase leading-none tracking-[0.18em] sm:text-xl",
        v.color,
        className
      )}
    >
      {v.stamp}
    </span>
  );
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted", className)}>{children}</p>;
}

export { cx };
