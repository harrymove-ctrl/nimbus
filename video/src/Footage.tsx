import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CursorTrack, type CursorWaypoint } from "@/components/snap-cn/cursor-track";
import {
  type CameraMove,
  cameraPoseAt,
  clampFocus,
  ScreenRecording,
} from "@/components/snap-cn/screen-recording";
import { fit, SHOTS, type ShotName, TAKE, TAKE_H, TAKE_W, target } from "./beats";
import { Callout, type CalloutSpec, calloutLevel, Dim, type ScreenBox } from "./components/Callout";
import { C, SORBET } from "./theme";

/** A camera move whose focal point is in take coordinates (0–1 across the app's window). */
export type SourceMove = { at: number; duration?: number; zoom?: number; u?: number; v?: number };
/** A click to mark: a mint ring at a point of the app, in take coordinates. */
export type Ring = { at: number; u: number; v: number };

// A slow push under every keyframed move, so no hold between moves reads as a freeze.
const CREEP = 1.06;

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
  callouts = [],
}: {
  shot: ShotName;
  frames: number;
  camera: SourceMove[];
  rings?: Ring[];
  callouts?: CalloutSpec[];
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

  // take px → frame px at `f`, through the camera and the creep (both centred on the frame)
  const project = (b: { x: number; y: number; w: number; h: number }, f: number): ScreenBox => {
    const pose = cameraPoseAt(f, moves);
    const fx = clampFocus(pose.x, pose.zoom);
    const fy = clampFocus(pose.y, pose.zoom);
    const k = pose.zoom * creep;
    const sx = (b.x / TAKE_W - fx) * k + 0.5;
    const sy = (b.y / TAKE_H - fy) * k + 0.5;
    return { x: sx * width, y: sy * height, w: (b.w / TAKE_W) * k * width, h: (b.h / TAKE_H) * k * height };
  };

  const path: CursorWaypoint[] = rings.map((r) => {
    const pose = cameraPoseAt(r.at, moves);
    const x = (r.u - clampFocus(pose.x, pose.zoom)) * pose.zoom + 0.5;
    const y = (r.v - clampFocus(pose.y, pose.zoom)) * pose.zoom + 0.5;
    return { at: r.at - 1, x, y, duration: 1, click: true };
  });

  const recording = (
    <ScreenRecording
      src={staticFile(TAKE)}
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
    .map((c) => ({ c, level: calloutLevel(frame, c.from, c.to), box: project(target(c.target, c.inBeat), frame) }))
    .filter((a) => a.level > 0);

  return (
    <AbsoluteFill>
      {/* the rings ride inside the creep with the footage */}
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
      </AbsoluteFill>
      <Dim boxes={active.map((a) => a.box)} level={Math.max(0, ...active.map((a) => a.level))} />
      {active.map((a) => (
        <Callout key={a.c.target + a.c.from} spec={a.c} box={a.box} />
      ))}
    </AbsoluteFill>
  );
}
