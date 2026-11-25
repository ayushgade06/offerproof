import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowRight } from "@/components/icons";
import { Chip, Kicker, SourceBadge, Stamp, VERDICT_STYLE } from "@/components/ui";
import { getShare } from "@/lib/db";
import { VERDICT_LABEL } from "@/lib/score";

// Rendered per request (a DB read), blocking, so a missing or expired id returns a real 404.
export const instant = false;

export const metadata: Metadata = {
  title: "Shared scam warning",
  description: "Someone shared an OfferProof warning card: the red flags found in a job or internship offer, with proof for each.",
  openGraph: { title: "A job-offer scam warning was shared with you", description: "See the red flags OfferProof found, then check your own offer in 10 seconds." },
  robots: { index: false },
};

export default async function SharedCard({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  const card = process.env.DATABASE_URL ? await getShare(id).catch(() => null) : null;
  if (!card) notFound();
  const label = VERDICT_LABEL[card.verdict];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      <Kicker>Shared warning card · {card.createdAt.slice(0, 10)}</Kicker>
      <div className="receipt mt-6 rounded-sm px-5 py-7 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl leading-tight tracking-tight">{label.title}</h1>
            <p className={`mt-1 font-medium ${VERDICT_STYLE[card.verdict].color}`}>{label.sub}</p>
            {card.claimedCompany && <p className="mt-2 text-[14px] text-muted">Message claimed to be from: {card.claimedCompany}</p>}
          </div>
          <Stamp verdict={card.verdict} />
        </div>
        <p className="mt-5 text-[15px] leading-relaxed text-ink-2">{card.summary}</p>
        <hr className="dashed-rule my-6" />
        <h2 className="font-serif text-2xl">Receipts</h2>
        <ol className="mt-3 space-y-4">
          {card.signals.map((s, i) => (
            <li key={i} className="grid grid-cols-[28px_1fr] gap-3">
              <span className="grid size-7 place-items-center rounded-full bg-risk font-mono text-[12px] font-semibold text-paper">{i + 1}</span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{s.title}</h3>
                  <Chip severity={s.severity} />
                </div>
                <p className="mt-1 text-[14px] text-ink-2">{s.explanation}</p>
                {s.source !== "lookup" &&
                  s.quotes.slice(0, 2).map((q, j) => (
                    <p key={j} className="mt-1.5 border-l-2 border-rule-strong pl-2.5 font-mono text-[12.5px] text-ink-2">
                      “{q}”
                    </p>
                  ))}
                <div className="mt-2 flex flex-wrap gap-3">
                  <SourceBadge source={s.source} />
                  {s.detail && <span className="font-mono text-[11.5px] text-muted">{s.detail}</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>
        <hr className="dashed-rule my-6" />
        <p className="font-mono text-[11px] text-muted">Emails, phone numbers, UPI IDs and names were removed before sharing.</p>
      </div>
      <div className="mt-10 rounded-xl border border-rule bg-card p-6 text-center shadow-card">
        <p className="font-serif text-2xl">Got a suspicious offer of your own?</p>
        <Link href="/" className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-lg bg-ink px-5 font-medium text-paper hover:bg-ink-2">
          Check your own offer <IconArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}
