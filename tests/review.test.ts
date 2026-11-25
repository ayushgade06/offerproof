import { describe, expect, it, vi } from "vitest";
import { AIUnavailableError, type LLMRequest } from "../lib/llm";
import { groundFlags, locateQuote, parseJsonLoose, reviewMessage, transcribeImage, VisionUnavailableError } from "../lib/review";

const TEXT = `Dear Candidate,
You are selected!  Pay the “registration fee” of ₹1,999
within 24 hours to hr@ybl.`;

const mockLLM = (...outputs: (string | Error)[]) => {
  const fn = vi.fn(async (_req: LLMRequest) => {
    const o = outputs.shift();
    if (o instanceof Error) throw o;
    return { text: o ?? "", provider: "anthropic" as const, model: "test-model", latencyMs: 5 };
  });
  return fn;
};

const review = (flags: { type: string; quote: string; why: string }[]) =>
  JSON.stringify({
    language: "en",
    extracted: { claimedCompany: null, role: null, payOffered: null, contactChannels: [], asksFromCandidate: ["pay fee"], names: [] },
    flags,
    summary: "It asks for a fee.",
  });

describe("locateQuote", () => {
  it("finds an exact quote with exact offsets", () => {
    const e = locateQuote(TEXT, "You are selected!")!;
    expect(TEXT.slice(e.start, e.end)).toBe("You are selected!");
  });
  it("tolerates collapsed whitespace and straight quotes", () => {
    const e = locateQuote(TEXT, 'selected! Pay the "registration fee"')!;
    expect(e.quote).toBe("selected!  Pay the “registration fee”");
  });
  it("tolerates a line break written as a space", () => {
    expect(locateQuote(TEXT, "₹1,999 within 24 hours")).not.toBeNull();
  });
  it("returns null for a fabricated quote", () => {
    expect(locateQuote(TEXT, "send your Aadhaar card")).toBeNull();
  });
  it("takes the next unused occurrence for repeated quotes", () => {
    const t = "pay now. pay now.";
    const used = new Set<number>();
    const a = locateQuote(t, "pay now", used)!;
    const b = locateQuote(t, "pay now", used)!;
    expect([a.start, b.start]).toEqual([0, 9]);
  });
});

describe("groundFlags", () => {
  it("drops fabricated quotes and counts them", () => {
    const r = groundFlags(TEXT, [
      { type: "payment_request", quote: "Pay the “registration fee” of ₹1,999", why: "Asks for a fee." },
      { type: "personal_data_request", quote: "send us your PAN card", why: "Asks for PAN." },
    ]);
    expect(r.signals.map((s) => s.id)).toEqual(["AI_payment_request"]);
    expect(r.droppedUngrounded).toBe(1);
    const e = r.signals[0].evidence[0];
    expect(TEXT.slice(e.start, e.end)).toBe(e.quote);
  });
});

describe("reviewMessage (mocked LLM)", () => {
  it("one real + one fabricated quote → exactly one AI signal and droppedUngrounded = 1", async () => {
    const llm = mockLLM(
      review([
        { type: "pressure_tactics", quote: "within 24 hours", why: "Rushes you." },
        { type: "impersonation_claim", quote: "from Infosys HR", why: "Claims to be Infosys." },
      ])
    );
    const r = (await reviewMessage(TEXT, llm))!;
    expect(r.signals.length).toBe(1);
    expect(r.droppedUngrounded).toBe(1);
    expect(r.llm.provider).toBe("anthropic");
    expect(llm.mock.calls[0][0].user).toContain("<message>");
  });
  it("accepts JSON wrapped in code fences", async () => {
    const r = await reviewMessage(TEXT, mockLLM("```json\n" + review([]) + "\n```"));
    expect(r?.signals).toEqual([]);
  });
  it("repairs once after invalid JSON", async () => {
    const llm = mockLLM("not json", review([]));
    const r = await reviewMessage(TEXT, llm);
    expect(r).not.toBeNull();
    expect(llm).toHaveBeenCalledTimes(2);
    expect(llm.mock.calls[1][0].user).toContain("previous error");
  });
  it("invalid JSON twice → null (degraded), no throw", async () => {
    await expect(reviewMessage(TEXT, mockLLM("nope", "{bad json"))).resolves.toBeNull();
  });
  it("AI unavailable → null", async () => {
    await expect(reviewMessage(TEXT, mockLLM(new AIUnavailableError()))).resolves.toBeNull();
  });
  it("unknown flag types become 'other'", async () => {
    const r = await reviewMessage(TEXT, mockLLM(review([{ type: "weird", quote: "Dear Candidate", why: "Generic." }])));
    expect(r?.signals[0].id).toBe("AI_other");
  });
});

describe("parseJsonLoose", () => {
  it("extracts the object from surrounding prose", () => {
    expect(parseJsonLoose('Here you go: {"a":1} thanks')).toEqual({ a: 1 });
  });
});

describe("transcribeImage", () => {
  it("returns trimmed text", async () => {
    const r = await transcribeImage("data:image/png;base64,AAAA", mockLLM("  Hello world  "));
    expect(r.text).toBe("Hello world");
  });
  it("NO_TEXT → VisionUnavailableError", async () => {
    await expect(transcribeImage("data:image/png;base64,AAAA", mockLLM("NO_TEXT"))).rejects.toBeInstanceOf(VisionUnavailableError);
  });
  it("provider failure → VisionUnavailableError", async () => {
    await expect(transcribeImage("data:image/png;base64,AAAA", mockLLM(new AIUnavailableError()))).rejects.toBeInstanceOf(VisionUnavailableError);
  });
});
