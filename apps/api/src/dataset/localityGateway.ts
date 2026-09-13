import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeLocalityGateway,
  type LocalityGatewayData,
  type RawLocalityGatewayFile,
} from "../../../../shared/localityGateway.js";

export type { LocalityGatewayData } from "../../../../shared/localityGateway.js";
export {
  applyLocalityAffinity,
  extractMentionedLocalities,
  hasVisitLocationContext,
  inferGatewayFromLocalities,
  normalizeLocalityGateway,
} from "../../../../shared/localityGateway.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../data/locality-gateway.json",
);

let cache: LocalityGatewayData | null = null;

export function loadLocalityGateway(root = ROOT): LocalityGatewayData {
  if (cache && root === ROOT) {
    return cache;
  }
  if (!existsSync(root)) {
    return normalizeLocalityGateway({ version: "unavailable" });
  }
  const raw = JSON.parse(readFileSync(root, "utf8")) as RawLocalityGatewayFile;
  const data = normalizeLocalityGateway(raw);
  if (root === ROOT) {
    cache = data;
  }
  return data;
}

export function resetLocalityGatewayCacheForTests() {
  cache = null;
}
