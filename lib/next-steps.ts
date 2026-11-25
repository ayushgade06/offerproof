import type { Entities } from "./extract";
import type { Signal, Verdict } from "./types";

export function detectRegion(text: string, entities: Entities, language?: string): "IN" | "GLOBAL" {
  if (language === "hi" || language === "hinglish") return "IN";
  if (/₹|\brs\.?\s?\d|\binr\b|\+91|\blakh|\bupi\b|\baadhaa?r\b/i.test(text)) return "IN";
  if (entities.upi.length) return "IN";
  if (entities.domains.some((d) => d.domain.endsWith(".in"))) return "IN";
  return "GLOBAL";
}

export function nextSteps(verdict: Verdict, signals: Signal[], region: "IN" | "GLOBAL"): string[] {
  const ids = new Set(signals.map((s) => s.id));
  const out: string[] = [];

  if (ids.has("R_PAYMENT_REQUEST") || ids.has("AI_payment_request") || ids.has("R_UPI_OR_CRYPTO")) {
    out.push(
      region === "IN"
        ? "Don't pay anything. If you already paid, call 1930 and your bank right away; fast reports can freeze the money."
        : "Don't pay anything. If you already paid, contact your bank right away and ask them to reverse or block the payment."
    );
  }
  if (ids.has("R_TASK_SCAM") || ids.has("AI_task_scam")) {
    out.push("Don't deposit money for a \"prepaid task\". Early small payouts are bait; larger deposits are never returned.");
  }
  if (ids.has("R_PERSONAL_DOCS") || ids.has("AI_personal_data_request")) {
    out.push("Don't send ID, bank details or OTPs. Share documents only after a verified offer, through the company's official HR portal.");
  }
  const lookalike = signals.find((s) => s.id === "L_BRAND_LOOKALIKE");
  if (lookalike) out.push(`${lookalike.explanation} Go to the official site yourself instead of clicking the link.`);
  if (ids.has("R_OFF_PLATFORM") || ids.has("AI_offplatform_contact")) {
    out.push("Ask to continue over the company's official email. Real recruiters don't hire through Telegram or WhatsApp groups.");
  }

  out.push(
    "Never pay to get a job. Real employers don't charge registration, training or equipment fees.",
    "Verify the offer through the company's official careers page or official HR email, not the contact details in this message.",
    "Ask for a video interview with someone using a company email address."
  );

  if (verdict !== "no_major_flags") {
    out.push(
      region === "IN"
        ? "Report it at cybercrime.gov.in or call the 1930 helpline."
        : "Report it at reportfraud.ftc.gov (US) or your national cybercrime portal."
    );
  }
  return out;
}
