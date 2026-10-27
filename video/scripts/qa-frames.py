#!/usr/bin/env python3
"""Frame QA for build-qa.md: frame density and palette.

  python3 scripts/qa-frames.py out/nimbus-full.mp4 --cards 6-10,158-174

- Density: a frame every 2 s, split 3 × 3; a cell is empty when its luminance barely varies.
  A frame with more than 3 empty cells is "more than a third empty". Title and end-card spans
  (--cards, seconds) are excepted, as the board allows.
- Palette: 10 frames spread over the cut; the saturated pixels' hues, binned, against the hues
  of the colours in src/theme.ts (the app's own). Prints any bin with ≥ 2 % of the saturated
  pixels that is more than 20° from every theme hue.
"""
import colorsys, math, re, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
from PIL import Image

video = sys.argv[1]
cards = []
if "--cards" in sys.argv:
    for span in sys.argv[sys.argv.index("--cards") + 1].split(","):
        a, b = span.split("-")
        cards.append((float(a), float(b)))

dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video]))
tmp = Path(tempfile.mkdtemp())

def grab(t, name, w=640):
    out = tmp / name
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1", "-vf", f"scale={w}:-1", str(out)], check=True)
    return Image.open(out).convert("RGB")

# ── density ──
flagged = []
t = 1.0
while t < dur:
    if not any(a <= t <= b for a, b in cards):
        lum = np.asarray(grab(t, "d.png").convert("L"), dtype=np.float32)
        h, w = lum.shape
        empty = 0
        for i in range(3):
            for j in range(3):
                cell = lum[i * h // 3 : (i + 1) * h // 3, j * w // 3 : (j + 1) * w // 3]
                if cell.std() < 6:
                    empty += 1
        if empty > 3:
            flagged.append((round(t, 1), empty))
    t += 2.0
print(f"density: {int(dur // 2)} frames sampled; more than a third empty: {flagged or 'none'}")

# ── palette ──
def oklch_to_rgb(l, c, h):
    a, b = c * math.cos(math.radians(h)), c * math.sin(math.radians(h))
    l_ = l + 0.3963377774 * a + 0.2158037573 * b
    m_ = l - 0.1055613458 * a - 0.0638541728 * b
    s_ = l - 0.0894841775 * a - 1.2914855480 * b
    L, M, S = l_ ** 3, m_ ** 3, s_ ** 3
    rgb = (4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
           -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
           -0.0041960863 * L - 0.7034186147 * M + 1.7076127010 * S)
    f = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return tuple(min(1, max(0, f(v))) for v in rgb)

theme = (Path(__file__).parent.parent / "src/theme.ts").read_text()
hues = []
for m in re.finditer(r'oklch\(([\d.]+)(%?) ([\d.]+) ([\d.]+)', theme):
    l = float(m.group(1)) / (100 if m.group(2) else 1)
    c, h = float(m.group(3)), float(m.group(4))
    if c > 0.03:
        r, g, b = oklch_to_rgb(l, c, h)
        hues.append(colorsys.rgb_to_hsv(r, g, b)[0] * 360)
for m in re.finditer(r'#([0-9a-fA-F]{6})', theme):
    r, g, b = (int(m.group(1)[i : i + 2], 16) / 255 for i in (0, 2, 4))
    hues.append(colorsys.rgb_to_hsv(r, g, b)[0] * 360)
hues = sorted(set(round(h) for h in hues))

bins = np.zeros(36)
for k in range(10):
    img = np.asarray(grab(dur * (k + 0.5) / 10, "p.png", 480), dtype=np.float32) / 255
    mx, mn = img.max(axis=2), img.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    mask = (sat > 0.35) & (mx > 0.25)
    for px in img[mask][::7]:
        bins[int(colorsys.rgb_to_hsv(*px)[0] * 360) // 10 % 36] += 1
total = bins.sum() or 1
dist = lambda a, b: min(abs(a - b), 360 - abs(a - b))
foreign = [(i * 10 + 5, round(100 * n / total, 1)) for i, n in enumerate(bins) if n / total >= 0.02 and min(dist(i * 10 + 5, h) for h in hues) > 20]
top = sorted(((round(100 * n / total, 1), i * 10 + 5) for i, n in enumerate(bins)), reverse=True)[:6]
print(f"palette: theme hues {hues}; top saturated hue bins (% , hue°) {top}; foreign bins ≥ 2 %: {foreign or 'none'}")
