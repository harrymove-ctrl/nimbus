import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CursorTrack, type CursorWaypoint } from "@/components/snap-cn/cursor-track";
import {
  type CameraMove,
  cameraPoseAt,
  clampFocus,
  ScreenRecording,
} from "@/components/snap-cn/screen-recording";
import { fit, SHOTS, type ShotName, TAKE_FILES, TAKE_H, TAKE_W, target } from "./beats";
import { Callout, type CalloutSpec, calloutLevel, Dim, type ScreenBox } from "./components/Callout";
import { C, SORBET } from "./theme";

/** A camera move whose focal point is in take coordinates (0–1 across the app's window). */
export type SourceMove = { at: number; duration?: number; zoom?: number; u?: number; v?: number };
/** A click to mark: a mint ring at a point of the app, in take coordinates. */
export type Ring = { at: number; u: number; v: number };

// A slow push under every keyframed move, so no hold between moves reads as a freeze.
const CREEP = 1.06;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const inOut = Easing.inOut(Easing.cubic);

/** Board rev E "Look" 5: the tilted camera. Perspective 1200 px, pitch 0.3 × yaw, the far
 *  (right) edge 1.5 px soft; a 1.08 scale keeps the near corners in frame. */
const PERSPECTIVE = 1200;
const TILT_SCALE = 0.08;
const SOFT_EDGE = 1.5;

/** How tilted the footage is at `frame` (0 flat – 1 full): it relaxes to flat over a bar as a
 *  callout opens (starting 20 frames early, so the ring draws on a near-square target) and
 *  comes back over a bar after it closes. */
export function tiltLevel(frame: number, callouts: { from: number; to: number }[]) {
  let flat = 0;
  for (const c of callouts) {
    const on = interpolate(frame, [c.from - 20, c.from + 40], [0, 1], { ...clamp, easing: inOut });
    const off = interpolate(frame, [c.to, c.to + 60], [1, 0], { ...clamp, easing: inOut });
    flat = Math.max(flat, Math.min(on, off));
  }
  return 1 - flat;
}

/** The tilt's pose at `frame`: yaw drifts a degree across the shot. */
function tiltPose(frame: number, frames: number, yaw: number, level: number) {
  const y = (yaw + interpolate(frame, [0, frames], [-0.5, 0.5], clamp) * Math.sign(yaw)) * level;
  return { yaw: y, pitch: 0.3 * y, scale: 1 + TILT_SCALE * level * Math.min(1, Math.abs(yaw) / 8) };
}

/** A frame point through the tilt (CSS: perspective on the parent, scale · rotateX · rotateY). */
function tiltPoint(x: number, y: number, pose: { yaw: number; pitch: number; scale: number }, w: number, h: number) {
  const a = (pose.yaw * Math.PI) / 180;
  const p = (pose.pitch * Math.PI) / 180;
  const X = x - w / 2;
  const Y = y - h / 2;
  const x1 = X * Math.cos(a);
  const z1 = -X * Math.sin(a);
  const y2 = Y * Math.cos(p) - z1 * Math.sin(p);
  const z2 = Y * Math.sin(p) + z1 * Math.cos(p);
  const k = PERSPECTIVE / (PERSPECTIVE - z2);
  return { x: w / 2 + pose.scale * x1 * k, y: h / 2 + pose.scale * y2 * k };
}

