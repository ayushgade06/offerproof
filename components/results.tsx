"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildSegments } from "@/lib/highlight";
import { VERDICT_LABEL } from "@/lib/score";
import type { AnalysisResult, Check, Signal } from "@/lib/types";
import { IconArrowLeft, IconCheck, IconChevron, IconFlag, IconMinus, IconWarning } from "./icons";
import { ShareButton } from "./share-button";
import { Button, Chip, cx, Kicker, SourceBadge, Stamp, VERDICT_STYLE } from "./ui";

type Active = number | null;

const PROVIDER_NAME = { adaption: "Adaption Labs", anthropic: "Anthropic", none: "" } as const;

function ScoreRing({ score, verdict }: { score: number; verdict: AnalysisResult["verdict"] }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(score));
    return () => cancelAnimationFrame(id);
  }, [score]);
  return (
    <div className={cx("relative size-[76px] shrink-0", VERDICT_STYLE[verdict].color)}>
      <svg viewBox="0 0 76 76" className="size-full -rotate-90" aria-hidden>
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--rule)" strokeWidth="6" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown / 100)}
          className="ring-in"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <span>
          <span className="block font-mono text-xl font-semibold text-ink tabular-nums">{score}</span>
          <span className="block font-mono text-[9px] tracking-wider text-muted">/100</span>
        </span>
      </div>
    </div>
  );
}

function VerdictCard({ result }: { result: AnalysisResult }) {
  const label = VERDICT_LABEL[result.verdict];
  const n = result.signals.length;
  return (
    <section aria-labelledby="verdict-title" className="rounded-xl border border-rule bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Kicker>Verdict</Kicker>
          <h2 id="verdict-title" className="mt-2 font-serif text-[2.1rem] leading-[1.05] tracking-tight sm:text-[2.4rem]">
            {label.title}
          </h2>
          <p className={cx("mt-1 text-[15px] font-medium", VERDICT_STYLE[result.verdict].color)}>{label.sub}</p>
        </div>
        <ScoreRing score={result.score} verdict={result.verdict} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Stamp verdict={result.verdict} />
        <p className="font-mono text-xs text-muted">
          {n === 0 ? "0 red flags" : `${n} red flag${n === 1 ? "" : "s"}`} · risk score {result.score}/100
        </p>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{result.summary}</p>
      {result.verdict === "no_major_flags" && (
        <p className="mt-3 rounded-md bg-paper-2 px-3 py-2 text-[13.5px] text-ink-2">
          No tool can promise an offer is real. Use the verification steps below before you share documents or money.
        </p>
      )}
    </section>
  );
}

