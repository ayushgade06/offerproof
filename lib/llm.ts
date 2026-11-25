// Provider adapter: Adaption first, Anthropic fallback, otherwise AIUnavailableError.
// Plain fetch, no SDKs. Request shapes are recorded in PROGRESS.md.

export class AIUnavailableError extends Error {
  constructor(message = "No AI provider is available") {
    super(message);
    this.name = "AIUnavailableError";
  }
}

export interface LLMRequest {
  system: string;
  user: string;
  imageDataUrl?: string;
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  provider: "adaption" | "anthropic";
  model: string;
  latencyMs: number;
}

const TIMEOUT_MS = 20_000;

function adaptionConfig() {
  const key = process.env.ADAPTION_API_KEY;
  if (!key) return null;
  return {
    key,
    base: (process.env.ADAPTION_BASE_URL || "https://api.prod.adaptionlabs.ai").replace(/\/$/, ""),
    model: process.env.ADAPTION_MODEL || "qwen3.5-397b",
  };
}

function anthropicConfig() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return { key, model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5" };
}

export function aiConfigured(): boolean {
  return Boolean(adaptionConfig() || anthropicConfig());
}

export function adaptionBody(model: string, req: LLMRequest) {
  const content: Record<string, unknown>[] = [{ type: "input_text", text: req.user }];
  if (req.imageDataUrl) content.push({ type: "input_image", image_url: req.imageDataUrl });
  return {
    model,
    instructions: req.system,
    input: [{ role: "user", content }],
    temperature: 0,
    max_output_tokens: req.maxTokens ?? 1500,
    store: false,
  };
}

export function anthropicBody(model: string, req: LLMRequest) {
  const content: Record<string, unknown>[] = [];
  if (req.imageDataUrl) {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(req.imageDataUrl);
    if (!m) throw new Error("Invalid image data URL");
    content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  content.push({ type: "text", text: req.user });
  return {
    model,
    max_tokens: req.maxTokens ?? 1500,
    // Current Claude models reject `temperature`. Haiku allows thinking off (at default effort),
    // which keeps latency low for this extraction task.
    ...(/haiku/.test(model) ? { thinking: { type: "disabled" } } : {}),
    system: req.system,
    messages: [{ role: "user", content }],
  };
}

async function callAdaption(cfg: NonNullable<ReturnType<typeof adaptionConfig>>, req: LLMRequest): Promise<string> {
  const res = await fetch(`${cfg.base}/api/v1/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(adaptionBody(cfg.model, req)),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Adaption HTTP ${res.status}`);
  const data = (await res.json()) as { status?: string; output_text?: string };
  if (data.status && data.status !== "completed") throw new Error(`Adaption status ${data.status}`);
  if (typeof data.output_text !== "string") throw new Error("Adaption: missing output_text");
  return data.output_text;
}

async function callAnthropic(cfg: NonNullable<ReturnType<typeof anthropicConfig>>, req: LLMRequest): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": cfg.key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(anthropicBody(cfg.model, req)),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  if (!text) throw new Error("Anthropic: empty response");
  return text;
}

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  const errors: string[] = [];
  const ad = adaptionConfig();
  if (ad) {
    const t0 = Date.now();
    try {
      const text = await callAdaption(ad, req);
      return { text, provider: "adaption", model: ad.model, latencyMs: Date.now() - t0 };
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  const an = anthropicConfig();
  if (an) {
    const t0 = Date.now();
    try {
      const text = await callAnthropic(an, req);
      return { text, provider: "anthropic", model: an.model, latencyMs: Date.now() - t0 };
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  throw new AIUnavailableError(errors.length ? errors.join("; ") : "No AI provider configured");
}
