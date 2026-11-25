import { parse } from "tldts";
import type { Entities, Span } from "./extract";
import { SCORING, severityFor } from "./score";
import type { Evidence, Signal } from "./types";

type RuleId = keyof typeof SCORING.rules;
type Rule = (text: string, e: Entities) => Signal[];

export const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.in", "outlook.com", "hotmail.com", "live.com",
  "msn.com", "proton.me", "protonmail.com", "rediffmail.com", "icloud.com", "me.com", "aol.com", "zoho.com",
  "zohomail.in", "gmx.com", "mail.com", "yandex.com",
]);

export const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "cutt.ly", "rb.gy", "t.ly", "is.gd", "shorturl.at", "goo.su", "tiny.cc", "ow.ly", "s.id", "rebrand.ly",
]);

export const SUSPICIOUS_TLDS = new Set([
  "xyz", "top", "online", "site", "click", "buzz", "shop", "live", "icu", "cfd", "sbs", "rest", "monster",
]);

export const RULE_META: Record<RuleId, { title: string; explanation: string }> = {
  R_PAYMENT_REQUEST: {
    title: "Asks you to pay",
    explanation: "Real employers never charge candidates a fee to get hired, trained or onboarded, even a \"refundable\" one.",
  },
  R_UPI_OR_CRYPTO: {
    title: "Payment handle in message",
    explanation: "The message includes a UPI ID, crypto wallet or gift-card request. Recruiters have no reason to send you one.",
  },
  R_PERSONAL_DOCS: {
    title: "Asks for sensitive documents early",
    explanation: "It asks for ID, bank or card details before any real interview. Scammers use these for fraud.",
  },
  R_FREEMAIL_RECRUITER: {
    title: "Recruiter uses a free email",
    explanation: "Company recruiters write from their company's domain, not Gmail, Yahoo or Outlook.",
  },
  R_TASK_SCAM: {
    title: "\"Easy tasks for daily pay\" pattern",
    explanation: "Paying per like, rating or review is the classic task scam. It ends with you \"investing\" in prepaid tasks.",
  },
  R_TOO_GOOD_PAY: {
    title: "Pay is unusually high for the work",
    explanation: "The pay is far above normal for part-time or no-experience work. That is bait.",
  },
  R_NO_INTERVIEW: {
    title: "Hired without an interview",
    explanation: "Real jobs interview you before selecting you. \"Selected\" with no interview is a common hook.",
  },
  R_OFF_PLATFORM: {
    title: "Moves you to Telegram/WhatsApp",
    explanation: "Scammers move chats to Telegram or WhatsApp, where there is no company record and no accountability.",
  },
  R_URL_SHORTENER: {
    title: "Hides the real link",
    explanation: "A link shortener hides where the link actually goes. Companies link to their own careers site.",
  },
  R_SUSPICIOUS_TLD: {
    title: "Unusual website ending",
    explanation: "Cheap domain endings like this are popular with throwaway scam sites. Big employers rarely use them.",
  },
  R_URGENCY: {
    title: "Pressure to act fast",
    explanation: "Artificial deadlines push you to act before you can check. Real offers give you time.",
  },
  R_GENERIC_GREETING_OFFER: {
    title: "Mass-sent offer",
    explanation: "A generic greeting on a \"selected\" message suggests it was sent to many people at once.",
  },
};

function sig(id: RuleId, evidence: Evidence[]): Signal[] {
  if (!evidence.length) return [];
  const weight = SCORING.rules[id];
  const seen = new Set<string>();
  const ev = evidence
    .filter((e) => (seen.has(`${e.start}:${e.end}`) ? false : (seen.add(`${e.start}:${e.end}`), true)))
    .slice(0, 4) // keep the strongest (first-found) evidence, then show in reading order
    .sort((a, b) => a.start - b.start);
  return [{ id, ...RULE_META[id], severity: severityFor(weight), weight, source: "rule", evidence: ev }];
}

function find(text: string, re: RegExp): Evidence[] {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  return [...text.matchAll(new RegExp(re.source, flags))].map((m) => ({
    start: m.index!,
    end: m.index! + m[0].length,
    quote: m[0],
  }));
}

const ev = (s: Span): Evidence => ({ start: s.start, end: s.end, quote: s.value });

/** Gap in characters between two spans (0 if they overlap). */
function gap(a: { start: number; end: number }, b: { start: number; end: number }) {
  return Math.max(0, Math.max(a.start, b.start) - Math.min(a.end, b.end));
}

