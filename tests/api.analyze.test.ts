import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Lookups are mocked (no network). AI keys are unset, so the AI path is genuinely unavailable.
vi.mock("../lib/lookups", async (orig) => ({
  ...(await orig<typeof import("../lib/lookups")>()),
  runNetworkLookups: vi.fn(async () => ({ signals: [], checks: [{ id: "L_DOMAIN_AGE", label: "Website age", status: "skipped" }] })),
}));

import { POST } from "../app/api/analyze/route";
import { resetRateLimit } from "../lib/rate-limit";
import { SAMPLES } from "../lib/samples";

const call = (body: unknown, ip = "1.1.1.1") =>
  POST(
    new Request("http://x/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );

beforeEach(() => {
  resetRateLimit();
  vi.stubEnv("ADAPTION_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/analyze validation", () => {
  it.each([
    ["{bad", "INVALID_JSON"],
    [{}, "EMPTY_INPUT"],
    [{ text: "   " }, "EMPTY_INPUT"],
    [{ text: "x".repeat(12_001) }, "INPUT_TOO_LONG"],
    [{ image: "data:image/gif;base64,AAAA" }, "UNSUPPORTED_IMAGE"],
    [{ image: "data:image/png;base64," + "A".repeat(5_600_001) }, "IMAGE_TOO_LARGE"],
    [{ text: "hi", image: "data:image/png;base64,AAAA" }, "EMPTY_INPUT"],
  ])("%s → 400 %s", async (body, code) => {
    const res = await call(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe(code);
  });
});

describe("rate limiting", () => {
  it("returns 429 with Retry-After after 8 requests a minute from one IP", async () => {
    for (let i = 0; i < 8; i++) expect((await call({ text: "hello there" }, "9.9.9.9")).status).toBe(200);
    const res = await call({ text: "hello there" }, "9.9.9.9");
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await call({ text: "hello there" }, "8.8.8.8")).status).toBe(200);
  });
});

describe("degraded mode (no AI provider)", () => {
  it("still returns a rules + lookups result for text", async () => {
    const res = await call({ text: SAMPLES[0].text });
    expect(res.status).toBe(200);
    const r = await res.json();
    expect(r.engine.provider).toBe("none");
    expect(r.verdict).toBe("high_risk");
    expect(r.signals.length).toBeGreaterThanOrEqual(3);
    expect(r.checks.find((c: { id: string }) => c.id === "AI_REVIEW").status).toBe("unavailable");
    for (const s of r.signals) for (const e of s.evidence) expect(r.text.slice(e.start, e.end)).toBe(e.quote);
    expect(JSON.stringify(r)).not.toMatch(/"lookupFailures"/);
  });
  it("returns 503 VISION_UNAVAILABLE for an image", async () => {
    const res = await call({ image: "data:image/png;base64,iVBORw0KGgo=" });
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("VISION_UNAVAILABLE");
  });
  it("never logs the input text", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await call({ text: "SECRET-MARKER-123 pay registration fee ₹500" });
    expect(log).toHaveBeenCalled();
    expect(log.mock.calls.flat().join(" ")).not.toContain("SECRET-MARKER-123");
  });
});
