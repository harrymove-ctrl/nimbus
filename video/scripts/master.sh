#!/usr/bin/env bash
# Levels a rendered cut's audio to the delivery target (references/sound.md): −14 LUFS
# integrated, true peak ≤ −1 dBTP. Two-pass loudnorm (linear when it can be), then a
# true-peak limiter (ceiling ≈ −2 dBFS, so the 720p AAC re-encode still lands ≤ −1 dBTP);
# the picture is copied untouched.
#   bash scripts/master.sh out/nimbus-full.mp4 out/nimbus-full-master.mp4
set -euo pipefail
in=$1
out=$2
m=$(ffmpeg -hide_banner -i "$in" -vn -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$m" | sed -n "s/.*\"$1\" : \"\(.*\)\".*/\1/p"; }
ffmpeg -v error -y -i "$in" -c:v copy \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,alimiter=limit=0.79:attack=1:release=50:level=false,aresample=48000" \
  -c:a aac -b:a 256k -movflags +faststart "$out"
ffmpeg -hide_banner -i "$out" -vn -af loudnorm=print_format=summary -f null - 2>&1 | grep -E "Input Integrated|Input True Peak"
