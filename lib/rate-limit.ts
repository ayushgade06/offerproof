// ponytail: in-memory, per serverless instance. Limits are per instance, so the true global ceiling is
// (instances × limit). Move to a shared store (Upstash/Redis) if abuse ever shows up.
const WINDOW_MS = 60_000;
const PER_MINUTE = 8;
const hits = new Map<string, number[]>();
let day = "";
let dayCount = 0;

export function checkRateLimit(ip: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number; reason: "ip" | "daily" } {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  const cap = Number(process.env.DAILY_ANALYSIS_CAP) || 2000;
  if (dayCount >= cap) {
    const midnight = Date.parse(`${today}T00:00:00Z`) + 86_400_000;
    return { ok: false, retryAfter: Math.ceil((midnight - now) / 1000), reason: "daily" };
  }
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_MINUTE) {
    hits.set(ip, recent);
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000), reason: "ip" };
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
  dayCount++;
  return { ok: true };
}

export function resetRateLimit() {
  hits.clear();
  dayCount = 0;
}
