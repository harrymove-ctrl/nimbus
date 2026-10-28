#!/usr/bin/env python3
"""Exports real model calls from the local mock runs for the rev D motion scenes.

  python3 scripts/export-mock-calls.py      # → src/datasets/mock-calls.json, src/datasets/run-hops.json

- mock-calls.json (Scatter Bloom, scene 14): one point per `usage` event in the dev database
  (data/nimbus.db): minute of the day it ran (ICT), its tier, and its cost from the token counts
  at src/lib/models.ts PRICE_PER_M. Every run there is model "mock"; the scene says so.
- run-hops.json (Metric Morph, scene 8): the hops of the take's first Morning brief run
  (data/video-rev5/nimbus.db, the $0.024 run on screen), in order, with their cost.

Both databases are opened read-only; nothing is invented, sampled or smoothed.
"""
import json, sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT.parent
# USD per 1M tokens [in, out], src/lib/models.ts PRICE_PER_M
PRICE = {"ultra": (1, 3), "super": (0.3, 0.9), "nano": (0.06, 0.24)}
ICT_MS = 7 * 3600 * 1000
TAKE_RUN = "run_5d03029a"


def db(path):
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True)


def cost(u):
    p_in, p_out = PRICE[u["tier"]]
    return (u["in"] * p_in + u["out"] * p_out) / 1e6


def usage_rows(con, where="", args=()):
    q = f"""select r.id, r.model, r.started_at + e.t_ms, e.payload from run_events e
            join runs r on r.id = e.run_id where e.type = 'usage' {where} order by r.started_at, e.seq"""
    return [(rid, model, t, json.loads(p)) for rid, model, t, p in con.execute(q, args)]


rows = usage_rows(db(REPO / "data/nimbus.db"))
assert all(m == "mock" for _, m, _, _ in rows), "a non-mock run is in the dev database"
calls = [
    {"min": round(((t + ICT_MS) % 86_400_000) / 60_000, 2), "tier": u["tier"], "usd": round(cost(u), 7)}
    for _, _, t, u in rows
]
out = ROOT / "src/datasets"
out.mkdir(exist_ok=True)
(out / "mock-calls.json").write_text(json.dumps({"source": "data/nimbus.db usage events (mock runs)", "runs": len({r for r, *_ in rows}), "calls": calls}) + "\n")

hops = usage_rows(db(REPO / "data/video-rev5/nimbus.db"), "and r.id = ?", (TAKE_RUN,))
run_hops = [{"tier": u["tier"], "usd": round(cost(u), 7)} for *_, u in hops]
(out / "run-hops.json").write_text(json.dumps({"source": f"data/video-rev5/nimbus.db {TAKE_RUN}", "total": round(sum(h["usd"] for h in run_hops), 7), "hops": run_hops}, indent=1) + "\n")
print(f"mock-calls.json: {len(calls)} calls from {len({r for r, *_ in rows})} runs · run-hops.json: {len(run_hops)} hops, ${sum(h['usd'] for h in run_hops):.5f}")
