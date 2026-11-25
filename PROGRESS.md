# PROGRESS.md: OfferProof build log

Built during LaunchPad Hacks (hacking window ends Dec 4, 2026, 5:00 PM ET). Work started Nov 26, 2026.

## Completed milestones

| Milestone | Date | Notes |
|---|---|---|
| M0 Accounts & keys | 2026-11-26 | Anthropic key available. **No Adaption API key was provided**, so the Adaption path is implemented to spec but unverified with a live call (see Known issues). |
| M1 Foundation + LLM adapter | 2026-11-26 | Next.js 16.4.6 (App Router, TS, Tailwind 4). `lib/llm.ts`: Adaption Responses API first, Anthropic Messages fallback, `AIUnavailableError` otherwise. Spike resolved from the `adaption` 0.19.0 wheel source (read, not executed). |
| M2 Design system & shell | 2026-11-26 | "Receipt" identity: paper/ink tokens (light + dark), Instrument Serif / Inter / IBM Plex Mono, perforated receipt panels, rubber-stamp verdict. |
| M3 Extraction & rules | 2026-11-26 | `lib/extract.ts`, `lib/rules.ts` (12 rules), `lib/score.ts`. ≥3 positive / ≥3 negative fixtures per rule, legit-offer fixture, offset property test. |
| M4 Live lookups | 2026-11-26 | RDAP age (404 confirmed by DNS), MX, lookalike (inline Levenshtein). `data/official-domains.json`: 63 employers, each verified 2026-11-26. |
| M5 AI review + grounding | 2026-11-26 | zod schema, one repair retry, grounding validator (whitespace/quote-insensitive, exact original offsets). |
| M6 Analyze API + results UI | 2026-11-26 | Route with validation, rate limit, structured log; results with synced highlights ↔ receipts, checks, next steps, degraded banner. |
| M7 Screenshot robustness | 2026-11-26 | see below |
| M9 Share cards (P1) | 2026-11-26 | Code complete (`lib/redact.ts`, `lib/share.ts`, `/api/share`, `/r/[id]`). Feature-flagged on `SHARE_SECRET` + `DATABASE_URL`. |

## Decisions
- **Anthropic is the live provider.** No Adaption key was available; the plan's contingency applies. The Adaption code path stays first in line and activates as soon as `ADAPTION_API_KEY` is set.
- **Plain `fetch`, no SDKs** (plan 16.5), so no `@anthropic-ai/sdk` dependency.
- **Claude Haiku 5.5 request shape:** `temperature` is rejected on current Claude models ("`temperature` is deprecated for this model"), so it is omitted. Thinking is set to `{type:"disabled"}` for Haiku (allowed at its default effort) to keep latency low for this extraction task.
- **rdap.org returns 403 to Node's default user-agent**, so lookups send `User-Agent: OfferProof/1.0`.
- **rdap.org returns 404 both for "not registered" and for TLDs with no RDAP service** (e.g. `t.me`). A 404 counts as "unregistered" only when DNS also returns NXDOMAIN, so a false "not registered" receipt can't appear.
- `.in` registry RDAP doesn't publish registration dates, so those checks show "unavailable", never a guess.
- **Extra dependencies** beyond the plan's allow-list: none. (`@types/node` bumped to ^24 to satisfy vitest's peer range.)
- Rule evidence fragments on the same line within 30 chars are merged into one quote ("pay the ₹1,999 refundable training kit fee") for readability.
- Bare domains (no `www.`/scheme) are extracted only for a list of common TLDs, to avoid matching `Node.js`. Marked with a `ponytail:` comment.

## Verified external facts
- **Adaption** (from `adaption` 0.19.0 SDK source, `_client.py` + `resources/responses/responses.py`):
  - Base URL `https://api.prod.adaptionlabs.ai` (env `ADAPTION_BASE_URL` overrides). Reachable: `GET /api/v1/models` without auth → 401.
  - Auth header `Authorization: Bearer <ADAPTION_API_KEY>`.
  - Inference: `POST /api/v1/responses` with `{model, instructions, input:[{role:"user", content:[{type:"input_text",text},{type:"input_image",image_url:"data:…"}]}], temperature, max_output_tokens, store:false}` → response `{status, output_text}`. No chat-completions endpoint exists in the SDK.
  - Invent: `POST /api/v1/datasets/invent` (`client.datasets.invent(rows, dataset_prompt, training_type, estimate, idempotency_key, translate, localize)`).
- **Anthropic**: `POST https://api.anthropic.com/v1/messages`, `x-api-key`, `anthropic-version: 2023-06-01`, model `claude-haiku-5-5`. Verified live.
- **RDAP**: `https://rdap.org/domain/{d}` → 302 to the registry (e.g. Verisign for .com). `google.com` registration 1997-09-15 (live test).

## Live measurements
- Sample 1 (fee internship, text): High risk 99, ~3.6 s end to end, 0 ungrounded quotes dropped.
- Sample 3 (legit interview, text): No major red flags 0, ~1.5 s, 0 AI flags.
- Sample 2 (Telegram screenshot): High risk 95, ~5.5 s including transcription; transcription verbatim.

## Known issues
- Adaption inference and Invent are untested live (no key). To enable: set `ADAPTION_API_KEY`, then run `eval/invent_dataset.py`.
- Rate limits and caches are per serverless instance (marked `ponytail:` in code).
