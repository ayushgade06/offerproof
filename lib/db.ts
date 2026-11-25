import { neon } from "@neondatabase/serverless";
import type { RedactedResult } from "./types";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export async function insertShare(id: string, r: RedactedResult): Promise<void> {
  await sql()`insert into shared_verdicts (id, verdict, score, summary, claimed_company, signals)
    values (${id}, ${r.verdict}, ${r.score}, ${r.summary}, ${r.claimedCompany}, ${JSON.stringify(r.signals)}::jsonb)`;
}

/** Rows expire after 90 days (filtered at query time; no cron). */
export async function getShare(id: string): Promise<(RedactedResult & { createdAt: string }) | null> {
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
  const rows = await sql()`select verdict, score, summary, claimed_company, signals, created_at
    from shared_verdicts where id = ${id} and created_at > now() - interval '90 days'`;
  const r = rows[0];
  if (!r) return null;
  return {
    verdict: r.verdict,
    score: r.score,
    summary: r.summary,
    claimedCompany: r.claimed_company,
    signals: r.signals,
    createdAt: new Date(r.created_at).toISOString(),
  };
}
