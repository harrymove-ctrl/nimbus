#!/usr/bin/env bash
# The measurable QA checks of build-qa.md on a rendered cut: duration, frozen and black spots,
# loudness and true peak. The rest (frame 1, phone readability, honest numbers) are looked at.
#   bash scripts/qa.sh out/nimbus-full.mp4
set -euo pipefail
f=$1
echo "== $f"
ffprobe -v error -show_entries format=duration,size:stream=codec_type,width,height,r_frame_rate -of compact "$f"
echo "-- freeze (n=0.003, ≥1.5 s) and black (≥0.3 s)"
ffmpeg -v info -i "$f" -vf "freezedetect=n=0.003:d=1.5,blackdetect=d=0.3" -an -f null - 2>&1 |
  grep -oE "(freeze_start|freeze_end|black_start|black_end)[:=] ?[0-9.]+" | paste - - || echo "none"
echo "-- loudness (target −14 ± 1 LUFS integrated, true peak ≤ −1 dBTP)"
ffmpeg -v info -i "$f" -vn -af loudnorm=print_format=summary -f null - 2>&1 |
  grep -E "Input Integrated|Input True Peak|Input LRA"
