#!/usr/bin/env python3
"""Exports the model calls behind the motion scenes (script rev 6, "Footage and numbers" 3).

  python3 scripts/export-calls.py      # → src/datasets/calls.json, src/datasets/run-hops.json

- calls.json (Scatter Bloom, scene 19): one point per `usage` event in the dev database
  (data/nimbus.db): minute of the day it ran (ICT), its tier, and its cost from the token counts
  at src/lib/models.ts PRICE_PER_M. `models` lists the run models found, so a fixture-only
  export is visible in the file (the preview watermark covers it on screen). Re-run after the
  real-model run.
- run-hops.json (Metric Morph, scene 10): the hops of the take's first Morning brief run
  (TAKE_DB / TAKE_RUN: the run on screen), in order, with their cost.

Both databases are opened read-only; nothing is invented, sampled or smoothed.
"""
import json, sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT.parent
# USD per 1M tokens [in, out], src/lib/models.ts PRICE_PER_M
PRICE = {"ultra": (1, 3), "super": (0.3, 0.9), "nano": (0.06, 0.24)}
ICT_MS = 7 * 3600 * 1000
# the take's first Morning brief run; set both to the real-model take's when it lands
TAKE_DB = "data/video-rev6/nimbus.db"
TAKE_RUN = "run_0ccb7cb0"


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
models = sorted({m for _, m, _, _ in rows})
calls = [
    {"min": round(((t + ICT_MS) % 86_400_000) / 60_000, 2), "tier": u["tier"], "usd": round(cost(u), 7)}
    for _, _, t, u in rows
]
out = ROOT / "src/datasets"
out.mkdir(exist_ok=True)
(out / "calls.json").write_text(json.dumps({"source": "data/nimbus.db usage events", "models": models, "runs": len({r for r, *_ in rows}), "calls": calls}) + "\n")

hops = usage_rows(db(REPO / TAKE_DB), "and r.id = ?", (TAKE_RUN,))
run_hops = [{"tier": u["tier"], "usd": round(cost(u), 7)} for *_, u in hops]
(out / "run-hops.json").write_text(json.dumps({"source": f"{TAKE_DB} {TAKE_RUN}", "total": round(sum(h["usd"] for h in run_hops), 7), "hops": run_hops}, indent=1) + "\n")
print(f"calls.json: {len(calls)} calls ({', '.join(models)}) from {len({r for r, *_ in rows})} runs · run-hops.json: {len(run_hops)} hops, ${sum(h['usd'] for h in run_hops):.5f}")
