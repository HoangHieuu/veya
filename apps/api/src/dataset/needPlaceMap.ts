import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NeedPlaceMapData } from "../../../../shared/needPlaceMap.js";

export type { NeedPlaceMapData, NeedProfile } from "../../../../shared/needPlaceMap.js";
export {
  buildNeedProfile,
  blendIntentMatch,
  inferGatewayFromText,
  placeMatchReason,
  rankExperienceHighlights,
  scoreGatewayAffinity,
} from "../../../../shared/needPlaceMap.js";

const MAP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../data/need-place-map.json",
);

let cache: NeedPlaceMapData | null = null;

export function loadNeedPlaceMap(root = MAP_ROOT): NeedPlaceMapData {
  if (cache && root === MAP_ROOT) {
    return cache;
  }
  if (!existsSync(root)) {
    const empty: NeedPlaceMapData = {
      version: "unavailable",
      experienceTags: {},
      travelStyleProfiles: {},
      places: [],
      avoidPatterns: [],
    };
    return empty;
  }
  const parsed = JSON.parse(readFileSync(root, "utf8")) as NeedPlaceMapData;
  if (root === MAP_ROOT) {
    cache = parsed;
  }
  return parsed;
}

export function resetNeedPlaceMapCacheForTests() {
  cache = null;
}