/** The Approve tick (board rev E: button-press's drawn tick, over the real button). */
function Tick({ at, x, y }: { at: number; x: number; y: number }) {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + 50) return null;
  const pop = interpolate(frame, [at, at + 6], [0.6, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const draw = interpolate(frame, [at + 3, at + 13], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const fade = interpolate(frame, [at + 38, at + 50], [1, 0], clamp);
  const r = 26;
  return (
    <svg width={r * 2} height={r * 2} viewBox="0 0 24 24" style={{ position: "absolute", left: x - r, top: y - r, transform: `scale(${pop})`, opacity: fade }}>
      {/* dark disc, mint check: it sits on the app's mint Approve button, so it reads by contrast */}
      <circle cx={12} cy={12} r={10.5} fill={C.mintInk} stroke={C.mint} strokeWidth={1.4} />
      <path d="M7 12.5 L10.5 16 L17 9" fill="none" stroke={C.mint} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
    </svg>
  );
}

/**
 * One footage shot: its cut fitted to `frames`, a camera that always moves, click rings and
 * explainer callouts. Callout boxes come from the take's beats.json and go through the same
 * camera (and creep) as the footage, so a ring stays on its target through a push-in. The
 * take draws its own cursor, so cursor-track runs ring-only.
 */
export function Footage({
  shot,
  frames,
  camera,
  rings = [],
  ticks = [],
  callouts = [],
  tilt = 0,
}: {
  shot: ShotName;
  frames: number;
  camera: SourceMove[];
  rings?: Ring[];
  /** Approve clicks to mark with the drawn tick (frames and take coordinates, like rings). */
  ticks?: Ring[];
  callouts?: CalloutSpec[];
  /** Yaw of the tilted camera in degrees (board rev E: 8–14); 0 is flat. */
  tilt?: number;
}) {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const cut = fit(SHOTS[shot], frames / fps);
  const creep = interpolate(frame, [0, frames], [1, CREEP], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const moves: CameraMove[] = camera.map((m) => ({
    at: m.at,
    duration: m.duration ?? 40,
    zoom: m.zoom,
    x: m.u,
    y: m.v,
  }));

  const level = tilt === 0 ? 0 : tiltLevel(frame, callouts);
  const pose = tiltPose(frame, frames, tilt, level);

  // take px → frame px at `f`, through the camera and the creep (both centred on the frame),
  // then the tilt (the box of the four projected corners)
  const project = (b: { x: number; y: number; w: number; h: number }, f: number): ScreenBox => {
    const cam = cameraPoseAt(f, moves);
    const fx = clampFocus(cam.x, cam.zoom);
    const fy = clampFocus(cam.y, cam.zoom);
    const k = cam.zoom * creep;
    const sx = ((b.x / TAKE_W - fx) * k + 0.5) * width;
    const sy = ((b.y / TAKE_H - fy) * k + 0.5) * height;
    const sw = (b.w / TAKE_W) * k * width;
    const sh = (b.h / TAKE_H) * k * height;
    if (level === 0) return { x: sx, y: sy, w: sw, h: sh };
    const pts = [
      [sx, sy],
      [sx + sw, sy],
      [sx, sy + sh],
      [sx + sw, sy + sh],
    ].map(([x, y]) => tiltPoint(x, y, pose, width, height));
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  // a take point (0–1) in the creep container's frame px at `f` (before the creep and tilt)
  const point = (r: Ring) => {
    const cam = cameraPoseAt(r.at, moves);
    return {
      x: ((r.u - clampFocus(cam.x, cam.zoom)) * cam.zoom + 0.5) * width,
      y: ((r.v - clampFocus(cam.y, cam.zoom)) * cam.zoom + 0.5) * height,
    };
  };

  const path: CursorWaypoint[] = rings.map((r) => {
    const pose = cameraPoseAt(r.at, moves);
    const x = (r.u - clampFocus(pose.x, pose.zoom)) * pose.zoom + 0.5;
    const y = (r.v - clampFocus(pose.y, pose.zoom)) * pose.zoom + 0.5;
    return { at: r.at - 1, x, y, duration: 1, click: true };
  });

  const recording = (
    <ScreenRecording
      src={staticFile(TAKE_FILES[cut.take])}
      sourceAspect={TAKE_W / TAKE_H}
      trimBefore={Math.round(cut.from * fps)}
      footageRate={cut.rate}
      camera={moves}
      entrance="none"
      theme={SORBET}
      mode="dark"
      backdropColor={C.bg}
    />
  );
  const active = callouts
    .map((c) => ({ c, level: calloutLevel(frame, c.from, c.to), box: project(target(c.target, c.inBeat, cut.take), frame) }))
    .filter((a) => a.level > 0);

  return (
    <AbsoluteFill style={{ perspective: PERSPECTIVE }}>
      {/* the rings and ticks ride inside the creep and the tilt with the footage */}
      <AbsoluteFill style={{ transform: level === 0 ? undefined : `scale(${pose.scale}) rotateX(${pose.pitch}deg) rotateY(${pose.yaw}deg)` }}>
      <AbsoluteFill style={{ transform: `scale(${creep})` }}>
        {path.length === 0 ? (
          recording
        ) : (
          <CursorTrack
            path={[{ ...path[0], at: 0, click: false }, ...path]}
            color="transparent"
            outlineColor="transparent"
            ringColor={C.mint}
            clickFrames={18}
            theme={SORBET}
            mode="dark"
          >
            {recording}
          </CursorTrack>
        )}
        {ticks.map((t) => (
          <Tick key={t.at} at={t.at} {...point(t)} />
        ))}
      </AbsoluteFill>
      </AbsoluteFill>
      {level > 0 ? (
        <AbsoluteFill
          style={{
            backdropFilter: `blur(${SOFT_EDGE * level}px)`,
            maskImage: "linear-gradient(to left, black, transparent 22%)",
            WebkitMaskImage: "linear-gradient(to left, black, transparent 22%)",
          }}
        />
      ) : null}
      <Dim boxes={active.map((a) => a.box)} level={Math.max(0, ...active.map((a) => a.level))} />
      {active.map((a) => (
        <Callout key={a.c.target + a.c.from} spec={a.c} box={a.box} scope={shot} />
      ))}
    </AbsoluteFill>
  );
}
