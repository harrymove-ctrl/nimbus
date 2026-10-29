#!/usr/bin/env python3
"""Fits the Suno track to both cuts (music.md rev D map), from the untouched source:

  python3 scripts/fit-music.py   # public/audio/music-full.mp3 → music-full-fit.mp3, music-x.mp3

The track is a steady 122.09 BPM (measured: a comb over the onset envelope, 30 s windows
agree within 0.1 BPM), so it is first time-stretched to 120 BPM (atempo, pitch kept). On that
grid its bar lines fall at 0.094 + 2·S s, in 16-bar phrases: entries at bars S8, S32, S48,
S72, S80 and S96 after one- to three-bar dips, a breakdown S61–S71, and its own ending at S104
(208.094 s). Each cut is a few segments of the stretched track, each placed so a bar line of
the track is a bar line of the video ("video bar V ↔ track bar S = V + Δ"), joined by
8-frame equal-power crossfades that end on a bar line; one beat of silence before the end
card. Both outputs are gitignored (the user's own generation).
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/audio/music-full.mp3"
BPM_SRC = 122.09
STRETCH = 120 / BPM_SRC
BAR0 = 0.094  # the stretched track's first bar line
XF = 8 / 30  # crossfade, seconds

def bar(s):
    """The stretched track's bar line S, in seconds."""
    return BAR0 + 2 * s

# (video seconds the segment runs to, Δ in bars: video bar V plays track bar V + Δ)
FULL = {
    "seconds": 162,  # 80 bars (script rev 7) + the 1-bar tail
    "segments": [
        (32, 2),  # V0–16: the intro under the hook and name; the S8 entry on V6 (0:12, into the Overview)
        (58, 13),  # V16–29: the S29–31 dip under the goal, the S32 entry on V19 (0:38, the timeline)
        (134, 10),  # V29–67: S45–47 dip under the Ch 2 card, the S48 entry on V38 (1:16, frame 2280, the first Approve); the breakdown under Calm; S72 on V62 (2:04, Ch 4) through the phone stack
        (162, 24),  # V67–81, from the web run's hard cut: S93–95 dip under the proof, the S96 finale on V72 (2:24, the terminal), the track's own ending on V80 (2:40)
    ],
    "silence": (149.5, 150.0),  # V74.75–75: one beat before the end card
}
X = {
    "seconds": 46,  # 22 bars + the tail
    "segments": [
        (17, 4),  # V0–8.5: the intro; the S8 entry on V4 (0:08, into the plan)
        (38, 36.5),  # V8.5–19: S45–47 dip under the lanes and the Ch 2 card, the S48 entry on V11.5 (0:23, frame 690, the Approve)
        (46, 82),  # V19–23: the last bars of the finale and the track's ending on V22 (0:44)
    ],
    "silence": (37.5, 38.0),  # V18.75–19
}

def build(spec, out):
    parts, labels, prev = [], [], 0.0
    for i, (to, delta) in enumerate(spec["segments"]):
        start = 0.0 if i == 0 else prev - XF
        off = bar(delta)  # track second at video 0 for this segment
        parts.append(f"[s{i}]atrim=start={off + start:.4f}:end={off + to:.4f},asetpts=PTS-STARTPTS[p{i}]")
        labels.append(f"p{i}")
        prev = to
    n = len(labels)
    chain, cur = [], labels[0]
    for i in range(1, n):
        nxt = f"x{i}"
        chain.append(f"[{cur}][{labels[i]}]acrossfade=d={XF:.4f}:c1=qsin:c2=qsin[{nxt}]")
        cur = nxt
    a, b = spec["silence"]
    mid, half, ramp = (a + b) / 2, (b - a) / 2, 0.02
    gate = f"volume='clip((abs(t-{mid})-{half}+{ramp})/{ramp},0,1)':eval=frame"
    total = spec["seconds"]
    graph = ";".join(
        [f"[0]atempo={STRETCH:.6f},aresample=48000,asplit={n}" + "".join(f"[s{i}]" for i in range(n))]
        + parts
        + chain
        + [f"[{cur}]{gate},atrim=end={total},afade=t=out:st={total - 1.5}:d=1.5[out]"]
    )
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SRC), "-filter_complex", graph, "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "320k", str(out)], check=True)
    print(f"{out.relative_to(ROOT)}: {total} s, segments {spec['segments']}")

build(FULL, ROOT / "public/audio/music-full-fit.mp3")
build(X, ROOT / "public/audio/music-x.mp3")
