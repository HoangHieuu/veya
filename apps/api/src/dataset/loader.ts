import type { RouteRecord } from "../../../../shared/types.js";

/** Person D: read data/version.json + data/routes/*.json (Person B ships files). */
export function loadDataset(): { version: string; routes: RouteRecord[] } {
  return { version: "0.0.0", routes: [] };
}

export function getRoutesForOrigin(_origin: string): RouteRecord[] {
  return [];
}

export function getRouteById(_id: string): RouteRecord | undefined {
  return undefined;
}
