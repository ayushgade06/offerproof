import { parse } from "tldts";

export interface Span {
  value: string;
  start: number;
  end: number;
}
export interface MoneySpan extends Span {
  amount: number | null;
  currency: "INR" | "USD" | null;
}
export interface DomainRef extends Span {
  domain: string; // registrable domain, lower-case
  from: "email" | "url";
}
export interface Entities {
  urls: Span[];
  emails: Span[];
  upi: Span[];
  phones: Span[];
  money: MoneySpan[];
  domains: DomainRef[];
}

export const UPI_HANDLES =
  "okaxis|okhdfcbank|okicici|oksbi|ybl|ibl|axl|paytm|apl|upi|ptyes|ptaxis|pthdfc|ptsbi|fbl|airtel|freecharge|jio|axisbank|icici|sbi|hdfcbank|kotak|yesbank|idfcbank|ikwik|waicici|wahdfcbank|waaxis|wasbi";
const UPI_SET = new Set(UPI_HANDLES.split("|"));

// ponytail: bare (scheme-less, www-less) domains are only picked up for these TLDs, to avoid
// matching "Node.js" or "file.py". Extend the list if real scams use other endings.
const BARE_TLDS =
  "com|in|co\\.in|org|net|io|co|xyz|top|online|site|click|buzz|shop|live|icu|cfd|sbs|rest|monster|info|biz|me|app|dev|ai|work|jobs|careers|store|tech|club|vip|cc|ltd";

function matchAll(text: string, re: RegExp): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(re)) {
    out.push({ value: m[0], start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

function trimTrailing(s: Span): Span {
  const t = s.value.replace(/[.,;:!?)\]'"»”’]+$/, "");
  return { value: t, start: s.start, end: s.start + t.length };
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end;
}

function parseAmount(raw: string): number | null {
  const m = /(\d[\d,]*(?:\.\d+)?)\s*(k|lakh|lac)?/i.exec(raw);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ""));
  if (Number.isNaN(n)) return null;
  const mult = m[2]?.toLowerCase();
  if (mult === "k") n *= 1_000;
  if (mult === "lakh" || mult === "lac") n *= 100_000;
  return n;
}

export function extractEntities(text: string): Entities {
  // local@host — host with a dot is an email; a dotless host in the UPI list is a UPI handle.
  const emails: Span[] = [];
  const upi: Span[] = [];
  for (const m of text.matchAll(/[a-zA-Z0-9._%+\-]{2,256}@[a-zA-Z0-9\-]+(?:\.[a-zA-Z0-9\-]+)*/g)) {
    const span = trimTrailing({ value: m[0], start: m.index!, end: m.index! + m[0].length });
    const host = span.value.split("@")[1].toLowerCase();
    if (host.includes(".")) {
      if (parse(host).isIcann) emails.push(span);
    } else if (UPI_SET.has(host)) {
      upi.push(span);
    }
  }

  const urls = matchAll(text, /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi)
    .map(trimTrailing)
    .filter((u) => !emails.some((e) => overlaps(e, u)));

  const domains: DomainRef[] = [];
  const seenSpans: Span[] = [];
  for (const e of emails) {
    const host = e.value.split("@")[1];
    const d = parse(host).domain;
    if (d) {
      const start = e.start + e.value.indexOf("@") + 1;
      domains.push({ domain: d.toLowerCase(), from: "email", value: host, start, end: start + host.length });
    }
  }
  for (const u of urls) {
    const p = parse(u.value);
    if (p.domain && p.isIcann) {
      domains.push({ domain: p.domain.toLowerCase(), from: "url", value: u.value, start: u.start, end: u.end });
      seenSpans.push(u);
    }
  }
  const bareRe = new RegExp(
    `(?<![\\w@./-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:${BARE_TLDS})(?:\\/[^\\s<>"'\`]*)?(?![\\w-])`,
    "gi"
  );
  for (const b of matchAll(text, bareRe).map(trimTrailing)) {
    if (seenSpans.some((s) => overlaps(s, b)) || emails.some((e) => overlaps(e, b))) continue;
    const p = parse(b.value);
    if (p.domain && p.isIcann) {
      urls.push(b);
      domains.push({ domain: p.domain.toLowerCase(), from: "url", value: b.value, start: b.start, end: b.end });
    }
  }
  urls.sort((a, b) => a.start - b.start);

  const phones = matchAll(text, /(?<![\w₹$.,])(?:\+\d{1,3}[\s-]?)?\d(?:[\s-]?\d){9,12}(?![\w,])/g).filter(
    (p) => !urls.some((u) => overlaps(u, p))
  );

  const money: MoneySpan[] = [];
  const moneyRe =
    /(?:₹|\brs\.?|\binr|\$|\busd)\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|lakh|lac)\b)?|\b\d[\d,]*(?:\.\d+)?\s?(?:k\s)?(?:rs\b\.?|inr\b|rupees\b|rupaye\b|usd\b|dollars\b|\/-)/gi;
  for (const s of matchAll(text, moneyRe)) {
    const t = trimTrailing(s);
    const v = t.value.toLowerCase();
    const currency = /\$|usd|dollar/.test(v) ? "USD" : "INR";
    money.push({ ...t, amount: parseAmount(t.value.replace(/^\D+/, "")), currency });
  }

  return { urls, emails, upi, phones, money, domains };
}

/** Unique registrable domains, email domains first (lookup priority). */
export function uniqueDomains(entities: Entities): DomainRef[] {
  const seen = new Set<string>();
  const ordered = [...entities.domains.filter((d) => d.from === "email"), ...entities.domains.filter((d) => d.from === "url")];
  return ordered.filter((d) => (seen.has(d.domain) ? false : (seen.add(d.domain), true)));
}
