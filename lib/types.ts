export type Source = "rule" | "lookup" | "ai";
export type Severity = "critical" | "high" | "medium" | "low";
export type Verdict = "high_risk" | "suspicious" | "no_major_flags";

export interface Evidence {
  start: number;
  end: number;
  quote: string;
}

export interface Signal {
  id: string; // e.g. "R_PAYMENT_REQUEST", "L_DOMAIN_AGE", "AI_task_scam"
  title: string;
  explanation: string;
  severity: Severity;
  weight: number;
  source: Source;
  evidence: Evidence[];
  detail?: string;
  aiNote?: string;
}

export interface Check {
  id: string;
  label: string;
  status: "passed" | "flagged" | "unavailable" | "skipped";
  detail?: string;
}

export interface Extracted {
  claimedCompany: string | null;
  role: string | null;
  payOffered: string | null;
  contactChannels: string[];
  asksFromCandidate: string[];
}

export interface Engine {
  provider: "adaption" | "anthropic" | "none";
  model: string | null;
  latencyMs: number;
  droppedUngrounded: number;
}

export interface AnalysisResult {
  verdict: Verdict;
  score: number;
  summary: string;
  text: string;
  fromImage: boolean;
  extracted: Extracted | null;
  signals: Signal[];
  checks: Check[];
  nextSteps: string[];
  region: "IN" | "GLOBAL";
  engine: Engine;
  disclaimer: string;
  share?: { redactedResult: RedactedResult; shareToken: string };
}

export interface RedactedResult {
  verdict: Verdict;
  score: number;
  summary: string;
  claimedCompany: string | null;
  signals: { id: string; title: string; explanation: string; severity: Severity; source: Source; quotes: string[]; detail?: string }[];
}