function HighlightedText({ result, active, setActive }: { result: AnalysisResult; active: Active; setActive: (a: Active) => void }) {
  const segments = useMemo(() => buildSegments(result.text, result.signals), [result]);
  const [open, setOpen] = useState(!result.fromImage);
  const body = (
    <div className="draw-in whitespace-pre-wrap break-words px-5 py-5 font-mono text-[13.5px] leading-[1.75] text-ink sm:px-6">
      {segments.map((s, i) =>
        s.mark ? (
          <mark
            key={i}
            tabIndex={0}
            data-active={s.mark.nums.includes(active ?? -1)}
            style={{ ["--i" as string]: s.mark.index }}
            aria-describedby={s.mark.nums.map((n) => `receipt-${n}`).join(" ")}
            onMouseEnter={() => setActive(s.mark!.nums[0])}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(s.mark!.nums[0])}
            onBlur={() => setActive(null)}
            onClick={() => document.getElementById(`receipt-${s.mark!.nums[0]}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
            className={cx("mark", s.mark.tone === "risk" ? "mark-risk" : "mark-warn")}
          >
            <span className="sr-only">Red flag {s.mark.nums.join(" and ")}: </span>
            {s.text}
            <sup aria-hidden>{s.mark.nums.join(",")}</sup>
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </div>
  );
  return (
    <section aria-labelledby="msg-title" className="receipt rounded-sm lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <h2 id="msg-title">
          <Kicker>{result.fromImage ? "Text we read from your screenshot" : "Your message, marked up"}</Kicker>
        </h2>
        <span className="font-mono text-[11px] text-muted">{result.text.length.toLocaleString("en-US")} chars</span>
      </div>
      <hr className="dashed-rule mx-5 mt-4 sm:mx-6" />
      {result.fromImage ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mx-5 mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-ink-2 hover:bg-paper-2 sm:mx-6"
          >
            <IconChevron size={15} className={cx("transition-transform", open && "rotate-180")} />
            {open ? "Hide transcribed text" : "Show transcribed text with highlights"}
          </button>
          {open && body}
        </>
      ) : (
        body
      )}
      <hr className="dashed-rule mx-5 sm:mx-6" />
      <p className="px-5 pb-6 pt-3 font-mono text-[11px] leading-relaxed text-muted sm:px-6">
        Numbers match the receipts. Hover or tab to a highlight to see why.
      </p>
    </section>
  );
}

function ReceiptItem({ s, n, active, setActive }: { s: Signal; n: number; active: Active; setActive: (a: Active) => void }) {
  const on = active === n;
  return (
    <li
      id={`receipt-${n}`}
      tabIndex={0}
      onMouseEnter={() => setActive(n)}
      onMouseLeave={() => setActive(null)}
      onFocus={() => setActive(n)}
      onBlur={() => setActive(null)}
      style={{ ["--i" as string]: n }}
      className={cx(
        "rise relative grid grid-cols-[28px_1fr] gap-3 rounded-lg border px-3.5 py-3.5 transition-colors sm:px-4",
        on ? "border-risk/50 bg-paper-2" : "border-transparent hover:border-rule"
      )}
    >
      <span
        aria-hidden
        className={cx(
          "grid size-7 place-items-center rounded-full font-mono text-[12px] font-semibold",
          s.weight >= 0.3 ? "bg-risk text-paper" : "border border-warn text-warn-ink"
        )}
      >
        {n}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <h3 className="text-[15px] font-semibold leading-snug">
            <span className="sr-only">Red flag {n}: </span>
            {s.title}
          </h3>
          <Chip severity={s.severity} />
        </div>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{s.explanation}</p>
        {s.evidence.length > 0 && s.source !== "lookup" && (
          <ul className="mt-2 space-y-1">
            {s.evidence.slice(0, 3).map((e, i) => (
              <li key={i} className="border-l-2 border-rule-strong pl-2.5 font-mono text-[12.5px] leading-relaxed text-ink-2">
                “{e.quote.length > 140 ? e.quote.slice(0, 140) + "…" : e.quote}”
              </li>
            ))}
          </ul>
        )}
        {s.aiNote && (
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            <span className="font-medium text-ink-2">AI reviewer agrees:</span> {s.aiNote}
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <SourceBadge source={s.source} />
          {s.detail && (
            <span className="font-mono text-[11.5px] text-muted">
              {s.detail.includes("RDAP") ? (
                <>
                  {s.detail.split("RDAP")[0]}
                  <abbr title="RDAP: the official domain registration database" className="cursor-help underline decoration-dotted underline-offset-2">
                    RDAP
                  </abbr>
                  {s.detail.split("RDAP")[1]}
                </>
              ) : (
                s.detail
              )}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function Receipts({ result, active, setActive }: { result: AnalysisResult; active: Active; setActive: (a: Active) => void }) {
  return (
    <section aria-labelledby="receipts-title">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id="receipts-title" className="font-serif text-2xl tracking-tight">
          Receipts
        </h2>
        <span className="font-mono text-[11px] text-muted">Why we flagged it</span>
      </div>
      {result.signals.length ? (
        <ol className="mt-3 space-y-1.5 rounded-xl border border-rule bg-card p-1.5 shadow-card sm:p-2">
          {result.signals.map((s, i) => (
            <ReceiptItem key={s.id + i} s={s} n={i + 1} active={active} setActive={setActive} />
          ))}
        </ol>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-rule-strong bg-card/60 px-5 py-6 text-[14px] text-ink-2">
          None of our {result.checks.length} checks raised a flag. That&apos;s a good sign, not a guarantee: scammers keep inventing new scripts.
        </div>
      )}
    </section>
  );
}

const STATUS: Record<Check["status"], { icon: React.ReactNode; label: string; cls: string }> = {
  passed: { icon: <IconCheck size={15} />, label: "Passed", cls: "text-ok" },
  flagged: { icon: <IconFlag size={15} />, label: "Flagged", cls: "text-risk" },
  unavailable: { icon: <IconMinus size={15} />, label: "Unavailable", cls: "text-muted" },
  skipped: { icon: <IconMinus size={15} />, label: "Skipped", cls: "text-muted" },
};

function ChecksList({ checks }: { checks: Check[] }) {
  const count = (s: Check["status"]) => checks.filter((c) => c.status === s).length;
  return (
    <details className="group rounded-xl border border-rule bg-card shadow-card">
      <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl px-5 py-3 hover:bg-paper-2/60">
        <span>
          <span className="block text-[15px] font-semibold">All {checks.length} checks we ran</span>
          <span className="mt-0.5 block font-mono text-[11.5px] text-muted">
            {count("flagged")} flagged · {count("passed")} passed · {count("unavailable") + count("skipped")} skipped or unavailable
          </span>
        </span>
        <IconChevron className="chev text-muted transition-transform" />
      </summary>
      <ul className="border-t border-rule px-5 py-2">
        {checks.map((c) => {
          const st = STATUS[c.status];
          return (
            <li key={c.id} className="grid grid-cols-[20px_1fr_auto] items-start gap-2.5 border-b border-rule/60 py-2.5 last:border-0">
              <span className={cx("mt-0.5", st.cls)} aria-hidden>
                {st.icon}
              </span>
              <span className="min-w-0 text-[13.5px]">
                <span className="break-words">{c.label}</span>
                {c.detail && <span className="block font-mono text-[11.5px] text-muted">{c.detail}</span>}
              </span>
              <span className={cx("font-mono text-[11px] uppercase tracking-wide", st.cls)}>{st.label}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function NextSteps({ steps, region }: { steps: string[]; region: AnalysisResult["region"] }) {
  return (
    <section aria-labelledby="steps-title" className="rounded-xl border border-rule bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-baseline justify-between">
        <h2 id="steps-title" className="font-serif text-2xl tracking-tight">
          What to do now
        </h2>
        <span className="font-mono text-[11px] text-muted">{region === "IN" ? "India resources" : "Global resources"}</span>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="grid grid-cols-[22px_1fr] gap-3 text-[14.5px] leading-relaxed text-ink-2">
            <span aria-hidden className="mt-[3px] grid size-[18px] place-items-center rounded-[4px] border border-rule-strong font-mono text-[10px] text-muted">
              {i + 1}
            </span>
            <span>
              {s.split(/(cybercrime\.gov\.in|reportfraud\.ftc\.gov)/).map((part, j) =>
                /cybercrime\.gov\.in|reportfraud\.ftc\.gov/.test(part) ? (
                  <a key={j} href={`https://${part}`} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-4">
                    {part}
                  </a>
                ) : (
                  part
                )
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Results({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const [active, setActive] = useState<Active>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [result]);
  const e = result.engine;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onReset}>
          <IconArrowLeft size={16} /> Check another
        </Button>
        <p className="font-mono text-[11.5px] text-muted">
          {e.provider === "none" ? (
            "AI review unavailable · rules + lookups only"
          ) : (
            <>
              AI review: {PROVIDER_NAME[e.provider]} · {e.model} · {(e.latencyMs / 1000).toFixed(1)} s
              {e.droppedUngrounded > 0 && ` · ${e.droppedUngrounded} unverifiable AI claim${e.droppedUngrounded === 1 ? "" : "s"} discarded`}
            </>
          )}
        </p>
      </div>
      <h1 ref={headRef} tabIndex={-1} className="sr-only">
        Result: {VERDICT_LABEL[result.verdict].title}
      </h1>
      <p role="status" aria-live="polite" className="sr-only">
        {`Verdict: ${VERDICT_LABEL[result.verdict].title}. ${VERDICT_LABEL[result.verdict].sub}. Risk score ${result.score} out of 100. ${result.signals.length} red flags.`}
      </p>

      {e.provider === "none" && (
        <div role="note" className="mt-4 flex items-start gap-3 rounded-lg border border-warn/50 bg-warn/10 px-4 py-3 text-[14px] text-ink">
          <IconWarning size={18} className="mt-0.5 shrink-0 text-warn-ink" />
          <p>
            <span className="font-semibold">AI review unavailable</span>, so this shows rule and lookup checks only. The verdict may miss
            subtler warning signs.
          </p>
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 [grid-template-areas:'verdict'_'receipts'_'text'_'steps'_'checks'] lg:grid-cols-[minmax(0,7fr)_minmax(0,6fr)] lg:gap-x-8 lg:[grid-template-areas:'text_verdict'_'text_receipts'_'text_steps'_'text_checks']">
        <div className="[grid-area:text]">
          <HighlightedText result={result} active={active} setActive={setActive} />
        </div>
        <div className="[grid-area:verdict]">
          <VerdictCard result={result} />
          {result.share && (
            <div className="mt-3">
              <ShareButton share={result.share} />
            </div>
          )}
        </div>
        <div className="[grid-area:receipts]">
          <Receipts result={result} active={active} setActive={setActive} />
        </div>
        <div className="[grid-area:steps]">
          <NextSteps steps={result.nextSteps} region={result.region} />
        </div>
        <div className="[grid-area:checks]">
          <ChecksList checks={result.checks} />
          <p className="mt-4 px-1 text-[12.5px] leading-relaxed text-muted">{result.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
