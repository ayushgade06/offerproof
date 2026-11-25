import { promises as dns } from "node:dns";
import { parse } from "tldts";
import official from "../data/official-domains.json";
import { uniqueDomains, type DomainRef, type Entities } from "./extract";
import { FREEMAIL, SHORTENERS } from "./rules";
import { SCORING, severityFor } from "./score";
import type { Check, Evidence, Signal } from "./types";

const TIMEOUT_MS = 4_000;
const MAX_DOMAINS = 3;
const DAY = 86_400_000;

// Well-known platforms: listed as checks but not age-checked (their age proves nothing about the sender).
const PLATFORMS = new Set([
  "linkedin.com", "forms.gle", "naukri.com", "internshala.com", "indeed.com", "github.com", "t.me", "wa.me",
  "whatsapp.com", "telegram.me", "telegram.org", "youtube.com", "youtu.be", "instagram.com", "facebook.com",
  "google.com", "unstop.com", "glassdoor.com", "zoom.us", "docs.google.com", "drive.google.com", "x.com", "twitter.com",
  ...FREEMAIL, ...SHORTENERS,
]);

const OFFICIAL_DOMAINS = new Set(official.companies.flatMap((c) => c.domains));

// ---- in-memory cache (per instance) ------------------------------------------------------------
// ponytail: Map with FIFO eviction, per serverless instance. Swap for a shared KV if hit rate matters.
const CACHE_TTL = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, fn: () => Promise<T>, shouldCache: (v: T) => boolean): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value as T;
  const value = await fn();
  if (shouldCache(value)) {
    if (cache.size >= 500) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), value });
  }
  return value;
}
export function clearLookupCache() {
  cache.clear();
}

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

// ---- RDAP --------------------------------------------------------------------------------------
export type AgeResult =
  | { status: "registered"; registeredAt: string }
  | { status: "registered_no_date" }
  | { status: "unregistered" }
  | { status: "unavailable" };

async function dnsExists(domain: string): Promise<boolean | null> {
  try {
    await withTimeout(dns.resolveNs(domain));
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND") return false;
    if (code === "ENODATA") return true; // name exists, just no NS at this label
    return null;
  }
}

export function checkDomainAge(domain: string): Promise<AgeResult> {
  return cached(
    `age:${domain}`,
    async (): Promise<AgeResult> => {
      try {
        const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
          // rdap.org answers 403 to Node's default user-agent.
          headers: { accept: "application/rdap+json, application/json", "user-agent": "OfferProof/1.0 (job-offer scam checker)" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.status === 404) {
          const body = (await res.json().catch(() => ({}))) as { title?: string };
          if (/no rdap service/i.test(body.title ?? "")) return { status: "unavailable" };
          // Confirm with DNS so a registry quirk never produces a false "not registered".
          return (await dnsExists(domain)) === false ? { status: "unregistered" } : { status: "unavailable" };
        }
        if (!res.ok) return { status: "unavailable" };
        const data = (await res.json()) as { events?: { eventAction?: string; eventDate?: string }[] };
        const reg = data.events?.find((e) => e.eventAction === "registration")?.eventDate;
        return reg ? { status: "registered", registeredAt: reg } : { status: "registered_no_date" };
      } catch {
        return { status: "unavailable" };
      }
    },
    (v) => v.status !== "unavailable"
  );
}

export type MxResult = "has_mx" | "no_mx" | "unavailable";
export function checkMx(domain: string): Promise<MxResult> {
  return cached(
    `mx:${domain}`,
    async (): Promise<MxResult> => {
      try {
        const mx = await withTimeout(dns.resolveMx(domain));
        return mx.length ? "has_mx" : "no_mx";
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        return code === "ENOTFOUND" || code === "ENODATA" ? "no_mx" : "unavailable";
      }
    },
    (v) => v !== "unavailable"
  );
}

