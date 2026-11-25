import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIUnavailableError, callLLM } from "../lib/llm";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const IMG = "data:image/png;base64,iVBORw0KGgo=";

beforeEach(() => {
  vi.stubEnv("ADAPTION_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("ADAPTION_BASE_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("callLLM provider order", () => {
  it("uses Adaption first with the Responses API shape", async () => {
    vi.stubEnv("ADAPTION_API_KEY", "pt_live_test");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const f = vi.fn(async () => ok({ status: "completed", output_text: "ok" }));
    vi.stubGlobal("fetch", f);
    const r = await callLLM({ system: "sys", user: "hi", imageDataUrl: IMG });
    expect(r).toMatchObject({ text: "ok", provider: "adaption", model: "qwen3.5-397b" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.prod.adaptionlabs.ai/api/v1/responses");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer pt_live_test");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "qwen3.5-397b", instructions: "sys", temperature: 0, store: false });
    expect(body.input[0].content).toEqual([
      { type: "input_text", text: "hi" },
      { type: "input_image", image_url: IMG },
    ]);
  });

  it("falls back to Anthropic on Adaption 5xx", async () => {
    vi.stubEnv("ADAPTION_API_KEY", "pt_live_test");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("boom", { status: 503 }))
      .mockResolvedValueOnce(ok({ content: [{ type: "text", text: "fallback" }] }));
    vi.stubGlobal("fetch", f);
    const r = await callLLM({ system: "s", user: "u" });
    expect(r).toMatchObject({ text: "fallback", provider: "anthropic" });
    const [url, init] = f.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk-test");
  });

  it("falls back to Anthropic on Adaption timeout", async () => {
    vi.stubEnv("ADAPTION_API_KEY", "pt_live_test");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const f = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
      .mockResolvedValueOnce(ok({ content: [{ type: "text", text: "fb" }] }));
    vi.stubGlobal("fetch", f);
    expect((await callLLM({ system: "s", user: "u" })).provider).toBe("anthropic");
  });

  it("sends images to Anthropic as base64 image blocks", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const f = vi.fn(async () => ok({ content: [{ type: "text", text: "x" }] }));
    vi.stubGlobal("fetch", f);
    await callLLM({ system: "s", user: "u", imageDataUrl: IMG });
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.messages[0].content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } });
    expect(body.system).toBe("s");
  });

  it("throws AIUnavailableError when no provider is configured", async () => {
    await expect(callLLM({ system: "s", user: "u" })).rejects.toBeInstanceOf(AIUnavailableError);
  });

  it("throws AIUnavailableError when every provider fails", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })));
    await expect(callLLM({ system: "s", user: "u" })).rejects.toBeInstanceOf(AIUnavailableError);
  });
});
