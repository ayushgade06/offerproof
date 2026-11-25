# Devpost submission kit: OfferProof

Paste-ready text for the LaunchPad Hacks Devpost page. Every number below comes from `public/eval/results.json` (real run, 2026-11-26) or from measurements in `PROGRESS.md`.

**Name:** OfferProof
**Tagline:** Receipts, not vibes: scam-check any job or internship offer in 10 seconds.
**Team:** solo
**Links:** Demo https://offerproof-two.vercel.app · Source https://github.com/ayushgade06/offerproof · Video (add YouTube link)
**Built with:** nextjs, typescript, tailwindcss, vercel, anthropic, adaption, rdap, neon, python, zod, playwright, vitest

---

## Inspiration
Every student in my batch has received a "you're selected!" message that asks for a "refundable" fee. FTC data shows job-scam reports tripled from 2020 to 2024, and institutions like IIT Roorkee and PIB Fact Check issued fake-internship warnings this year. General AI scam checkers give you a verdict and expect you to trust it. I wanted one that shows its work.

## What it does
Paste a recruiter message or drop a screenshot. OfferProof highlights every red flag in the text and backs each one with a numbered **receipt**:
- a **rule** (e.g. a fee request near an amount, a UPI handle, a Telegram task-scam pattern),
- a **live lookup** (e.g. "infosys-internship-desk.online isn't registered to anyone", checked live via RDAP and confirmed by DNS; "uses a lookalike of Infosys's domain"), or
- an **AI flag whose quote was verified** to exist word for word in your message.

