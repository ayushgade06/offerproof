import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { IconGlobe, IconQuote, IconRule } from "@/components/icons";
import { Kicker } from "@/components/ui";
import { SCORING } from "@/lib/score";

export const metadata: Metadata = {
  title: "How it works",
  description: "Rules, live lookups and a grounded AI review, plus measured accuracy and honest limitations.",
};

interface Metric {
  n: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  accuracy: number;
  confusion: { tp: number; fp: number; tn: number; fn: number };
  tiers: Record<string, number>;
}
interface EvalResults {
  generatedAt: string;
  provider: string;
  model: string | null;
  baseUrl?: string;
  datasets: Record<string, { n: number; description: string; source: string }>;
  metrics: Record<string, Metric>;
  notes: string[];
}

function loadResults(): EvalResults | null {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), "public", "eval", "results.json"), "utf8"));
  } catch {
    return null;
  }
}

const pct = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);

const PIPELINE = [
  { t: "Read", d: "Paste text, or drop a screenshot and a vision model transcribes it word for word." },
  { t: "Rules", d: "12 deterministic red-flag rules: fees, UPI handles, task scams, free-mail recruiters and more." },
  { t: "Lookups", d: "Live RDAP domain age, DNS mail-server checks, and lookalikes of 63 verified employer domains." },
  { t: "AI review", d: "An LLM flags subtler signs, but must quote your text exactly. Unfound quotes are discarded." },
  { t: "Verdict", d: "Signals combine into a 0–100 score. AI alone can never push a message to High risk." },
];

const LIMITATIONS = [
  "Our evaluation data is partly synthetic and hand-written, so it likely overestimates real-world accuracy.",
  "OfferProof only sees text. It can't verify claims inside PDFs or images beyond the words it reads.",
  "New scam scripts may not match our rules, and the AI reviewer can miss things.",
  "A young domain is a warning sign, not proof of a scam. An old domain isn't proof of safety.",
  "Some registries (including .in) don't publish registration dates, so the age check can't run for them.",
  "OfferProof never guarantees that an offer is safe. Always verify with the company directly.",
];

