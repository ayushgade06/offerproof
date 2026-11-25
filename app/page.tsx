import { IconGlobe, IconLock, IconReceipt } from "@/components/icons";
import { Kicker } from "@/components/ui";
import { Checker } from "./checker";

const TRUST = [
  { icon: <IconReceipt size={20} />, title: "Receipts, not vibes", body: "Every flag quotes your message or a live lookup. AI claims that can't be found in your text are thrown out." },
  { icon: <IconGlobe size={20} />, title: "Live lookups", body: "We check how old the website is, whether the email domain is real, and whether it imitates a known employer." },
  { icon: <IconLock size={20} />, title: "Nothing stored", body: "Your text and screenshots are processed in memory and discarded. No account, no history." },
];

function Hero() {
  return (
    <div>
      <Kicker>Scam check for job &amp; internship offers</Kicker>
      <h1 className="mt-4 font-serif text-[2.6rem] leading-[1.02] tracking-tight text-balance sm:text-6xl">
        Got a job offer that <em className="text-risk">feels off?</em>
      </h1>
      <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-2 text-pretty">
        Check it before you reply, pay, or share documents. OfferProof marks the exact red flags and shows you the proof for each one.
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <Checker
      hero={<Hero />}
      footer={
      <section aria-labelledby="trust-title" className="border-t border-rule bg-paper-2/50">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 id="trust-title" className="sr-only">
            Why trust the result
          </h2>
          <ul className="grid gap-8 sm:grid-cols-3 sm:gap-10">
            {TRUST.map((t) => (
              <li key={t.title}>
                <span className="grid size-10 place-items-center rounded-lg border border-rule bg-card text-ink">{t.icon}</span>
                <h3 className="mt-4 text-[15px] font-semibold">{t.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{t.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      }
    />
  );
}
