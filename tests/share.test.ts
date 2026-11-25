import { describe, expect, it } from "vitest";
import { analyze } from "../lib/analyze";
import { redactResult, redactText } from "../lib/redact";
import { canonicalJSON, RedactedSchema, signShare, verifyShare } from "../lib/share";
import { SAMPLES } from "../lib/samples";

const PII = /[\w.+-]+@[\w-]+|\+?\d(?:[\s-]?\d){9,}/;

describe("redactText", () => {
  it("removes emails, UPI ids and phones but keeps domains", () => {
    const out = redactText("Mail hr.x@gmail.com, pay 98765@ybl, call +91 90000 00000, visit www.fake-hr.online");
    expect(out).toBe("Mail [email], pay [upi-id], call [phone], visit www.fake-hr.online");
  });
  it("removes person names supplied by the AI", () => {
    expect(redactText("Hi Ananya Sharma, this is Priya from HR", ["Ananya Sharma", "Priya"])).toBe("Hi [name], this is [name] from HR");
  });
});

describe("redacted share card", () => {
  it("contains no email, phone or UPI pattern", async () => {
    const r = await analyze(
      { text: SAMPLES[0].text + "\nCall +91 90000 00000" },
      { review: async () => null, lookups: async () => ({ signals: [], checks: [] }) }
    );
    const red = redactResult(r, ["Ananya"]);
    expect(RedactedSchema.safeParse(red).success).toBe(true);
    expect(JSON.stringify(red)).not.toMatch(PII);
    expect(red.signals.length).toBe(r.signals.length);
  });
});

describe("share token", () => {
  const card = { verdict: "high_risk", score: 85, summary: "s", claimedCompany: null, signals: [] } as const;
  it("verifies an untampered card", () => {
    expect(verifyShare(card, signShare(card, "k"), "k")).toBe(true);
  });
  it("rejects a tampered card", () => {
    const token = signShare(card, "k");
    expect(verifyShare({ ...card, score: 5 }, token, "k")).toBe(false);
  });
  it("rejects malformed tokens and wrong secrets", () => {
    expect(verifyShare(card, "nope", "k")).toBe(false);
    expect(verifyShare(card, signShare(card, "k"), "other")).toBe(false);
  });
  it("canonical JSON is key-order independent", () => {
    expect(canonicalJSON({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(canonicalJSON({ a: [{ c: 3, d: 2 }], b: 1 }));
  });
});