export default function HowItWorks() {
  const results = loadResults();
  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
      <Kicker>How it works</Kicker>
      <h1 className="mt-4 max-w-2xl font-serif text-5xl leading-[1.05] tracking-tight">Every flag comes with a receipt.</h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-2">
        General AI scam checkers give you a verdict and ask you to trust it. OfferProof shows its work: each red flag points to the exact words
        in your message, or to a live lookup you could repeat yourself.
      </p>

      {/* Pipeline */}
      <section aria-labelledby="pipe" className="mt-14">
        <h2 id="pipe" className="font-serif text-3xl tracking-tight">
          The pipeline
        </h2>
        <ol className="mt-6 grid gap-px overflow-hidden rounded-xl border border-rule bg-rule sm:grid-cols-5">
          {PIPELINE.map((p, i) => (
            <li key={p.t} className="relative bg-card p-4">
              <span className="font-mono text-[11px] text-muted">0{i + 1}</span>
              <p className="mt-1 font-semibold">{p.t}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{p.d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 font-mono text-[12px] text-muted">Rules, lookups and the AI review run in parallel. If the AI is down, rules and lookups still produce a result.</p>
      </section>

      {/* Evidence sources */}
      <section aria-labelledby="sources" className="mt-14">
        <h2 id="sources" className="font-serif text-3xl tracking-tight">
          Three kinds of evidence
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { i: <IconRule />, t: "Rule", d: "A deterministic pattern matched these exact characters. Same input, same result, every time." },
            { i: <IconGlobe />, t: "Live lookup", d: "We asked the domain registry or DNS just now. For example: \"registered 9 days ago\" or \"not registered\"." },
            { i: <IconQuote />, t: "AI, verified quote", d: "The AI raised it, and we confirmed the quoted words exist verbatim in your message before showing it." },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border border-rule bg-card p-5 shadow-card">
              <span className="text-ink">{c.i}</span>
              <p className="mt-3 font-semibold">{c.t}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Scoring */}
      <section aria-labelledby="score" className="mt-14 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 id="score" className="font-serif text-3xl tracking-tight">
            How the verdict is decided
          </h2>
          <p className="mt-4 leading-relaxed text-ink-2">
            Each signal has a weight. They combine as independent pieces of evidence: <span className="font-mono text-[14px]">score = 100 × (1 − Π(1 − w))</span>.
            A fee request alone (0.70) is already High risk; a fee plus a 9-day-old domain scores 85.
          </p>
          <p className="mt-3 leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">Anti-hallucination cap:</span> if no rule or lookup signal fires with weight ≥ {SCORING.capLiftWeight}, the score is capped
            at {SCORING.aiCap}. The AI can make us suspicious, but only hard evidence can make us say High risk.
          </p>
        </div>
        <dl className="self-start rounded-xl border border-rule bg-card p-5 font-mono text-[13px] shadow-card">
          {[
            ["High risk", `score ≥ ${SCORING.highRisk}`, "text-risk"],
            ["Suspicious", `${SCORING.suspicious}–${SCORING.highRisk - 1}`, "text-warn-ink"],
            ["No major red flags", `< ${SCORING.suspicious}`, "text-ok"],
          ].map(([k, v, c]) => (
            <div key={k} className="flex justify-between border-b border-rule/70 py-2.5 last:border-0">
              <dt className={`font-semibold ${c}`}>{k}</dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
          <p className="pt-3 font-sans text-[13px] text-muted">We never say &quot;safe&quot;. The lowest tier is &quot;No major red flags found&quot;, followed by how to verify.</p>
        </dl>
      </section>

      {/* Accuracy */}
      <section aria-labelledby="accuracy" className="mt-16">
        <h2 id="accuracy" className="font-serif text-3xl tracking-tight">
          Measured accuracy
        </h2>
        {!results ? (
          <p className="mt-4 rounded-xl border border-dashed border-rule-strong bg-card/60 p-5 text-ink-2">Evaluation not yet run.</p>
        ) : (
          <>
            <p className="mt-4 max-w-2xl leading-relaxed text-ink-2">
              We run labeled messages through the live <span className="font-mono text-[14px]">/api/analyze</span> endpoint. &quot;Flagged&quot; means High risk or Suspicious.
              Last run {results.generatedAt.slice(0, 10)} with AI provider <span className="font-mono text-[14px]">{results.provider}</span>
              {results.model ? <> ({results.model})</> : null}.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {Object.entries(results.metrics).map(([name, m]) => {
                const ds = results.datasets[name];
                return (
                  <div key={name} className="rounded-xl border border-rule bg-card p-5 shadow-card">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{name.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-[13px] text-muted">
                      {m.n} messages{ds ? ` · ${ds.description}` : ""}
                    </p>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {(
                        [
                          ["Precision", m.precision],
                          ["Recall", m.recall],
                          ["F1", m.f1],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k}>
                          <p className="font-serif text-3xl tabular-nums">{pct(v)}</p>
                          <p className="text-[12px] text-muted">{k}</p>
                        </div>
                      ))}
                    </div>
                    <table className="mt-5 w-full border-collapse font-mono text-[12px]">
                      <caption className="sr-only">Confusion matrix for {name}</caption>
                      <thead>
                        <tr className="text-muted">
                          <th scope="col" className="py-1 text-left font-normal"></th>
                          <th scope="col" className="py-1 text-right font-normal">Flagged</th>
                          <th scope="col" className="py-1 text-right font-normal">Not flagged</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-rule">
                          <th scope="row" className="py-1.5 text-left font-normal text-muted">Scam</th>
                          <td className="text-right">{m.confusion.tp}</td>
                          <td className="text-right">{m.confusion.fn}</td>
                        </tr>
                        <tr className="border-t border-rule">
                          <th scope="row" className="py-1.5 text-left font-normal text-muted">Legit</th>
                          <td className="text-right">{m.confusion.fp}</td>
                          <td className="text-right">{m.confusion.tn}</td>
                        </tr>
                      </tbody>
                    </table>
                    {ds?.source && <p className="mt-3 text-[12px] leading-relaxed text-muted">{ds.source}</p>}
                  </div>
                );
              })}
            </div>
            {results.notes.length > 0 && (
              <ul className="mt-5 list-disc space-y-1.5 pl-5 text-[14px] text-muted">
                {results.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Limitations */}
      <section id="limitations" aria-labelledby="limits" className="mt-16 scroll-mt-8">
        <h2 id="limits" className="font-serif text-3xl tracking-tight">
          Limitations
        </h2>
        <ul className="mt-5 space-y-3">
          {LIMITATIONS.map((l) => (
            <li key={l} className="grid grid-cols-[18px_1fr] gap-3 leading-relaxed text-ink-2">
              <span aria-hidden className="mt-2.5 h-px w-3 bg-ink-2" />
              {l}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="privacy" className="mt-16 rounded-xl border border-rule bg-card p-6 shadow-card">
        <h2 id="privacy" className="font-serif text-2xl">
          Privacy promise
        </h2>
        <p className="mt-2 leading-relaxed text-ink-2">
          Nothing you paste is stored or logged. We never open the links in your message; we only look up the domain&apos;s registration record.{" "}
          <Link href="/privacy" className="font-medium text-ink underline underline-offset-4">
            Read the privacy page
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
