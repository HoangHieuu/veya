import type { OriginCity } from "@shared/types";

export type GlobeTuning = {
  auPhi: number;
  auTheta: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  latFactor: number;
  /** When true, ignore city — use manualPhi / manualTheta only */
  manual: boolean;
  manualPhi: number;
  manualTheta: number;
  /** Preview a city without changing wizard selection */
  usePreviewOrigin: boolean;
  previewOrigin: OriginCity;
};

export const DEFAULT_GLOBE_TUNING: GlobeTuning = {
  auPhi: 1.52,
  auTheta: -0.6,
  scale: 1.12,
  offsetX: 40,
  offsetY: -40,
  latFactor: 0.35,
  manual: false,
  manualPhi: 1.52,
  manualTheta: -0.6,
  usePreviewOrigin: false,
  previewOrigin: "SYD",
};

export function globeTuningSnippet(t: GlobeTuning) {
  return [
    `const AU_BASE = { phi: ${t.auPhi.toFixed(3)}, theta: ${t.auTheta.toFixed(3)} };`,
    `const FIXED_SCALE = ${t.scale.toFixed(2)};`,
    `const FIXED_OFFSET: [number, number] = [${t.offsetX.toFixed(1)}, ${t.offsetY.toFixed(1)}];`,
    `// latFactor in targetAngles: ${t.latFactor.toFixed(3)}`,
  ].join("\n");
}
