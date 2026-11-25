import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { RedactedResult } from "./types";

export function canonicalJSON(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJSON).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJSON((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export function shareEnabled(): boolean {
  return Boolean(process.env.SHARE_SECRET && process.env.DATABASE_URL);
}

export function signShare(r: RedactedResult, secret = process.env.SHARE_SECRET!): string {
  return createHmac("sha256", secret).update(canonicalJSON(r)).digest("hex");
}

export function verifyShare(r: unknown, token: string, secret = process.env.SHARE_SECRET!): boolean {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return false;
  const expected = Buffer.from(signShare(r as RedactedResult, secret), "hex");
  return timingSafeEqual(expected, Buffer.from(token, "hex"));
}

export const RedactedSchema = z.object({
  verdict: z.enum(["high_risk", "suspicious", "no_major_flags"]),
  score: z.number().int().min(0).max(100),
  summary: z.string().max(1000),
  claimedCompany: z.string().max(200).nullable(),
  signals: z
    .array(
      z.object({
        id: z.string().max(80),
        title: z.string().max(300),
        explanation: z.string().max(600),
        severity: z.enum(["critical", "high", "medium", "low"]),
        source: z.enum(["rule", "lookup", "ai"]),
        quotes: z.array(z.string().max(500)).max(5),
        detail: z.string().max(300).optional(),
      })
    )
    .max(30),
});

export function newShareId(): string {
  return randomBytes(8).toString("base64url").slice(0, 10);
}