You get a 0–100 risk verdict, every check that ran (including the ones that couldn't), and region-aware next steps (1930 and cybercrime.gov.in in India). It **never says "safe"**: the lowest tier is "No major red flags found", followed by how to verify. You can share a redacted warning card with friends.

## How I built it
- **Next.js 16** on **Vercel** with one API route that runs everything in parallel: 12 deterministic rules, entity extraction (with exact character offsets), RDAP domain-age and DNS MX lookups, and a structured LLM review.
- **Grounding validator:** every AI flag must quote the message. The quote is located with whitespace- and quote-insensitive matching and mapped back to exact offsets. Unfound quotes are discarded and counted in the UI.
- **Anti-hallucination cap:** AI-only flags can't push a message past 60/100. High risk needs a rule or a live lookup.
- **Provider adapter:** Adaption Labs' Responses API (`qwen3.5-397b`) is first in line, and Anthropic `claude-haiku-5-5` is the fallback. I resolved Adaption's undocumented HTTP surface by reading the SDK source. **The live demo currently runs on Anthropic** because I didn't have an Adaption key during the build; the UI shows which provider answered.
- **Evaluation:** 70 fictional labeled messages written by an AI agent that never saw the detector's code, split 40/60 into dev (tuning) and test (held out). An Adaption Invent generator script is included for a larger synthetic set.
- Share cards in **Neon Postgres**: HMAC-signed, redacted, expire after 90 days.

## Results (held-out test split, 42 messages)
- **Recall 100%** (19/19 scams flagged), **precision 82.6%**, **F1 90.5%**. The 4 false positives were rated "Suspicious", never "High risk".
- A first test run scored 79.2% precision. It exposed a double-counting bug (two unregistered domains counted twice), which I fixed and disclosed on the site.
- Lighthouse (mobile, production): Performance 92, Accessibility 100, Best Practices 100, SEO 100. axe: 0 violations on the home and results pages in light and dark mode.
- 197 automated tests plus Playwright e2e against production.

## Challenges
- **An undocumented API surface.** Adaption's docs show only a Python SDK, so I read the generated client to find the base URL, the auth scheme and the Responses API shapes.
- **Keeping the AI honest.** Offsets had to be exact so highlights line up. I wrote a property test that `text.slice(start, end) === quote` for every piece of evidence.
- **Not lying with lookups.** rdap.org returns 404 both for "not registered" and for "no RDAP service" (e.g. `t.me`), so a 404 only counts when DNS also says the name doesn't exist. rdap.org also blocks Node's default user-agent.
- **False positives on real offers.** Legit onboarding emails ask for PAN and bank details after an offer, so the document rule learned that context, tuned on the dev split only.

## What I learned
Grounding LLM output against the source text is cheap and makes AI flags trustworthy. Evaluation design matters: a held-out split, and disclosing a bug that changed the numbers, are worth more than a pretty metric. Fictional test data has its own artifacts (made-up "legit" domains look unregistered). Accessibility is easier when highlights are numbered rather than color-only.

## Limitations
- The evaluation data is fictional and AI-written, so it likely overestimates real-world accuracy.
- Domain age is a signal, not proof. Some registries (e.g. `.in`) don't publish registration dates.
- New scam scripts can evade the rules, and the AI reviewer can vary between runs.
- It only sees text and can't verify a company's actual hiring.
- It never guarantees safety.

## What's next
Run the Adaption Invent synthetic eval, run placement-cell pilots, add a WhatsApp forward-to-check number, add more languages, and keep a community-confirmed scam-domain list.

## Built during the hackathon · AI assistance · Credits
All code was written Nov 26 – Dec 4, 2026. Planning and code were written with assistance from Claude (Anthropic). Evaluation cases were written by a Claude agent that didn't see the detector code. Credits: Adaption Labs, Anthropic, rdap.org, tldts, zod, Next.js, Tailwind CSS, Neon, Vercel, Google Fonts (Instrument Serif, Inter, IBM Plex Mono).

---

## Screenshots (in `docs/`)
1. `1-hero.png`: the hero with input
2. `2-result-desktop.png`: results for the fee-internship sample
3. `3-screenshot-result-mobile.png`: the Telegram screenshot sample on mobile
4. `4-accuracy.png`: the accuracy section
5. `5-share-card.png`: a redacted share card

Regenerate with `BASE=https://offerproof-two.vercel.app node scripts/submission-shots.mjs`.

## Demo video (≤2:30): shot list

| Time | Visual | Voice-over |
|---|---|---|
| 0:00–0:15 | The fictional Telegram screenshot (`public/samples/telegram-task.png`) full screen | "Students get messages like this every placement season. Earn ₹8,000 a day rating hotels. Is it a scam?" |
| 0:15–0:25 | Title card: OfferProof, receipts not vibes | "OfferProof tells you in seconds, and shows you exactly why." |
| 0:25–1:05 | Click "Telegram task job" → progress steps → highlights draw in → HIGH RISK stamp | "It reads the screenshot, runs twelve red-flag rules, looks up every domain live, and asks an AI reviewer whose every claim must quote the message word for word." |
| 1:05–1:25 | The fee-internship sample: hover receipt 3 (lookalike) and receipt 4 (not registered), then the Gmail receipt | "This 'Infosys' recruiter links to a domain that isn't Infosys's, and isn't even registered, and writes from Gmail." |
| 1:25–1:45 | The legit sample → "No major red flags found" + verify steps | "It isn't paranoid. A normal interview invite comes back clean, but it still tells you how to verify, because no tool should promise safety." |
| 1:45–2:05 | How it works → accuracy card | "On a held-out test set it caught every scam: 100% recall and 83% precision. Here are its limits." |
| 2:05–2:25 | Pipeline section, then the AI-unavailable banner (state it, don't fake it) | "Rules, live lookups and a grounded AI review. If the AI is down, rules and lookups keep working." |
| 2:25–2:30 | URL | "OfferProof. Check before you pay." |

Record at 1080p with clear audio and burned-in captions. Upload to YouTube (unlisted is fine).

## Final checklist
- [x] Production URL works (e2e passes against production)
- [x] All 3 samples give the expected verdicts; the screenshot sample works
- [x] Degraded mode verified on a real deployment (invalid key → rules + lookups, banner; image → 503)
- [x] 404 page; missing share cards return a real 404
- [x] Lighthouse ≥90/95/95, axe 0 serious on home and results
- [x] Rate limits active (8/min per IP, daily cap)
- [x] MIT license, README, `.env.example` with names only, no secrets in git history
- [x] Tests pass (197 unit/integration, 3 e2e)
- [ ] **Make the GitHub repo public** (created private): `gh repo edit ayushgade06/offerproof --visibility public --accept-visibility-change-consequences`
- [ ] Tag the release: `git tag v1.0-launchpad && git push --tags`
- [ ] Record and upload the video, then add its link
- [ ] Fill in the Devpost page from this file and upload the 5 screenshots
- [ ] Submit before **Dec 4, 2026, 5:00 PM ET (Dec 5, 3:30 AM IST)**; target Dec 4, 18:00 IST
- [ ] Keep the Vercel deployment and the Anthropic key live through at least Dec 31, 2026
