import type { Signal } from "./types";

export interface Segment {
  text: string;
  mark?: { nums: number[]; tone: "risk" | "warn"; index: number };
}

/** Split text into plain and highlighted segments. Overlapping evidence merges into one mark listing every receipt number. */
export function buildSegments(text: string, signals: Signal[]): Segment[] {
  const spans = signals.flatMap((s, i) =>
    s.evidence
      .filter((e) => e.start >= 0 && e.end <= text.length && e.end > e.start)
      .map((e) => ({ start: e.start, end: e.end, num: i + 1, weight: s.weight }))
  );
  spans.sort((a, b) => a.start - b.start || b.end - a.end);

  const groups: { start: number; end: number; nums: Set<number>; weight: number }[] = [];
  for (const s of spans) {
    const g = groups[groups.length - 1];
    if (g && s.start < g.end) {
      g.end = Math.max(g.end, s.end);
      g.nums.add(s.num);
      g.weight = Math.max(g.weight, s.weight);
    } else {
      groups.push({ start: s.start, end: s.end, nums: new Set([s.num]), weight: s.weight });
    }
  }

  const out: Segment[] = [];
  let pos = 0;
  groups.forEach((g, index) => {
    if (g.start > pos) out.push({ text: text.slice(pos, g.start) });
    out.push({
      text: text.slice(g.start, g.end),
      mark: { nums: [...g.nums].sort((a, b) => a - b), tone: g.weight >= 0.3 ? "risk" : "warn", index },
    });
    pos = g.end;
  });
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}
