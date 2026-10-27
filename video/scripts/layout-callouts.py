#!/usr/bin/env python3
"""Places every callout card where it covers no UI text (Gate 3: no card over app text).

  python3 scripts/layout-callouts.py           # both cuts → src/callout-layout.json

For each callout (scripts/callout-index.mjs), renders three frames of its span with only its
ring drawn in pure green (input props calloutMode=rings, only=<key>), finds the ring, and
scores every card position on a 16 px grid by the text cells under it, worst
of the three frames, and keeps the nearest one that covers no text cell (else the fewest).
A text cell is an 8 px cell with both horizontal and vertical edges in it: glyphs, icons and
charts are; panel borders and the dotted background are not (a 1 % edge-ink rule let short
words through, because text is sparse). Positions overlapping the ring, the chapter eyebrow,
or a card already placed for an overlapping callout are out. Prints each choice with its
text-cell count so a non-zero one can be looked at.
"""
import json, os, subprocess, sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
W, H = 1920, 1080
CARD_W = 600
MARGIN, SAFE, GAP = 48, 24, 24
CELL, EDGE = 8, 20
EYEBROW = (20, 20, 580, 130)  # x0, y0, x1, y1 (Callout.tsx EYEBROW_BOX + its halo)
COMP = {"full": "NimbusFull", "x": "NimbusX"}


def card_h(why):
    return 36 + 41 + 6 + 35 * max(1, -(-len(why) // 36))


def render_all(comp, jobs):
    """jobs: [(key, frames, outdir)] → rendered with one bundle (stills.mjs JOBS mode)."""
    spec = [{"props": {"calloutMode": "rings", "only": k}, "frames": fr, "out": str(o)} for k, fr, o in jobs]
    jf = ROOT / "out/layout" / f"{comp}-jobs.json"
    jf.write_text(json.dumps(spec))
    env = dict(os.environ, COMP=comp, JOBS=str(jf))
    subprocess.run(["node", "scripts/stills.mjs"], cwd=ROOT, env=env, check=True, capture_output=True)


def load(comp, frames, out):
    return [Image.open(out / f"{comp}-{f:05d}.png").convert("RGB") for f in frames]


def ring_box(img):
    a = np.asarray(img).astype(int)
    g = (a[:, :, 1] > 220) & (a[:, :, 0] < 60) & (a[:, :, 2] < 60)
    ys, xs = np.nonzero(g)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max(), ys.max()


def text_map(img):
    """Integral image of the text cells (CELL px cells with ≥ 2 edge pixels each way)."""
    a = np.asarray(img.convert("L")).astype(np.float32)
    gx = np.abs(np.diff(a, axis=1, prepend=a[:, :1])) > EDGE
    gy = np.abs(np.diff(a, axis=0, prepend=a[:1, :])) > EDGE
    cells = lambda e: e.reshape(H // CELL, CELL, W // CELL, CELL).sum((1, 3))
    text = ((cells(gx) >= 2) & (cells(gy) >= 2)).astype(np.int32)
    return text.cumsum(0).cumsum(1)


def text_under(ii, r):
    """Text cells under rect r, padded by one cell so a glyph at the card's edge counts."""
    x0, y0 = max(0, r[0] // CELL - 1), max(0, r[1] // CELL - 1)
    x1, y1 = min(W // CELL, -(-r[2] // CELL) + 1), min(H // CELL, -(-r[3] // CELL) + 1)
    return int(rect_sum(ii, x0, y0, x1, y1))


def rect_sum(ii, x0, y0, x1, y1):
    x1, y1 = x1 - 1, y1 - 1
    s = ii[y1, x1]
    if x0 > 0:
        s -= ii[y1, x0 - 1]
    if y0 > 0:
        s -= ii[y0 - 1, x1]
    if x0 > 0 and y0 > 0:
        s += ii[y0 - 1, x0 - 1]
    return s


def overlaps(a, b, pad=0):
    return not (a[2] + pad <= b[0] or b[2] + pad <= a[0] or a[3] + pad <= b[1] or b[3] + pad <= a[1])


def place(cut):
    index = json.loads(subprocess.check_output(["node", "scripts/callout-index.mjs", cut], cwd=ROOT))
    out = ROOT / "out/layout" / cut
    out.mkdir(parents=True, exist_ok=True)
    placed, result = [], {}
    frames_of = lambda c: [c["from"] + 12, (c["from"] + c["to"]) // 2, c["to"] - 20]
    dir_of = lambda c: out / c["key"].replace(":", "_")
    render_all(COMP[cut], [(c["key"], frames_of(c), dir_of(c)) for c in index])
    for c in index:
        f0, f1 = c["from"], c["to"]
        frames = frames_of(c)
        imgs = load(COMP[cut], frames, dir_of(c))
        rings = [r for r in map(ring_box, imgs) if r]
        if not rings:
            print(f"{c['key']}: no ring found, left to its fallback side")
            continue
        ring = (min(r[0] for r in rings), min(r[1] for r in rings), max(r[2] for r in rings), max(r[3] for r in rings))
        iis = [text_map(i) for i in imgs]
        h = card_h(c["why"])
        rcx, rcy = (ring[0] + ring[2]) / 2, (ring[1] + ring[3]) / 2
        busy = [p for p in placed if p[0] < f1 and f0 < p[1]]  # cards on screen at the same time
        best = None
        for y in range(MARGIN, H - MARGIN - h + 1, 16):
            for x in range(MARGIN, W - MARGIN - CARD_W + 1, 16):
                r = (x, y, x + CARD_W, y + h)
                if overlaps(r, ring, GAP) or overlaps(r, EYEBROW, 8) or any(overlaps(r, p[2], GAP) for p in busy):
                    continue
                text = max(text_under(ii, r) for ii in iis)
                d = ((x + CARD_W / 2 - rcx) ** 2 + (y + h / 2 - rcy) ** 2) ** 0.5
                # the nearest spot over no text; if there is none, the fewest text cells
                score = (text, d)
                if best is None or score < best[0]:
                    best = (score, x, y, text, d)
        if best is None:
            print(f"{c['key']}: no free spot")
            continue
        _, x, y, text, d = best
        result[c["key"]] = {"x": x, "y": y}
        placed.append((f0, f1, (x, y, x + CARD_W, y + h)))
        print(f"{c['key']:34s} frames {f0}-{f1}  card ({x},{y})  text cells {text}  from ring {d:.0f}px")
    return result


layout = {}
for cut in sys.argv[1:] or ["full", "x"]:
    layout.update(place(cut))
(ROOT / "src/callout-layout.json").write_text(json.dumps(layout, indent=1, sort_keys=True) + "\n")
print(f"src/callout-layout.json: {len(layout)} spots")
