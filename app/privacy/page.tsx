import type { Metadata } from "next";
import { Kicker } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy", description: "OfferProof doesn't store what you paste." };

const ITEMS = [
  {
    h: "We don't store what you paste",
    p: "Screenshots and text are processed in memory to produce your result and then discarded. There are no accounts and no history. Our logs record the verdict, score and which checks fired, never your text.",
  },
  {
    h: "Shared warning cards are redacted",
    p: "If you choose to share a result, we store only a redacted summary: emails, phone numbers, UPI IDs and people's names are removed. Website domains are kept because they are the evidence. Cards are deleted from view after 90 days.",
  },
  {
    h: "Who processes your message",
    p: "AI processing is performed by Adaption Labs (or Anthropic as a fallback) under their terms. Domain registration lookups go to rdap.org and DNS; only the domain name is sent, never your message.",
  },
  {
    h: "We never visit your links",
    p: "OfferProof never opens the URLs in your message. It only looks up the registration record of the domain name.",
  },
];

export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
      <Kicker>Privacy</Kicker>
      <h1 className="mt-4 font-serif text-5xl leading-tight tracking-tight">Nothing you paste is kept.</h1>
      <div className="mt-10 space-y-8">
        {ITEMS.map((i) => (
          <section key={i.h}>
            <h2 className="text-lg font-semibold">{i.h}</h2>
            <p className="mt-2 leading-relaxed text-ink-2">{i.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