// ---- helpers -----------------------------------------------------------------------------------
function evidenceFor(entities: Entities, domain: string): Evidence[] {
  return entities.domains
    .filter((d) => d.domain === domain)
    .slice(0, 2)
    .map((d) => ({ start: d.start, end: d.end, quote: d.value }));
}

function ago(ms: number): string {
  const days = Math.floor(ms / DAY);
  if (days < 1) return "today";
  if (days < 60) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function lookupSignal(id: string, weightKey: keyof typeof SCORING.lookups, title: string, explanation: string, evidence: Evidence[], detail: string): Signal {
  const weight = SCORING.lookups[weightKey];
  return { id, title, explanation, severity: severityFor(weight), weight, source: "lookup", evidence, detail };
}

// ---- network lookups (age + MX) ----------------------------------------------------------------
export async function runNetworkLookups(entities: Entities, now = Date.now()): Promise<{ signals: Signal[]; checks: Check[] }> {
  const signals: Signal[] = [];
  const checks: Check[] = [];
  const all = uniqueDomains(entities);
  if (!all.length) {
    checks.push({ id: "L_DOMAIN_AGE", label: "Website age", status: "skipped", detail: "No links or email domains in the message" });
    return { signals, checks };
  }

  const toCheck: DomainRef[] = [];
  for (const d of all) {
    if (PLATFORMS.has(d.domain)) {
      checks.push({ id: `L_DOMAIN_AGE:${d.domain}`, label: `Website age: ${d.domain}`, status: "skipped", detail: "Well-known platform" });
    } else if (toCheck.length < MAX_DOMAINS) {
      toCheck.push(d);
    } else {
      checks.push({ id: `L_DOMAIN_AGE:${d.domain}`, label: `Website age: ${d.domain}`, status: "skipped", detail: `Only the first ${MAX_DOMAINS} domains are looked up` });
    }
  }

  const mxDomains = [...new Set(entities.emails.map((e) => parse(e.value.split("@")[1]).domain?.toLowerCase()).filter((d): d is string => !!d && !FREEMAIL.has(d)))].slice(0, MAX_DOMAINS);

  const [ages, mxs] = await Promise.all([
    Promise.all(toCheck.map((d) => checkDomainAge(d.domain))),
    Promise.all(mxDomains.map((d) => checkMx(d))),
  ]);

  toCheck.forEach((d, i) => {
    const r = ages[i];
    const label = `Website age: ${d.domain}`;
    const id = `L_DOMAIN_AGE:${d.domain}`;
    if (r.status === "unavailable") {
      checks.push({ id, label, status: "unavailable", detail: "The registration lookup didn't respond" });
    } else if (r.status === "registered_no_date") {
      checks.push({ id, label, status: "unavailable", detail: "This registry doesn't publish registration dates" });
    } else if (r.status === "unregistered") {
      checks.push({ id, label, status: "flagged", detail: "Not registered" });
      signals.push(
        lookupSignal(
          "L_DOMAIN_UNREGISTERED",
          "L_DOMAIN_UNREGISTERED",
          `${d.domain} isn't registered to anyone`,
          "This website address doesn't exist, so the link can't belong to a real company.",
          evidenceFor(entities, d.domain),
          `No registration record found (live RDAP lookup, confirmed by DNS)`
        )
      );
    } else {
      const age = now - Date.parse(r.registeredAt);
      const date = r.registeredAt.slice(0, 10);
      const detail = `Registered ${date} (${ago(age)}) via RDAP`;
      if (age < 180 * DAY) {
        const young = age < 30 * DAY;
        checks.push({ id, label, status: "flagged", detail });
        signals.push(
          lookupSignal(
            "L_DOMAIN_AGE",
            young ? "L_DOMAIN_AGE_30D" : "L_DOMAIN_AGE_180D",
            `${d.domain} was registered ${ago(age)}`,
            "Scam sites are usually brand new. Established employers have used their domain for years.",
            evidenceFor(entities, d.domain),
            detail
          )
        );
      } else {
        checks.push({ id, label, status: "passed", detail });
      }
    }
  });

  mxDomains.forEach((d, i) => {
    const r = mxs[i];
    const id = `L_NO_MX:${d}`;
    const label = `Email domain can receive mail: ${d}`;
    if (r === "unavailable") checks.push({ id, label, status: "unavailable", detail: "DNS lookup didn't respond" });
    else if (r === "has_mx") checks.push({ id, label, status: "passed", detail: "Has mail servers (DNS MX)" });
    else {
      checks.push({ id, label, status: "flagged", detail: "No mail servers (DNS MX)" });
      signals.push(
        lookupSignal(
          "L_NO_MX",
          "L_NO_MX",
          `${d} can't receive email`,
          "The sender's email domain has no mail servers, so it isn't a working company mailbox.",
          evidenceFor(entities, d),
          "No MX records found via DNS"
        )
      );
    }
  });

  return { signals, checks };
}

// ---- lookalike (no network) --------------------------------------------------------------------
export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();

export function findCompany(claimed: string | null) {
  if (!claimed) return null;
  const c = ` ${norm(claimed)} `;
  return official.companies.find((co) => co.aliases.some((a) => c.includes(` ${norm(a)} `))) ?? null;
}

/** Fallback when the AI is unavailable: a capitalised company name appearing in the text. */
export function companyFromText(text: string) {
  for (const co of official.companies) {
    for (const a of co.aliases) {
      if (a.length < 4) continue;
      const cased = a.replace(/\b\w/g, (ch) => ch.toUpperCase());
      const re = new RegExp(`\\b(?:${cased.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")}|${a.toUpperCase().replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")})\\b`);
      if (re.test(text)) return co;
    }
  }
  return null;
}

export function checkLookalike(entities: Entities, claimedCompany: string | null, text = ""): { signals: Signal[]; checks: Check[] } {
  const company = findCompany(claimedCompany) ?? companyFromText(text);
  if (!company) {
    return { signals: [], checks: [{ id: "L_BRAND_LOOKALIKE", label: "Imitates a known company's website", status: "skipped", detail: "No well-known employer named" }] };
  }
  const tokens = company.aliases.map((a) => a.replace(/[^a-z0-9]/g, "")).filter((t) => t.length >= 3);
  const officialLabels = company.domains.map((d) => parse(d).domainWithoutSuffix ?? d);
  const fakes = uniqueDomains(entities).filter((d) => {
    if (OFFICIAL_DOMAINS.has(d.domain) || PLATFORMS.has(d.domain) || company.domains.includes(d.domain)) return false;
    const label = (parse(d.domain).domainWithoutSuffix ?? d.domain).replace(/[^a-z0-9]/g, "");
    return tokens.some((t) => label.includes(t)) || officialLabels.some((o) => levenshtein(label, o.replace(/[^a-z0-9]/g, "")) <= 2);
  });
  const label = `Imitates ${company.company}'s website`;
  if (!fakes.length) {
    return { signals: [], checks: [{ id: "L_BRAND_LOOKALIKE", label, status: "passed", detail: `No lookalike of ${company.domains[0]} found` }] };
  }
  const weight = SCORING.lookups.L_BRAND_LOOKALIKE;
  return {
    checks: [{ id: "L_BRAND_LOOKALIKE", label, status: "flagged", detail: fakes.map((f) => f.domain).join(", ") }],
    signals: [
      {
        id: "L_BRAND_LOOKALIKE",
        title: `Uses a lookalike of ${company.company}'s domain`,
        explanation: `${company.company}'s official domain is ${company.domains[0]}. This message uses ${fakes.map((f) => f.domain).join(", ")} instead.`,
        severity: severityFor(weight),
        weight,
        source: "lookup",
        evidence: fakes.flatMap((f) => evidenceFor(entities, f.domain)).slice(0, 3),
        detail: `Compared against ${company.company}'s verified domain list (${company.domains.join(", ")})`,
      },
    ],
  };
}

export function officialDomainFor(claimedCompany: string | null) {
  return findCompany(claimedCompany);
}
