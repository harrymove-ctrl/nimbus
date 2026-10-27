import { createContext, useContext } from "react";
import { useVideoConfig } from "remotion";
import {
  CursorTrack,
  type CursorWaypoint,
} from "@/components/snap-cn/cursor-track";
import {
  type CameraMove,
  cameraPoseAt,
  clampFocus,
  ScreenRecording,
} from "@/components/snap-cn/screen-recording";
import {
  type Beat,
  cutFor,
  FOOTAGE,
  FOOTAGE_ASPECT,
  fitCut,
  type ShotName,
} from "./beats";
import { C, SORBET } from "./theme";

export type Take = { beats: Beat[] | null; aspect: number; footage: string };
export const TakeContext = createContext<Take>({
  beats: null,
  aspect: FOOTAGE_ASPECT,
  footage: FOOTAGE,
});

/** A camera move whose focal point is in SOURCE coordinates (0–1 across the app's window). */
export type SourceMove = {
  at: number;
  duration?: number;
  zoom?: number;
  u?: number;
  v?: number;
};
/** A click to mark: a mint ring at a point of the app, in source coordinates. */
export type Ring = { at: number; u: number; v: number };

// The take is cover-fitted to 16:9, so a source point moves when the aspects differ.
function toFrame(u: number, v: number, aspect: number, compAspect: number) {
  if (aspect < compAspect)
    return { x: u, y: 0.5 + (v - 0.5) * (compAspect / aspect) };
  return { x: 0.5 + (u - 0.5) * (aspect / compAspect), y: v };
}

/**
 * One footage shot: the cut from beats.ts fitted to `frames`, a camera that always moves,
 * and optional click rings. The take already draws its own cursor (record-demo injects
 * one), so cursor-track runs ring-only here: no second pointer, a ring on each click.
 */
export function Footage({
  shot,
  frames,
  camera,
  rings = [],
}: {
  shot: ShotName;
  frames: number;
  camera: SourceMove[];
  rings?: Ring[];
}) {
  const { fps, width, height } = useVideoConfig();
  const take = useContext(TakeContext);
  const comp = width / height;
  const cut = fitCut(cutFor(shot, take.beats), frames / fps);

  const moves: CameraMove[] = camera.map((m) => {
    const p = toFrame(m.u ?? 0.5, m.v ?? 0.5, take.aspect, comp);
    return {
      at: m.at,
      duration: m.duration ?? 40,
      zoom: m.zoom,
      x: m.u === undefined ? undefined : p.x,
      y: m.v === undefined ? undefined : p.y,
    };
  });

  const path: CursorWaypoint[] = rings.flatMap((r) => {
    const pose = cameraPoseAt(r.at, moves);
    const p = toFrame(r.u, r.v, take.aspect, comp);
    const x = (p.x - clampFocus(pose.x, pose.zoom)) * pose.zoom + 0.5;
    const y = (p.y - clampFocus(pose.y, pose.zoom)) * pose.zoom + 0.5;
    return [{ at: r.at - 1, x, y, duration: 1, click: true }];
  });

  const recording = (
    <ScreenRecording
      src={take.footage}
      sourceAspect={take.aspect}
      trimBefore={Math.round(cut.from * fps)}
      footageRate={cut.rate}
      camera={moves}
      theme={SORBET}
      mode="dark"
      backdropColor={C.bg}
    />
  );
  if (path.length === 0) return recording;
  return (
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
  );
}
