import { describe, expect, it } from "vitest";
import { dedupe, scoreSignals, severityFor } from "../lib/score";
import type { Signal } from "../lib/types";

const s = (id: string, weight: number, source: Signal["source"] = "rule", explanation = "x"): Signal => ({
  id, title: id, explanation, severity: severityFor(weight), weight, source, evidence: [],
});

describe("scoreSignals", () => {
  it("payment alone (0.70) → 70 → high_risk", () => {
    expect(scoreSignals([s("R_PAYMENT_REQUEST", 0.7)])).toEqual({ score: 70, verdict: "high_risk" });
  });
  it("AI-only flags totalling 0.8 are capped at 60 → suspicious", () => {
    const r = scoreSignals([s("AI_payment_request", 0.5, "ai"), s("AI_unrealistic_pay", 0.3, "ai"), s("AI_task_scam", 0.35, "ai")]);
    expect(r).toEqual({ score: 60, verdict: "suspicious" });
  });
  it("no signals → 0 → no_major_flags", () => {
    expect(scoreSignals([])).toEqual({ score: 0, verdict: "no_major_flags" });
  });
  it("fee (0.7) + young domain (0.5) → 85", () => {
    expect(scoreSignals([s("R_PAYMENT_REQUEST", 0.7), s("L_DOMAIN_AGE", 0.5, "lookup")]).score).toBe(85);
  });
  it("a low-weight rule (<0.15) does not lift the AI cap", () => {
    const r = scoreSignals([s("R_URGENCY", 0.1), s("AI_payment_request", 0.5, "ai"), s("AI_task_scam", 0.35, "ai")]);
    expect(r.score).toBe(60);
  });
  it("a 0.15 rule lifts the AI cap", () => {
    const r = scoreSignals([s("R_URL_SHORTENER", 0.15), s("AI_payment_request", 0.5, "ai"), s("AI_task_scam", 0.35, "ai")]);
    expect(r.score).toBe(72);
    expect(r.verdict).toBe("high_risk");
  });
});

describe("severityFor", () => {
  it("maps weights to severities", () => {
    expect([0.7, 0.5, 0.35, 0.3, 0.2, 0.15, 0.1].map(severityFor)).toEqual([
      "critical", "critical", "high", "high", "medium", "medium", "low",
    ]);
  });
});

describe("dedupe", () => {
  it("folds an AI flag into the matching fired rule as aiNote", () => {
    const out = dedupe([s("R_PAYMENT_REQUEST", 0.7), s("AI_payment_request", 0.5, "ai", "Asks for a fee to start.")]);
    expect(out.map((x) => x.id)).toEqual(["R_PAYMENT_REQUEST"]);
    expect(out[0].aiNote).toBe("Asks for a fee to start.");
  });
  it("keeps the AI flag when the matching rule did not fire", () => {
    expect(dedupe([s("AI_payment_request", 0.5, "ai")]).map((x) => x.id)).toEqual(["AI_payment_request"]);
  });
  it("keeps AI flags with no rule counterpart", () => {
    expect(dedupe([s("R_URGENCY", 0.1), s("AI_impersonation_claim", 0.3, "ai")]).length).toBe(2);
  });
});
