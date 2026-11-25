import type { Severity, Signal, Verdict } from "./types";

/** Every tunable weight and threshold lives here. Tune ONLY on the eval dev split. */
export const SCORING = {
  rules: {
    R_PAYMENT_REQUEST: 0.7,
    R_UPI_OR_CRYPTO: 0.45,
    R_PERSONAL_DOCS: 0.35,
    R_FREEMAIL_RECRUITER: 0.35,
    R_TASK_SCAM: 0.45,
    R_TOO_GOOD_PAY: 0.3,
    R_NO_INTERVIEW: 0.2,
    R_OFF_PLATFORM: 0.2,
    R_URL_SHORTENER: 0.15,
    R_SUSPICIOUS_TLD: 0.2,
    R_URGENCY: 0.1,
    R_GENERIC_GREETING_OFFER: 0.05,
  },
  lookups: {
    L_DOMAIN_AGE_30D: 0.5,
    L_DOMAIN_AGE_180D: 0.3,
    L_DOMAIN_UNREGISTERED: 0.4,
    L_NO_MX: 0.2,
    L_BRAND_LOOKALIKE: 0.45,
  },
  ai: {
    task_scam: 0.35,
    unrealistic_pay: 0.3,
    no_interview_selection: 0.2,
    impersonation_claim: 0.3,
    inconsistent_details: 0.15,
    pressure_tactics: 0.1,
    personal_data_request: 0.3,
    payment_request: 0.5,
    offplatform_contact: 0.15,
    other: 0.1,
  },
  /** AI flag type → rule it duplicates. */
  aiToRule: {
    payment_request: "R_PAYMENT_REQUEST",
    task_scam: "R_TASK_SCAM",
    unrealistic_pay: "R_TOO_GOOD_PAY",
    no_interview_selection: "R_NO_INTERVIEW",
    personal_data_request: "R_PERSONAL_DOCS",
    offplatform_contact: "R_OFF_PLATFORM",
    pressure_tactics: "R_URGENCY",
  } as Record<string, string>,
  highRisk: 70,
  suspicious: 35,
  aiCap: 60,
  /** A rule/lookup signal must reach this weight to lift the AI cap. */
  capLiftWeight: 0.15,
} as const;

export function severityFor(weight: number): Severity {
  if (weight >= 0.5) return "critical";
  if (weight >= 0.3) return "high";
  if (weight >= 0.15) return "medium";
  return "low";
}

/** Merge AI signals that duplicate a fired rule into that rule (as aiNote). */
export function dedupe(signals: Signal[]): Signal[] {
  // One signal per id: e.g. two unregistered domains are one piece of evidence, not two (no double weight).
  const out: Signal[] = [];
  const outById = new Map<string, Signal>();
  for (const s of signals.filter((x) => x.source !== "ai")) {
    const prev = outById.get(s.id);
    if (prev) {
      prev.evidence = [...prev.evidence, ...s.evidence];
      if (s.detail && prev.detail !== s.detail) prev.detail = `${prev.detail ?? ""}; ${s.detail}`.replace(/^; /, "");
      continue;
    }
    const copy = { ...s, evidence: [...s.evidence] };
    out.push(copy);
    outById.set(s.id, copy);
  }
  const byId = outById;
  for (const s of signals.filter((x) => x.source === "ai")) {
    const ruleId = SCORING.aiToRule[s.id.replace(/^AI_/, "")];
    const rule = ruleId && byId.has(ruleId) ? outById.get(ruleId) : undefined;
    if (rule) {
      if (!rule.aiNote) rule.aiNote = s.explanation;
    } else {
      out.push(s);
    }
  }
  return out;
}

export function scoreSignals(signals: Signal[]): { score: number; verdict: Verdict } {
  let keep = 1;
  for (const s of signals) keep *= 1 - s.weight;
  let score = Math.round(100 * (1 - keep));
  const hasHardSignal = signals.some((s) => s.source !== "ai" && s.weight >= SCORING.capLiftWeight);
  if (!hasHardSignal) score = Math.min(score, SCORING.aiCap);
  return { score, verdict: verdictFor(score) };
}

export function verdictFor(score: number): Verdict {
  if (score >= SCORING.highRisk) return "high_risk";
  if (score >= SCORING.suspicious) return "suspicious";
  return "no_major_flags";
}

export const VERDICT_LABEL: Record<Verdict, { title: string; sub: string }> = {
  high_risk: { title: "High risk", sub: "Likely a scam" },
  suspicious: { title: "Suspicious", sub: "Verify before you reply" },
  no_major_flags: { title: "No major red flags found", sub: "This doesn't mean it's safe" },
};
