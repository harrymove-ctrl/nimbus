import "./index.css";
import {
  type CalculateMetadataFunction,
  Composition,
  staticFile,
} from "remotion";
import { type Beat, BEATS_JSON, FOOTAGE, FOOTAGE_ASPECT } from "./beats";
import { DURATION, FPS, NimbusDemo, type NimbusDemoProps } from "./NimbusDemo";

// beats.json is optional: absent, every cut uses the hand timings in beats.ts.
async function loadBeats(): Promise<Beat[] | null> {
  try {
    const res = await fetch(staticFile(BEATS_JSON));
    if (!res.ok) return null;
    const json = await res.json();
    const list = Array.isArray(json) ? json : json?.beats;
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

// The take's aspect, read off the file so a 1920 × 1080 re-capture needs no edit.
function measureAspect(src: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const done = (a: number) => {
      v.removeAttribute("src");
      resolve(a);
    };
    const timer = setTimeout(() => done(FOOTAGE_ASPECT), 8000);
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      clearTimeout(timer);
      done(
        v.videoWidth && v.videoHeight
          ? v.videoWidth / v.videoHeight
          : FOOTAGE_ASPECT,
      );
    };
    v.onerror = () => {
      clearTimeout(timer);
      done(FOOTAGE_ASPECT);
    };
    v.src = src;
  });
}

const calculateMetadata: CalculateMetadataFunction<NimbusDemoProps> = async ({
  props,
}) => {
  const footage = staticFile(FOOTAGE);
  const [beats, aspect] = await Promise.all([
    loadBeats(),
    measureAspect(footage),
  ]);
  return { props: { ...props, beats, aspect, footage } };
};

const defaults: NimbusDemoProps = {
  beats: null,
  aspect: FOOTAGE_ASPECT,
  footage: FOOTAGE,
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NimbusDemo"
      component={NimbusDemo}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={defaults}
      calculateMetadata={calculateMetadata}
    />
  );
};
