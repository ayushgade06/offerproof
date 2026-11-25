"use client";

import { useRef, useState } from "react";
import { InputPanel, type InputValue } from "@/components/input-panel";
import { ProgressSteps } from "@/components/progress";
import { Results } from "@/components/results";
import { IconWarning } from "@/components/icons";
import { downscaleImage } from "@/lib/image";
import type { Sample } from "@/lib/samples";
import type { AnalysisResult } from "@/lib/types";

type Phase =
  | { k: "idle" }
  | { k: "loading"; fromImage: boolean }
  | { k: "done"; result: AnalysisResult }
  | { k: "error"; message: string };

const EMPTY: InputValue = { text: "", image: null };

export function Checker({ hero, footer }: { hero: React.ReactNode; footer?: React.ReactNode }) {
  const [input, setInput] = useState<InputValue>(EMPTY);
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const reqId = useRef(0);

  async function run(v: InputValue) {
    const id = ++reqId.current;
    setPhase({ k: "loading", fromImage: Boolean(v.image) });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(v.image ? { image: v.image.dataUrl } : { text: v.text }),
      });
      const data = await res.json().catch(() => null);
      if (id !== reqId.current) return;
      if (!res.ok || !data || data.error) {
        setPhase({ k: "error", message: data?.error?.message ?? "Something went wrong. Please try again." });
        return;
      }
      setPhase({ k: "done", result: data as AnalysisResult });
    } catch {
      if (id === reqId.current) setPhase({ k: "error", message: "We couldn't reach OfferProof. Check your connection and try again." });
    }
  }

  async function onSample(s: Sample) {
    if (s.kind === "text" && s.text) {
      const v = { text: s.text, image: null };
      setInput(v);
      void run(v);
      return;
    }
    if (s.imageSrc) {
      setPhase({ k: "loading", fromImage: true });
      try {
        const blob = await (await fetch(s.imageSrc)).blob();
        const v = { text: "", image: { dataUrl: await downscaleImage(blob), name: "Fictional Telegram screenshot" } };
        setInput(v);
        void run(v);
      } catch {
        setPhase({ k: "error", message: "Couldn't load the example screenshot." });
      }
    }
  }

  function reset() {
    reqId.current++;
    setInput(EMPTY);
    setPhase({ k: "idle" });
    window.scrollTo({ top: 0 });
  }

  if (phase.k === "done") return <Results result={phase.result} onReset={reset} />;

  return (
    <>
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
      {hero}
      <div className="mt-10">
        {phase.k === "loading" ? (
          <ProgressSteps fromImage={phase.fromImage} />
        ) : (
          <>
            {phase.k === "error" && (
              <div role="alert" className="mb-6 flex items-start gap-3 rounded-lg border border-risk/40 bg-risk/5 px-4 py-3 text-[14px]">
                <IconWarning size={18} className="mt-0.5 shrink-0 text-risk" />
                <div className="flex-1">
                  <p className="font-medium">{phase.message}</p>
                  {input.image && (
                    <button type="button" className="mt-1 text-[13px] font-medium text-ink-2 underline underline-offset-4" onClick={() => setInput({ ...input, image: null })}>
                      Remove the screenshot and paste the text instead
                    </button>
                  )}
                </div>
              </div>
            )}
            <InputPanel value={input} onChange={setInput} onSubmit={() => run(input)} onSample={onSample} busy={false} />
          </>
        )}
      </div>
    </div>
    {footer}
    </>
  );
}
