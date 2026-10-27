import "./index.css";
import { type CalculateMetadataFunction, Composition, staticFile } from "remotion";
import { type Beat, FOOTAGE_ASPECT, TAKE } from "./beats";
import { type CutProps, FULL_FRAMES, NimbusFull, NimbusX, X_FRAMES } from "./compositions";
import { FPS } from "./grid";

// The take's beats file, when it has one (beats.ts: a beats file only applies to its take).
async function loadBeats(): Promise<Beat[] | null> {
  if (!TAKE.beatsJson) return null;
  try {
    const res = await fetch(staticFile(TAKE.beatsJson));
    if (!res.ok) return null;
    const json = await res.json();
    const list = Array.isArray(json) ? json : json?.beats;
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

// The take's aspect, read off the file so a re-capture at another size needs no edit.
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
      done(v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : FOOTAGE_ASPECT);
    };
    v.onerror = () => {
      clearTimeout(timer);
      done(FOOTAGE_ASPECT);
    };
    v.src = src;
  });
}

const calculateMetadata: CalculateMetadataFunction<CutProps> = async ({ props }) => {
  const footage = staticFile(TAKE.footage);
  const [beats, aspect] = await Promise.all([loadBeats(), measureAspect(footage)]);
  return { props: { ...props, beats, aspect, footage } };
};

const defaults: CutProps = { beats: null, aspect: FOOTAGE_ASPECT, footage: TAKE.footage };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="NimbusFull"
      component={NimbusFull}
      durationInFrames={FULL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={defaults}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="NimbusX"
      component={NimbusX}
      durationInFrames={X_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={defaults}
      calculateMetadata={calculateMetadata}
    />
  </>
);
