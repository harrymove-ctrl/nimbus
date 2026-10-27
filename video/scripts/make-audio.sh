#!/usr/bin/env bash
# Generates the click track and every sound in docs/video/sfx.md with ffmpeg alone, so each
# file is original (source: "generated", no license question). Deterministic: fixed noise
# seeds. Every SFX is peak-normalised to -1 dBFS; the cue level becomes a gain in
# src/audio.ts. Swap any file for a better sound later under the same name.
#   bash scripts/make-audio.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/audio
SFX=$OUT/sfx
TMP=$(mktemp -d "${TMPDIR:-/tmp}/nimbus-audio.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$SFX"
SR=48000

# Peak-normalise $TMP/raw.wav to -1 dBFS into $1.
norm() {
  local peak
  peak=$(ffmpeg -v info -i "$TMP/raw.wav" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB/\1/p')
  ffmpeg -v error -y -i "$TMP/raw.wav" -af "volume=$(awk -v p="$peak" 'BEGIN{print -1-p}')dB" -ar $SR -ac 1 -c:a pcm_s16le "$1"
}

# gen <name> <lavfi source> [filters]
gen() {
  ffmpeg -v error -y -f lavfi -i "$2" ${3:+-af "$3"} -ar $SR -ac 1 "$TMP/raw.wav"
  norm "$SFX/$1.wav"
}

# A band of noise whose centre glides from f0 to f1 over d seconds (whooshes, risers).
sweep() { # f0 f1 d width
  local fc="($1*pow($2/$1,pts/$3))"
  local g="exp(-pow(b*sr/(2*nb)-$fc,2)/(2*pow($4*$fc,2)))"
  echo "afftfilt=win_size=1024:real='re*$g':imag='im*$g'"
}
noise() { echo "anoisesrc=d=$1:c=${2:-pink}:r=$SR:a=0.8:seed=${3:-1}"; }
# A sine whose pitch falls from f0 to f1 with rate k, amplitude decaying at rate a.
drop() { echo "aevalsrc='sin(2*PI*($2*t+($1-$2)*(1-exp(-$3*t))/$3))*exp(-$4*t)':d=$5:s=$SR"; }
tone() { echo "aevalsrc='sin(2*PI*$1*t)*exp(-$2*t)':d=$3:s=$SR"; }

# ── Click track: 120 BPM, accent on beat 1, 140 s (68 bars + tail) ────────────────────────
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.5*sin(2*PI*if(eq(mod(floor(t*2),4),0),1600,1000)*t)*exp(-mod(t,0.5)*90)*if(eq(mod(floor(t*2),4),0),1,0.6)':d=140:s=22050" -ac 1 -c:a pcm_s16le "$OUT/click-120.wav"

# ── Typing, ticks, clicks ─────────────────────────────────────────────────────────────────
gen type-soft "$(noise 0.03 white 2)" "highpass=f=2500,afade=t=out:st=0.002:d=0.026"
gen keys-hard "$(noise 0.05 white 3)" "bandpass=f=3800:w=2500,afade=t=out:st=0.003:d=0.045"
gen roll-tick "$(tone 1760 70 0.08)"
gen tick "$(tone 2200 90 0.06)"
gen tick-tiny "$(tone 3000 160 0.03)"
gen click "aevalsrc='(sin(2*PI*1500*t)+0.6*(random(4)*2-1))*exp(-260*t)':d=0.04:s=$SR"
gen click-press "aevalsrc='(sin(2*PI*1800*t)+0.5*(random(5)*2-1))*exp(-220*t)+0.35*sin(2*PI*880*t)*exp(-9*t)*(1-exp(-120*t))':d=0.35:s=$SR"
gen shutter "aevalsrc='(random(6)*2-1)*(exp(-300*t)+0.7*exp(-300*abs(t-0.035))*gt(t,0.035))':d=0.09:s=$SR" "highpass=f=1800"
gen thud "aevalsrc='sin(2*PI*(55*t+60*(1-exp(-30*t))/30))*exp(-14*t)+0.3*(random(7)*2-1)*exp(-200*t)':d=0.3:s=$SR" "lowpass=f=900"

# ── Pops ──────────────────────────────────────────────────────────────────────────────────
gen pop-1 "$(drop 1100 420 45 28 0.12)"
gen pop-2 "$(drop 950 360 45 28 0.12)"
gen pop-3 "$(drop 1250 480 50 30 0.12)"
gen pop-4 "$(drop 820 330 40 26 0.13)"
gen pop-5 "$(drop 1400 560 55 32 0.11)"
gen pop-bright "$(drop 1900 900 40 22 0.16)"

# ── Whooshes: each a different band so no two in a row share a pitch ─────────────────────
gen swoosh-up "$(noise 0.5 pink 11)" "$(sweep 500 5000 0.5 0.35),afade=t=in:d=0.18:curve=exp,afade=t=out:st=0.2:d=0.3"
gen send "$(noise 0.28 pink 12)" "$(sweep 700 4500 0.28 0.35),afade=t=in:d=0.08,afade=t=out:st=0.1:d=0.18"
gen whoosh-rev-a "$(noise 0.45 pink 13)" "$(sweep 3500 400 0.45 0.4),afade=t=out:st=0.05:d=0.4:curve=exp,areverse"
gen whoosh-in "$(noise 0.55 pink 14)" "$(sweep 4000 250 0.55 0.4),afade=t=in:d=0.5:curve=exp,afade=t=out:st=0.5:d=0.05"
gen whoosh-b "$(noise 0.4 pink 15)" "$(sweep 600 2400 0.4 0.4),afade=t=in:d=0.26:curve=exp,afade=t=out:st=0.27:d=0.13"
gen whoosh-c "$(noise 0.4 brown 16)" "$(sweep 250 1100 0.4 0.45),afade=t=in:d=0.26:curve=exp,afade=t=out:st=0.27:d=0.13"
gen whoosh-d "$(noise 0.4 pink 17)" "$(sweep 900 3200 0.4 0.35),afade=t=in:d=0.26:curve=exp,afade=t=out:st=0.27:d=0.13"
gen whoosh-e "$(noise 0.4 pink 18)" "$(sweep 1800 700 0.4 0.4),afade=t=in:d=0.26:curve=exp,afade=t=out:st=0.27:d=0.13"
gen whoosh-f "$(noise 0.4 pink 19)" "$(sweep 450 1700 0.4 0.4),afade=t=in:d=0.26:curve=exp,afade=t=out:st=0.27:d=0.13"
gen whoosh-pan "$(noise 0.32 white 20)" "$(sweep 1200 6000 0.32 0.3),afade=t=in:d=0.24:curve=exp,afade=t=out:st=0.24:d=0.08"
gen drag "$(noise 0.4 pink 21)" "lowpass=f=1300,afade=t=in:d=0.15,afade=t=out:st=0.2:d=0.2"
gen page "$(noise 0.3 pink 22)" "$(sweep 1000 4200 0.3 0.3),tremolo=f=28:d=0.6,afade=t=out:st=0.12:d=0.18"
gen sweep "aevalsrc='sin(2*PI*(400*t+1200*t*t/1.0))*sin(PI*t/0.5)':d=0.5:s=$SR"
# pop + short whoosh, the message-pop transition
gen pop-whoosh "aevalsrc='sin(2*PI*(500*t+700*(1-exp(-45*(t-0.18)))/45*gt(t,0.18)))*exp(-28*max(t-0.18,0))*gt(t,0.18)':d=0.32:s=$SR"
cp "$SFX/pop-whoosh.wav" "$TMP/pop.wav"
ffmpeg -v error -y -f lavfi -i "$(noise 0.32 pink 23)" -af "$(sweep 500 3000 0.32 0.4),afade=t=in:d=0.18:curve=exp,afade=t=out:st=0.18:d=0.14" -ar $SR -ac 1 "$TMP/wh.wav"
ffmpeg -v error -y -i "$TMP/wh.wav" -i "$TMP/pop.wav" -filter_complex "amix=inputs=2:normalize=0" -ar $SR -ac 1 "$TMP/raw.wav"
norm "$SFX/pop-whoosh.wav"

# ── Risers and impacts ────────────────────────────────────────────────────────────────────
for bars in 1 2; do
  d=$((bars * 2))
  ffmpeg -v error -y -f lavfi -i "$(noise $d pink $((30 + bars)))" -af "$(sweep 200 6000 $d 0.3),afade=t=in:d=$d:curve=exp" -ar $SR -ac 1 "$TMP/n.wav"
  ffmpeg -v error -y -f lavfi -i "aevalsrc='0.35*sin(2*PI*(110*t+(440-110)*t*t/(2*$d)))*pow(t/$d,2)':d=$d:s=$SR" -ar $SR -ac 1 "$TMP/s.wav"
  ffmpeg -v error -y -i "$TMP/n.wav" -i "$TMP/s.wav" -filter_complex "amix=inputs=2:normalize=0" -ar $SR -ac 1 "$TMP/raw.wav"
  norm "$SFX/riser-${bars}bar.wav"
done
gen impact-soft "aevalsrc='sin(2*PI*(55*t+65*(1-exp(-18*t))/18))*exp(-5*t)+0.4*(random(40)*2-1)*exp(-60*t)':d=0.9:s=$SR" "lowpass=f=2500"
gen impact-deep "aevalsrc='sin(2*PI*(42*t+70*(1-exp(-12*t))/12))*exp(-2.6*t)+0.5*(random(41)*2-1)*exp(-40*t)':d=2.2:s=$SR" "lowpass=f=1800,aecho=0.8:0.6:60|130:0.35|0.2"
gen sub-hit "$(drop 95 45 20 6 0.6)"
gen rumble "$(noise 2 brown 42)" "lowpass=f=140,afade=t=in:d=1.6:curve=exp,afade=t=out:st=1.75:d=0.25"

# ── Glass, chimes, shimmer ────────────────────────────────────────────────────────────────
gen glass-1 "aevalsrc='(sin(2*PI*2093*t)+0.6*sin(2*PI*3322*t)+0.35*sin(2*PI*5120*t))*exp(-5*t)':d=0.9:s=$SR"
gen glass-2 "aevalsrc='(sin(2*PI*2349*t)+0.6*sin(2*PI*3729*t)+0.35*sin(2*PI*5747*t))*exp(-5*t)':d=0.9:s=$SR"
gen glass-3 "aevalsrc='(sin(2*PI*2637*t)+0.6*sin(2*PI*4186*t)+0.35*sin(2*PI*6451*t))*exp(-5*t)':d=0.9:s=$SR"
gen chime-ok "aevalsrc='sin(2*PI*1319*t)*exp(-4*t)+0.8*sin(2*PI*1976*(t-0.08))*exp(-4*(t-0.08))*gt(t,0.08)':d=1:s=$SR"
gen shimmer "aevalsrc='(sin(2*PI*3136*t)+sin(2*PI*4186*t)+0.7*sin(2*PI*5274*t))*sin(PI*t/0.8)*(0.6+0.4*sin(2*PI*14*t))':d=0.8:s=$SR"
gen alert-soft "aevalsrc='(sin(2*PI*220*t)+0.6*sin(2*PI*330*t)+0.3*sin(2*PI*660*t))*(1-exp(-12*t))*exp(-2.5*t)':d=0.8:s=$SR"
gen dots "aevalsrc='sin(2*PI*1200*t)*(exp(-60*t)+exp(-60*abs(t-0.15))*gt(t,0.15)+exp(-60*abs(t-0.3))*gt(t,0.3))*0.8':d=0.6:s=$SR"

# ── Markers, pens, glitches ───────────────────────────────────────────────────────────────
gen marker "$(noise 0.28 white 50)" "bandpass=f=2600:w=900,tremolo=f=40:d=0.7,afade=t=in:d=0.03,afade=t=out:st=0.18:d=0.1"
gen pen "$(noise 0.35 white 51)" "bandpass=f=3200:w=1800,tremolo=f=18:d=0.4,afade=t=in:d=0.05,afade=t=out:st=0.22:d=0.13"
gen strike "$(noise 0.2 white 52)" "bandpass=f=2800:w=2400,tremolo=f=60:d=0.8,afade=t=out:st=0.1:d=0.1"
gen glitch "aevalsrc='((2*gt(sin(2*PI*180*t),0)-1)*0.6+(random(53)*2-1)*0.5)*gt(sin(2*PI*28*t),-0.2)':d=0.2:s=$SR" "acrusher=bits=5:mode=log:aa=0,afade=t=out:st=0.15:d=0.05"

ls "$SFX" | wc -l | xargs echo "sfx files:"
