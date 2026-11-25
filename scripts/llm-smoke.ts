// Temporary smoke script (plan M1). Run: npx tsx --env-file=.env.local scripts/llm-smoke.ts
import { readFileSync, existsSync } from "node:fs";
import { analyze } from "../lib/analyze";
import { callLLM } from "../lib/llm";
import { SAMPLES } from "../lib/samples";

(async () => {
  const r = await callLLM({ system: "Be terse.", user: "Reply with the word ok" });
  console.log("text call:", r.provider, r.model, r.latencyMs + "ms", JSON.stringify(r.text));
  const png = "public/samples/telegram-task.png";
  if (existsSync(png)) {
    const img = "data:image/png;base64," + readFileSync(png).toString("base64");
    const v = await callLLM({ system: "Transcribe the text.", user: "What does it say? First line only.", imageDataUrl: img });
    console.log("image call:", v.provider, JSON.stringify(v.text.slice(0, 80)));
  }
  for (const s of SAMPLES.filter((x) => x.text)) {
    const t0 = Date.now();
    const a = await analyze({ text: s.text });
    console.log(`\n[${s.id}] ${a.verdict} ${a.score} in ${Date.now() - t0}ms provider=${a.engine.provider} dropped=${a.engine.droppedUngrounded}`);
    for (const sig of a.signals) console.log(`  ${sig.weight.toFixed(2)} ${sig.id} | ${sig.title} | ${sig.evidence.map((e) => e.quote).join(" / ")}${sig.detail ? " | " + sig.detail : ""}${sig.aiNote ? " | ai: " + sig.aiNote : ""}`);
    console.log("  summary:", a.summary);
  }
})();
