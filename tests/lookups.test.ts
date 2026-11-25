import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dnsMock = vi.hoisted(() => ({ resolveNs: vi.fn(), resolveMx: vi.fn() }));
vi.mock("node:dns", () => ({ promises: dnsMock, default: { promises: dnsMock } }));

import { extractEntities } from "../lib/extract";
import { checkDomainAge, checkLookalike, clearLookupCache, levenshtein, runNetworkLookups } from "../lib/lookups";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const enotfound = () => Object.assign(new Error("nf"), { code: "ENOTFOUND" });
const NOW = Date.parse("2026-11-26T00:00:00Z");

beforeEach(() => {
  clearLookupCache();
  dnsMock.resolveNs.mockReset();
  dnsMock.resolveMx.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("checkDomainAge (mocked)", () => {
  it("returns the registration date", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { events: [{ eventAction: "registration", eventDate: "1997-09-15T04:00:00Z" }] })));
    expect(await checkDomainAge("google.com")).toEqual({ status: "registered", registeredAt: "1997-09-15T04:00:00Z" });
  });
  it("404 + NXDOMAIN → unregistered", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(404, { errorCode: 404 })));
    dnsMock.resolveNs.mockRejectedValue(enotfound());
    expect((await checkDomainAge("nope-xyz-123.online")).status).toBe("unregistered");
  });
  it("404 but DNS resolves → unavailable (never a false 'not registered')", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(404, {})));
    dnsMock.resolveNs.mockResolvedValue(["ns1.example"]);
    expect((await checkDomainAge("weird-registry.example")).status).toBe("unavailable");
  });
  it("'No RDAP service' → unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(404, { title: "No RDAP service is available for this resource" })));
    expect((await checkDomainAge("t.me")).status).toBe("unavailable");
  });
  it("timeout → unavailable and no signal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("timeout", "TimeoutError"); }));
    const t = "Apply at www.slow-site.xyz";
    const r = await runNetworkLookups(extractEntities(t), NOW);
    expect(r.signals).toEqual([]);
    expect(r.checks.find((c) => c.label.includes("slow-site.xyz"))?.status).toBe("unavailable");
  });
});

describe("runNetworkLookups (mocked)", () => {
  it("flags a 9-day-old domain with weight 0.5", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { events: [{ eventAction: "registration", eventDate: "2026-11-17T00:00:00Z" }] })));
    const t = "Visit www.hr-careers.online";
    const r = await runNetworkLookups(extractEntities(t), NOW);
    expect(r.signals[0].id).toBe("L_DOMAIN_AGE");
    expect(r.signals[0].weight).toBe(0.5);
    expect(r.signals[0].detail).toContain("9 days ago");
    const e = r.signals[0].evidence[0];
    expect(t.slice(e.start, e.end)).toBe(e.quote);
  });
  it("unregistered domain → L_DOMAIN_UNREGISTERED", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(404, {})));
    dnsMock.resolveNs.mockRejectedValue(enotfound());
    const r = await runNetworkLookups(extractEntities("Go to qwzx-not-real-98123.online"), NOW);
    expect(r.signals.map((s) => s.id)).toEqual(["L_DOMAIN_UNREGISTERED"]);
  });
  it("flags a corporate email domain with no MX", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { events: [{ eventAction: "registration", eventDate: "2010-01-01T00:00:00Z" }] })));
    dnsMock.resolveMx.mockRejectedValue(enotfound());
    const r = await runNetworkLookups(extractEntities("HR: jobs@acme-hiring.com"), NOW);
    expect(r.signals.map((s) => s.id)).toEqual(["L_NO_MX"]);
  });
  it("skips freemail for MX and age", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await runNetworkLookups(extractEntities("mail hr@gmail.com"), NOW);
    expect(f).not.toHaveBeenCalled();
    expect(dnsMock.resolveMx).not.toHaveBeenCalled();
    expect(r.checks[0].status).toBe("skipped");
  });
  it("no domains → a single skipped check", async () => {
    const r = await runNetworkLookups(extractEntities("No links here."), NOW);
    expect(r.checks).toEqual([expect.objectContaining({ status: "skipped" })]);
  });
  it("looks up at most 3 domains", async () => {
    const f = vi.fn(async () => json(200, { events: [{ eventAction: "registration", eventDate: "2001-01-01T00:00:00Z" }] }));
    vi.stubGlobal("fetch", f);
    await runNetworkLookups(extractEntities("a1.xyz b2.xyz c3.xyz d4.xyz"), NOW);
    expect(f).toHaveBeenCalledTimes(3);
  });
});

describe("checkLookalike", () => {
  it("hr-infosys-careers.online with claimed Infosys → L_BRAND_LOOKALIKE", () => {
    const t = "Infosys HR: visit hr-infosys-careers.online";
    const r = checkLookalike(extractEntities(t), "Infosys");
    expect(r.signals[0].id).toBe("L_BRAND_LOOKALIKE");
    expect(r.signals[0].explanation).toContain("infosys.com");
  });
  it("catches typosquats within Levenshtein 2", () => {
    const r = checkLookalike(extractEntities("apply at infosis.com"), "Infosys Limited");
    expect(r.signals.length).toBe(1);
  });
  it("does not flag the official domain", () => {
    const r = checkLookalike(extractEntities("apply at https://www.infosys.com/careers"), "Infosys");
    expect(r.signals).toEqual([]);
    expect(r.checks[0].status).toBe("passed");
  });
  it("falls back to a company named in the text when the AI is unavailable", () => {
    const t = "Infosys internship: register at infosys-internship-desk.online";
    expect(checkLookalike(extractEntities(t), null, t).signals.length).toBe(1);
  });
  it("skips when no known company is named", () => {
    expect(checkLookalike(extractEntities("visit foo.xyz"), "Acme Widgets").checks[0].status).toBe("skipped");
  });
  it("levenshtein basics", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("infosys", "infosis")).toBe(1);
  });
});

describe.runIf(process.env.LIVE === "1")("live RDAP", () => {
  it("google.com is older than 20 years", async () => {
    const r = await checkDomainAge("google.com");
    expect(r.status).toBe("registered");
    if (r.status === "registered") expect(Date.now() - Date.parse(r.registeredAt)).toBeGreaterThan(20 * 365 * 86_400_000);
  });
});