const FEE_RE =
  /\b(?:registration|training|joining|onboarding|processing|verification|security|enrol?l?ment|admission|documentation|document|application|kit|id card|uniform|laptop)\s*(?:fees?|charges?|deposit|amount)\b|\bsecurity deposit\b|\brefundable\b|\bkit charges?\b|\bpay\b[^.\n]{0,40}?\bto (?:confirm|secure|book|reserve|activate)\b|\bfees? (?:bharn[ae]|bharo|jama|dena)\b|\bregistration ke liye\b|\bpaise? (?:bhej\w*|jama|dena)\b/gi;
const PAY_CHANNEL_RE = /\b(?:upi|usdt|btc|bitcoin|crypto|trc-?20|qr code|scan (?:the |this )?qr|gpay|google pay|phonepe|phone pe|paytm|bhim)\b/gi;
const PAY_VERB_RE = /\b(?:pay|send|transfer|deposit|scan)\b/gi;

const rules: Record<RuleId, Rule> = {
  R_PAYMENT_REQUEST(text, e) {
    const out: Evidence[] = [];
    for (const fee of find(text, FEE_RE)) {
      const money = e.money
        .filter((m) => gap(m, fee) <= 80)
        .sort((a, b) => gap(a, fee) - gap(b, fee))[0];
      if (money) out.push(fee, ev(money));
    }
    // "pay … via UPI / scan QR" or a UPI handle near a pay verb
    const channels = [...find(text, PAY_CHANNEL_RE), ...e.upi.map(ev)];
    for (const verb of find(text, PAY_VERB_RE)) {
      const ch = channels.find((c) => gap(c, verb) <= 60);
      if (ch) out.push(verb, ch);
    }
    return sig("R_PAYMENT_REQUEST", out);
  },

  R_UPI_OR_CRYPTO(text, e) {
    return sig("R_UPI_OR_CRYPTO", [
      ...e.upi.map(ev),
      ...find(text, /\b(?:usdt|btc|bitcoin|cryptocurrency|crypto (?:wallet|payment|deposit|transfer)|ethereum|trc-?20|erc-?20|wallet address|gift ?cards?|binance)\b/gi),
    ]);
  },

  R_PERSONAL_DOCS(text) {
    const always = find(text, /\b(?:otp|cvv|card details|debit card (?:number|details)|credit card (?:number|details)|atm pin|upi pin|net ?banking (?:password|login|details)|selfie with (?:your )?(?:id|aadhaa?r|pan))\b/gi);
    const docs = find(text, /\b(?:aadhaa?r(?: card| number)?|pan card|pan number|bank account(?: number| details)?|ifsc(?: code)?|passport (?:copy|scan|number))\b/gi);
    // After an interview or an accepted offer, collecting ID and bank details for payroll is normal.
    const interviewed = /\b(?:interview|acceptance of (?:our|the|your) offer|accepted (?:our|the|your) offer|pre-?joining|onboarding portal|joining date)/i.test(text);
    return sig("R_PERSONAL_DOCS", interviewed ? always : [...always, ...docs]);
  },

  R_FREEMAIL_RECRUITER(text, e) {
    const hrContext = /\b(?:hr|h\.r\.|recruit\w*|hiring|talent acquisition|pvt|ltd|limited|inc|careers?|offer letter|human resources|placement|internship|job|company)\b/i.test(text);
    if (!hrContext) return [];
    return sig(
      "R_FREEMAIL_RECRUITER",
      e.emails.filter((m) => FREEMAIL.has((parse(m.value.split("@")[1]).domain ?? "").toLowerCase())).map(ev)
    );
  },

  R_TASK_SCAM(text) {
    const tasks = find(
      text,
      /\b(?:prepaid tasks?|merchant tasks?|task[- ]based (?:job|work)|simple tasks?|online tasks?|per task|each task|(?:like|subscribe|rate|rating|review|follow)\w*\b[^.\n]{0,40}?\b(?:videos?|youtube|hotels?|google maps|products?|posts?|channels?|apps?|restaurants?|movies?))\b/gi
    );
    const earn = find(text, /\b(?:per (?:task|like|review|day|video)|each task|daily|a day|\/day|per din|roz(?:ana)?|har din|daily income|daily earnings?|commission)\b/gi);
    return tasks.length && earn.length ? sig("R_TASK_SCAM", [...tasks.slice(0, 2), earn[0]]) : [];
  },

  R_TOO_GOOD_PAY(text, e) {
    const out: Evidence[] = [];
    const daily = find(text, /(?:per day|a day|\/day|daily|per din|roz(?:ana)?|har din|each day|everyday|every day)\b/gi);
    for (const m of e.money) {
      const big = m.amount !== null && ((m.currency === "INR" && m.amount >= 2000) || (m.currency === "USD" && m.amount >= 100));
      // daily term right after the amount ("₹5,000 per day") or just before it ("daily ₹3,000")
      const d = daily.find((x) => (x.start >= m.end && x.start - m.end <= 15) || (x.end <= m.start && m.start - x.end <= 12));
      if (big && d) out.push(ev(m), d);
    }
    const home = find(text, /\bearn\b[^.\n]{0,60}?\bfrom home\b/gi);
    const noExp = find(text, /\bno (?:prior )?experience\b/gi);
    if (home.length && noExp.length) out.push(home[0], noExp[0]);
    return sig("R_TOO_GOOD_PAY", out);
  },

  R_NO_INTERVIEW(text) {
    const explicit = find(
      text,
      /\b(?:selected without (?:an |any )?interview|without (?:any |an )?interview|direct joining|no interview (?:required|needed|round)|interview is not required|bina interview)\b/gi
    );
    if (explicit.length) return sig("R_NO_INTERVIEW", explicit);
    if (/\binterview/i.test(text)) return [];
    return sig("R_NO_INTERVIEW", find(text, /\byou (?:have been|are|got|were) (?:successfully )?(?:shortlisted|selected|hired)\b/gi));
  },

  R_OFF_PLATFORM(text, e) {
    const links = find(text, /\b(?:https?:\/\/)?(?:t\.me|wa\.me|telegram\.me|chat\.whatsapp\.com)\/[^\s]+/gi);
    const corporateEmail = e.emails.some((m) => !FREEMAIL.has((parse(m.value.split("@")[1]).domain ?? "").toLowerCase()));
    const phrases = corporateEmail
      ? []
      : find(
          text,
          /\b(?:contact|message|msg|text|join|reach|ping|add|dm|chat)\b[^.\n]{0,30}?\b(?:telegram|whatsapp)\b|\b(?:telegram|whatsapp)\s+(?:hr|id|group|channel|number|pe|par|me)\b/gi
        );
    return sig("R_OFF_PLATFORM", [...links, ...phrases]);
  },

  R_URL_SHORTENER(_text, e) {
    return sig(
      "R_URL_SHORTENER",
      e.urls.filter((u) => {
        const p = parse(u.value);
        return SHORTENERS.has((p.hostname ?? "").replace(/^www\./, "").toLowerCase());
      }).map(ev)
    );
  },

  R_SUSPICIOUS_TLD(_text, e) {
    return sig(
      "R_SUSPICIOUS_TLD",
      e.domains.filter((d) => SUSPICIOUS_TLDS.has(parse(d.domain).publicSuffix ?? "")).map(ev)
    );
  },

  R_URGENCY(text) {
    return sig(
      "R_URGENCY",
      find(
        text,
        /\b(?:within (?:the next )?(?:\d+|twenty[- ]four|one|two) ?(?:hours?|hrs?|days?|minutes?)|limited (?:seats|slots|positions|vacancies)|(?:only )?d+ (?:seats|slots|spots|positions) left|last date (?:is )?today|today only|immediately|urgent(?:ly)?|asap|offer (?:will )?expires?|expires? (?:today|tonight|soon)|act now|before (?:it'?s )?too late|jaldi)\b/gi
      )
    );
  },

  R_GENERIC_GREETING_OFFER(text) {
    const greet = find(text, /\bdear (?:candidate|applicant|student|job ?seeker|sir\/madam|sir or madam|user|friend)\b/gi);
    if (!greet.length || !/\b(?:offer|selected|shortlisted|congratulations)\b/i.test(text)) return [];
    return sig("R_GENERIC_GREETING_OFFER", greet.slice(0, 1));
  },
};

export const RULE_IDS = Object.keys(rules) as RuleId[];

/** Join a rule's evidence fragments that sit close together on the same line into one readable quote. */
export function mergeNearby(text: string, ev: Evidence[], maxGap = 30): Evidence[] {
  const out: Evidence[] = [];
  for (const e of [...ev].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && e.start - last.end <= maxGap && !text.slice(last.end, e.start).includes("\n")) {
      last.end = Math.max(last.end, e.end);
      last.quote = text.slice(last.start, last.end);
    } else {
      out.push({ ...e });
    }
  }
  return out;
}

export function runRules(text: string, entities: Entities): Signal[] {
  return RULE_IDS.flatMap((id) => rules[id](text, entities)).map((s) => ({ ...s, evidence: mergeNearby(text, s.evidence) }));
}

export function runRule(id: RuleId, text: string, entities: Entities): Signal[] {
  return rules[id](text, entities);
}
