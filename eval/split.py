"""Deterministic 40/60 dev/test split (seed 42). Dev may be used for tuning; test never.

Usage: python split.py   → data/<name>.dev.jsonl and data/<name>.test.jsonl for every source data/<name>.jsonl
"""
import json
import random
from pathlib import Path

DATA = Path(__file__).parent / "data"

for src in sorted(DATA.glob("*.jsonl")):
    if src.stem.endswith((".dev", ".test")):
        continue
    rows = [json.loads(l) for l in src.read_text(encoding="utf-8").splitlines() if l.strip()]
    idx = list(range(len(rows)))
    random.Random(42).shuffle(idx)
    cut = round(len(rows) * 0.4)
    for part, ids in (("dev", idx[:cut]), ("test", idx[cut:])):
        out = DATA / f"{src.stem}.{part}.jsonl"
        out.write_text("".join(json.dumps(rows[i], ensure_ascii=False) + "\n" for i in sorted(ids)), encoding="utf-8")
        print(f"{out.name}: {len(ids)}")
