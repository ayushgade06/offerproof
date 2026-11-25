"""Run labeled messages through /api/analyze and write public/eval/results.json.

Usage: python run_eval.py --base-url http://localhost:3417 [--split test|dev|all] [--delay 8]
"flagged" = high_risk or suspicious; "not flagged" = no_major_flags. Positive class = scam.
Never edit results.json by hand.
"""
import argparse
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent
DATA = ROOT / "data"
OUT = ROOT.parent / "public" / "eval" / "results.json"

DESCRIPTIONS = {
    "handwritten": (
        "hand-written fictional messages",
        "Written by an AI agent (Claude) that never saw the detector's code, modeled on scam patterns described in public advisories. Sources: eval/SOURCES.md.",
    ),
    "synthetic_test": ("Adaption Invent synthetic messages", "Generated with Adaption Labs Invent (eval/invent_dataset.py)."),
}


def load(path):
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        text = r.get("text") or r.get("instruction") or r.get("prompt") or r.get("input")
        label = r.get("label")
        if not label:
            resp = str(r.get("response") or r.get("completion") or r.get("output") or "")
            label = "scam" if resp.strip().upper().startswith("SCAM") else "legit"
        if text:
            rows.append({"id": r.get("id"), "text": text[:12000], "label": label})
    return rows


def analyze(base, text, retries=4):
    body = json.dumps({"text": text}).encode()
    for _ in range(retries):
        req = urllib.request.Request(f"{base}/api/analyze", data=body, headers={"content-type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=90) as res:
                return json.loads(res.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(int(e.headers.get("Retry-After", "30")) + 1)
                continue
            raise
    raise RuntimeError("rate limited too many times")


def rnd(v):
    return None if v is None else round(v, 4)


def metrics(results):
    tp = sum(r["label"] == "scam" and r["flagged"] for r in results)
    fn = sum(r["label"] == "scam" and not r["flagged"] for r in results)
    fp = sum(r["label"] == "legit" and r["flagged"] for r in results)
    tn = sum(r["label"] == "legit" and not r["flagged"] for r in results)
    p = tp / (tp + fp) if tp + fp else None
    rc = tp / (tp + fn) if tp + fn else None
    f1 = 2 * p * rc / (p + rc) if p and rc else None
    tiers = {}
    for r in results:
        k = f"{r['label']}:{r['verdict']}"
        tiers[k] = tiers.get(k, 0) + 1
    return {
        "n": len(results),
        "precision": rnd(p),
        "recall": rnd(rc),
        "f1": rnd(f1),
        "accuracy": rnd((tp + tn) / len(results)),
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "tiers": tiers,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:3417")
    ap.add_argument("--split", default="test", choices=["dev", "test", "all"])
    ap.add_argument("--delay", type=float, default=8.0, help="seconds between requests (the API allows 8/min per IP)")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--note", action="append", default=[], help="extra note to publish with the results")
    args = ap.parse_args()

    groups = {}
    for src in sorted(DATA.glob("*.jsonl")):
        stem = src.stem
        if args.split == "all":
            if stem.endswith((".dev", ".test")):
                continue
            name = stem
        elif stem.endswith(f".{args.split}"):
            name = stem.rsplit(".", 1)[0]
        else:
            continue
        group = "synthetic_test" if name.startswith("invent_") else name
        groups.setdefault(group, []).extend(load(src))

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "split": args.split,
        "baseUrl": args.base_url,
        "provider": None,
        "model": None,
        "datasets": {},
        "metrics": {},
        "misses": {},
        "notes": [],
    }
    for group, rows in groups.items():
        results = []
        for i, row in enumerate(rows):
            r = analyze(args.base_url, row["text"])
            out["provider"] = out["provider"] or r["engine"]["provider"]
            out["model"] = out["model"] or r["engine"]["model"]
            flagged = r["verdict"] != "no_major_flags"
            results.append({"id": row["id"], "label": row["label"], "verdict": r["verdict"], "score": r["score"], "flagged": flagged,
                            "signals": [s["id"] for s in r["signals"]]})
            ok = (row["label"] == "scam") == flagged
            print(f"[{group} {i + 1}/{len(rows)}] {row['id']} {row['label']:5} -> {r['verdict']:14} {r['score']:3} {'ok' if ok else 'MISS'}", flush=True)
            time.sleep(args.delay)
        out["metrics"][group] = metrics(results)
        out["misses"][group] = [r for r in results if (r["label"] == "scam") != r["flagged"]]
        desc, source = DESCRIPTIONS.get(group, (group, ""))
        out["datasets"][group] = {"n": len(rows), "description": desc, "source": source}
        print(json.dumps(out["metrics"][group], indent=2))

    out["notes"] = [
        f"Held-out {args.split} split; scoring weights may be tuned only on the dev split." if args.split == "test" else f"Split: {args.split}.",
        "All cases are fictional. Synthetic and hand-written data likely overestimate real-world accuracy.",
    ] + args.note
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
