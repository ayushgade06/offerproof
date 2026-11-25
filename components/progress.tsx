"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconSpinner } from "./icons";
import { cx, Kicker } from "./ui";

// Stages are advanced by timers matching the typical pipeline order. They are labeled as stages, not percentages.
const STEPS_TEXT = [
  { label: "Checking 12 red-flag rules", at: 0 },
  { label: "Looking up domains and mail servers", at: 500 },
  { label: "AI review: every flag must quote your text", at: 1300 },
  { label: "Scoring the verdict", at: 3200 },
];
const STEPS_IMAGE = [{ label: "Reading your screenshot", at: 0 }, ...STEPS_TEXT.map((s) => ({ ...s, at: s.at + 3500 }))];

export function ProgressSteps({ fromImage }: { fromImage: boolean }) {
  const steps = fromImage ? STEPS_IMAGE : STEPS_TEXT;
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const timers = steps.slice(1).map((s, i) => setTimeout(() => setCurrent(i + 1), s.at));
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  return (
    <div className="receipt rounded-sm px-5 py-7 sm:px-8 sm:py-9">
      <Kicker>Checking your offer</Kicker>
      <p className="mt-2 font-serif text-3xl tracking-tight">Reading the fine print…</p>
      <ol className="mt-6 space-y-3.5" aria-live="polite">
        {steps.map((s, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li key={s.label} className={cx("flex items-center gap-3 font-mono text-[13.5px]", i > current && "text-muted/70")}>
              <span aria-hidden className={cx("grid size-6 shrink-0 place-items-center rounded-full border", done ? "border-ok bg-ok text-paper" : now ? "border-ink" : "border-rule-strong")}>
                {done ? <IconCheck size={14} /> : now ? <IconSpinner size={14} className="spin" /> : null}
              </span>
              <span>
                {s.label}
                {now && <span className="sr-only"> (in progress)</span>}
                {done && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <hr className="dashed-rule mt-7" />
      <p className="mt-3 font-mono text-[11px] text-muted">Usually under 10 seconds. Nothing you paste is stored.</p>
    </div>
  );
}
