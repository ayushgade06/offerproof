import { describe, expect, it } from "vitest";
import { buildSegments } from "../lib/highlight";
import { targetSize, validateImageFile } from "../lib/image";
import type { Signal } from "../lib/types";

const sig = (weight: number, ev: [number, number][], text: string): Signal => ({
  id: "X", title: "x", explanation: "x", severity: "high", weight, source: "rule",
  evidence: ev.map(([start, end]) => ({ start, end, quote: text.slice(start, end) })),
});

describe("buildSegments", () => {
  const t = "pay the fee of Rs 500 now please";
  it("reassembles the original text exactly", () => {
    const segs = buildSegments(t, [sig(0.7, [[0, 3], [15, 21]], t)]);
    expect(segs.map((s) => s.text).join("")).toBe(t);
  });
  it("numbers marks by receipt order", () => {
    const segs = buildSegments(t, [sig(0.7, [[0, 3]], t), sig(0.1, [[26, 32]], t)]);
    expect(segs.filter((s) => s.mark).map((s) => s.mark!.nums)).toEqual([[1], [2]]);
  });
  it("merges overlapping spans and lists both numbers", () => {
    const segs = buildSegments(t, [sig(0.7, [[4, 14]], t), sig(0.2, [[8, 21]], t)]);
    const marks = segs.filter((s) => s.mark);
    expect(marks.length).toBe(1);
    expect(marks[0].text).toBe(t.slice(4, 21));
    expect(marks[0].mark!.nums).toEqual([1, 2]);
    expect(marks[0].mark!.tone).toBe("risk");
  });
  it("uses the warn tone for low-weight-only marks", () => {
    expect(buildSegments(t, [sig(0.1, [[22, 25]], t)]).find((s) => s.mark)!.mark!.tone).toBe("warn");
  });
  it("ignores out-of-range evidence", () => {
    expect(buildSegments(t, [sig(0.5, [[30, 99]], t)]).every((s) => !s.mark)).toBe(true);
  });
});

describe("image helpers", () => {
  it("downscales the long edge to 1600px", () => {
    expect(targetSize(3200, 1800)).toEqual({ width: 1600, height: 900 });
    expect(targetSize(1080, 2400)).toEqual({ width: 720, height: 1600 });
  });
  it("never upscales", () => {
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("rejects HEIC, non-images and files over 10 MB", () => {
    expect(validateImageFile({ type: "image/heic", name: "a.heic", size: 1 })).toMatch(/HEIC/);
    expect(validateImageFile({ type: "application/pdf", name: "a.pdf", size: 1 })).toMatch(/isn't an image/);
    expect(validateImageFile({ type: "image/png", name: "a.png", size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(validateImageFile({ type: "image/png", name: "a.png", size: 1000 })).toBeNull();
  });
});
