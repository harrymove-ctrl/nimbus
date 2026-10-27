/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import path from "node:path";
import { Config } from "@remotion/cli/config";
import { webpackOverride } from "./webpack-override";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// The footage and beats.json live in docs/demo/ (written by scripts/record-demo.ts).
Config.setPublicDir(path.join(process.cwd(), "..", "docs", "demo"));
Config.overrideBundlerConfig(webpackOverride);
