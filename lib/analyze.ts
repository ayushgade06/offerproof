import { extractEntities } from "./extract";
import { aiConfigured } from "./llm";
import { checkLookalike, runNetworkLookups } from "./lookups";
import { detectRegion, nextSteps } from "./next-steps";
import { redactResult } from "./redact";
import { reviewMessage, transcribeImage } from "./review";
import { RULE_IDS, RULE_META, runRules } from "./rules";
import { dedupe, scoreSignals } from "./score";
import { shareEnabled, signShare } from "./share";
import type { AnalysisResult, Check, Signal } from "./types";

export const DISCLAIMER =
  "OfferProof points out warning signs. It can't confirm that an offer is real, so always verify with the company directly.";

const BANNED = /\b(safe|legit\w*|genuine|guarantee\w*|scam\w*|fraud\w*)\b/i;

function fallbackSummary(signals: Signal[]): string {
  if (!signals.length) return "We didn't find any of the warning signs we check for. Verify the sender before sharing documents or money.";
  const top = signals.slice(0, 3).map((s) => s.title.toLowerCase());
  return `We found ${signals.length} warning sign${signals.length === 1 ? "" : "s"}, including: ${top.join("; ")}.`;
}

export interface AnalyzeDeps {
  review?: typeof reviewMessage;
  transcribe?: typeof transcribeImage;
  lookups?: typeof runNetworkLookups;
  now?: number;
}

export async function analyze(input: { text?: string; image?: string }, deps: AnalyzeDeps = {}): Promise<AnalysisResult & { lookupFailures: number }> {
  const review = deps.review ?? reviewMessage;
  const transcribe = deps.transcribe ?? transcribeImage;
  const lookups = deps.lookups ?? runNetworkLookups;

  let text = input.text ?? "";
  let llmLatency = 0;
  let transcriber: { provider: "adaption" | "anthropic"; model: string } | null = null;
  if (input.image) {
    const t = await transcribe(input.image); // throws VisionUnavailableError → 503 in the route
    text = t.text;
    llmLatency += t.llm.latencyMs;
    transcriber = { provider: t.llm.provider, model: t.llm.model };
  }

  const entities = extractEntities(text);
  const ruleSignals = runRules(text, entities);
  const [net, ai] = await Promise.all([lookups(entities, deps.now), deps.review || aiConfigured() ? review(text) : Promise.resolve(null)]);
  const lookalike = checkLookalike(entities, ai?.extracted.claimedCompany ?? null, text);

  const signals = dedupe([...ruleSignals, ...net.signals, ...lookalike.signals, ...(ai?.signals ?? [])]).sort(
    (a, b) => b.weight - a.weight || (a.evidence[0]?.start ?? 1e9) - (b.evidence[0]?.start ?? 1e9)
  );
  const { score, verdict } = scoreSignals(signals);

  const fired = new Set(ruleSignals.map((s) => s.id));
  const checks: Check[] = [
    ...RULE_IDS.map((id): Check => ({ id, label: RULE_META[id].title, status: fired.has(id) ? "flagged" : "passed" })),
    ...net.checks,
    ...lookalike.checks,
    ai
      ? {
          id: "AI_REVIEW",
          label: "AI review (quotes verified against your text)",
          status: ai.signals.length ? "flagged" : "passed",
          detail:
            `${ai.signals.length} verified flag${ai.signals.length === 1 ? "" : "s"}` +
            (ai.droppedUngrounded ? `; ${ai.droppedUngrounded} discarded because the quote wasn't in your text` : ""),
        }
      : { id: "AI_REVIEW", label: "AI review", status: "unavailable", detail: "AI review unavailable; rules and lookups only" },
  ];

  const region = detectRegion(text, entities, ai?.language);
  const summary = ai?.summary && !BANNED.test(ai.summary) ? ai.summary : fallbackSummary(signals);
  if (ai) llmLatency += ai.llm.latencyMs;
  const provider = ai?.llm.provider ?? transcriber?.provider ?? "none";

  const result: AnalysisResult & { lookupFailures: number } = {
    verdict,
    score,
    summary,
    text,
    fromImage: Boolean(input.image),
    extracted: ai
      ? {
          claimedCompany: ai.extracted.claimedCompany,
          role: ai.extracted.role,
          payOffered: ai.extracted.payOffered,
          contactChannels: ai.extracted.contactChannels,
          asksFromCandidate: ai.extracted.asksFromCandidate,
        }
      : null,
    signals,
    checks,
    nextSteps: nextSteps(verdict, signals, region),
    region,
    engine: {
      provider: ai ? provider : "none",
      model: ai?.llm.model ?? null,
      latencyMs: llmLatency,
      droppedUngrounded: ai?.droppedUngrounded ?? 0,
    },
    disclaimer: DISCLAIMER,
    lookupFailures: net.checks.filter((c) => c.status === "unavailable").length,
  };
  if (shareEnabled()) {
    const redactedResult = redactResult(result, ai?.extracted.names ?? []);
    result.share = { redactedResult, shareToken: signShare(redactedResult) };
  }
  return result;
}
