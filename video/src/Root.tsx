import "./index.css";
import { Composition } from "remotion";
import { FULL_FRAMES, NimbusFull, NimbusX, X_FRAMES } from "./compositions";
import { FPS } from "./grid";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="NimbusFull" component={NimbusFull} durationInFrames={FULL_FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="NimbusX" component={NimbusX} durationInFrames={X_FRAMES} fps={FPS} width={1920} height={1080} />
  </>
);
