import { extractEntities } from "./extract";
import type { AnalysisResult, RedactedResult } from "./types";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Replace emails, phones, UPI ids and given person names. Domains stay: they are the evidence. */
export function redactText(s: string, names: string[] = []): string {
  const e = extractEntities(s);
  const spans = [
    ...e.emails.map((x) => ({ ...x, tag: "[email]" })),
    ...e.upi.map((x) => ({ ...x, tag: "[upi-id]" })),
    ...e.phones.map((x) => ({ ...x, tag: "[phone]" })),
  ].sort((a, b) => b.start - a.start);
  let out = s;
  let lastStart = Infinity;
  for (const sp of spans) {
    if (sp.end > lastStart) continue; // overlapping; already replaced
    out = out.slice(0, sp.start) + sp.tag + out.slice(sp.end);
    lastStart = sp.start;
  }
  for (const n of names.map((x) => x.trim()).filter((x) => x.length >= 2)) {
    out = out.replace(new RegExp(`\\b${escape(n)}\\b`, "gi"), "[name]");
    for (const part of n.split(/\s+/).filter((p) => p.length >= 3)) out = out.replace(new RegExp(`\\b${escape(part)}\\b`, "g"), "[name]");
  }
  // Belt and braces: anything still shaped like an email, UPI id or long number.
  return out
    .replace(/[\w.%+-]+@[\w-]+(?:\.[\w-]+)*/g, (m) => (m.includes(".", m.indexOf("@")) ? "[email]" : "[upi-id]"))
    .replace(/\+?\d(?:[\s-]?\d){9,}/g, "[phone]");
}

export function redactResult(r: AnalysisResult, names: string[] = []): RedactedResult {
  return {
    verdict: r.verdict,
    score: r.score,
    summary: redactText(r.summary, names),
    claimedCompany: r.extracted?.claimedCompany ?? null,
    signals: r.signals.map((s) => ({
      id: s.id,
      title: redactText(s.title, names),
      explanation: redactText(s.explanation, names),
      severity: s.severity,
      source: s.source,
      quotes: s.evidence.map((e) => redactText(e.quote, names)),
      ...(s.detail ? { detail: redactText(s.detail, names) } : {}),
    })),
  };
}
