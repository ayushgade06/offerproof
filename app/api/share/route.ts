import { insertShare } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { newShareId, RedactedSchema, shareEnabled, verifyShare } from "@/lib/share";

function err(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  if (!shareEnabled()) return err(503, "SHARE_DISABLED", "Sharing isn't enabled on this deployment.");
  let body: { redactedResult?: unknown; shareToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return err(400, "INVALID_JSON", "The request body must be JSON.");
  }
  // Verify the HMAC over exactly what the client sent, then validate the shape.
  if (typeof body?.shareToken !== "string" || !verifyShare(body.redactedResult, body.shareToken)) {
    return err(400, "BAD_TOKEN", "This result can't be shared. Run the check again.");
  }
  const parsed = RedactedSchema.safeParse(body.redactedResult);
  if (!parsed.success) return err(400, "BAD_TOKEN", "This result can't be shared. Run the check again.");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const rl = checkRateLimit(`share:${ip}`);
  if (!rl.ok) return err(429, "RATE_LIMITED", "Too many shares. Try again in a minute.");

  try {
    const id = newShareId();
    await insertShare(id, parsed.data);
    return Response.json({ id, url: `/r/${id}` });
  } catch (e) {
    console.error(JSON.stringify({ event: "share_error", message: (e as Error).message }));
    return err(500, "INTERNAL", "Couldn't create the link. Please try again.");
  }
}
