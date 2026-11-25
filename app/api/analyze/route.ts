import { analyze } from "@/lib/analyze";
import { checkRateLimit } from "@/lib/rate-limit";
import { VisionUnavailableError } from "@/lib/review";

export const maxDuration = 60;

const MAX_TEXT = 12_000;
const MAX_IMAGE_CHARS = 5_600_000; // ≈ 4 MB of base64
const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

function err(status: number, code: string, message: string, headers?: Record<string, string>) {
  return Response.json({ error: { code, message } }, { status, headers });
}

export async function POST(req: Request) {
  const t0 = Date.now();
  let body: { text?: unknown; image?: unknown };
  try {
    body = await req.json();
  } catch {
    return err(400, "INVALID_JSON", "The request body must be JSON.");
  }
  if (!body || typeof body !== "object") return err(400, "INVALID_JSON", "The request body must be a JSON object.");

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const image = typeof body.image === "string" ? body.image : "";
  if (!text && !image) return err(400, "EMPTY_INPUT", "Paste a message or add a screenshot.");
  if (text && image) return err(400, "EMPTY_INPUT", "Send either text or a screenshot, not both.");
  if (text.length > MAX_TEXT) return err(400, "INPUT_TOO_LONG", `Keep it under ${MAX_TEXT.toLocaleString("en-US")} characters.`);
  if (image) {
    if (image.length > MAX_IMAGE_CHARS) return err(400, "IMAGE_TOO_LARGE", "That screenshot is too large. Try a smaller one.");
    if (!IMAGE_RE.test(image)) return err(400, "UNSUPPORTED_IMAGE", "Upload a PNG, JPG or WebP screenshot.");
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    const msg =
      rl.reason === "daily"
        ? "OfferProof has hit its daily limit. Please try again tomorrow."
        : `Too many checks. Try again in ${rl.retryAfter} seconds.`;
    return err(429, "RATE_LIMITED", msg, { "Retry-After": String(rl.retryAfter) });
  }

  try {
    const { lookupFailures, ...result } = await analyze(image ? { image } : { text });
    // One line per analysis. Never log the input text.
    console.log(
      JSON.stringify({
        event: "analysis",
        verdict: result.verdict,
        score: result.score,
        signalIds: result.signals.map((s) => s.id),
        provider: result.engine.provider,
        llmLatencyMs: result.engine.latencyMs,
        latencyMs: Date.now() - t0,
        droppedUngrounded: result.engine.droppedUngrounded,
        hadImage: Boolean(image),
        lookupFailures,
      })
    );
    return Response.json(result);
  } catch (e) {
    if (e instanceof VisionUnavailableError) {
      return err(503, "VISION_UNAVAILABLE", "We couldn't read that screenshot right now. Paste the text instead.");
    }
    console.error(JSON.stringify({ event: "analysis_error", name: (e as Error).name, message: (e as Error).message }));
    return err(500, "INTERNAL", "Something went wrong on our side. Please try again.");
  }
}
