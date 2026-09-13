import type { LocalityGatewayData } from "./localityGateway.js";
import { applyLocalityAffinity } from "./localityGateway.js";
import type {
  DestinationCity,
  ExperienceHighlight,
  TripIntent,
} from "./types.js";

export type ExperienceTag = ExperienceHighlight["tags"][number];

export interface NeedPlaceMapData {
  version: string;
  description?: string;
  experienceTags: Record<string, string>;
  travelStyleProfiles: Record<
    string,
    { experienceTags: Partial<Record<ExperienceTag, number>> }
  >;
  priorityProfiles?: Record<
    string,
    { experienceTags: Partial<Record<ExperienceTag, number>> }
  >;
  places: Array<{
    id: string;
    title: string;
    patterns: string[];
    gateway: DestinationCity;
    experienceId?: string;
    tags: ExperienceTag[];
    gatewayBoost: number;
  }>;
  avoidPatterns: Array<{
    id: string;
    patterns: string[];
    gateway: DestinationCity;
    gatewayBoost: number;
  }>;
}

export interface NeedProfile {
  tagWeights: Partial<Record<ExperienceTag, number>>;
  gatewayAffinity: Record<DestinationCity, number>;
  matchedPlaces: string[];
  matchedPlaceTitles: string[];
  matchedExperienceIds: string[];
  hasExplicitPlaceSignals: boolean;
}

function emptyGatewayAffinity(): Record<DestinationCity, number> {
  return { HAN: 0, SGN: 0, DAD: 0 };
}

function slugLocality(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mergeTagWeights(
  target: Partial<Record<ExperienceTag, number>>,
  source: Partial<Record<ExperienceTag, number>>,
  scale = 1,
): void {
  for (const [tag, weight] of Object.entries(source) as Array<
    [ExperienceTag, number]
  >) {
    target[tag] = (target[tag] ?? 0) + weight * scale;
  }
}

function mergeTravelStyleTags(
  intent: TripIntent,
  map: NeedPlaceMapData,
  tagWeights: Partial<Record<ExperienceTag, number>>,
): void {
  for (const style of intent.travelStyles) {
    const profile = map.travelStyleProfiles[style];
    if (profile) {
      mergeTagWeights(tagWeights, profile.experienceTags);
    }
  }
  const priorityProfile = map.priorityProfiles?.[intent.priority];
  if (priorityProfile) {
    mergeTagWeights(tagWeights, priorityProfile.experienceTags, 0.5);
  }
}

function scanPlaces(
  text: string,
  map: NeedPlaceMapData,
  gatewayAffinity: Record<DestinationCity, number>,
  matchedPlaces: string[],
  matchedPlaceTitles: string[],
  matchedExperienceIds: string[],
): void {
  for (const place of map.places) {
    const hit = place.patterns.some((source) => {
      try {
        return new RegExp(source, "i").test(text);
      } catch {
        return false;
      }
    });
    if (!hit) continue;
    matchedPlaces.push(place.id);
    matchedPlaceTitles.push(place.title);
    if (place.experienceId) {
      matchedExperienceIds.push(place.experienceId);
    }
    gatewayAffinity[place.gateway] += place.gatewayBoost;
  }
}

function scanAvoidPatterns(
  text: string,
  map: NeedPlaceMapData,
  gatewayAffinity: Record<DestinationCity, number>,
): void {
  for (const avoid of map.avoidPatterns) {
    const hit = avoid.patterns.some((source) => {
      try {
        return new RegExp(source, "i").test(text);
      } catch {
        return false;
      }
    });
    if (hit) {
      gatewayAffinity[avoid.gateway] += avoid.gatewayBoost;
    }
  }
}

export function buildNeedProfile(
  intent: TripIntent,
  map: NeedPlaceMapData,
  localities?: LocalityGatewayData,
): NeedProfile {
  const tagWeights: Partial<Record<ExperienceTag, number>> = {};
  mergeTravelStyleTags(intent, map, tagWeights);

  const gatewayAffinity = emptyGatewayAffinity();
  const matchedPlaces: string[] = [];
  const matchedPlaceTitles: string[] = [];
  const matchedExperienceIds: string[] = [];
  const text = intent.rawSummary;

  let localityHit = false;
  if (localities?.localities.length) {
    const matchedLocalityTitles: string[] = [];
    localityHit = applyLocalityAffinity(
      text,
      localities,
      gatewayAffinity,
      matchedLocalityTitles,
    );
    for (const title of matchedLocalityTitles) {
      matchedPlaces.push(`locality:${slugLocality(title)}`);
      matchedPlaceTitles.push(title);
    }
  }

  scanPlaces(
    text,
    map,
    gatewayAffinity,
    matchedPlaces,
    matchedPlaceTitles,
    matchedExperienceIds,
  );
  scanAvoidPatterns(text, map, gatewayAffinity);

  const hasExplicitPlaceSignals =
    localityHit ||
    matchedPlaces.length > 0 ||
    map.avoidPatterns.some((avoid) =>
      avoid.patterns.some((source) => new RegExp(source, "i").test(text)),
    );

  return {
    tagWeights,
    gatewayAffinity,
    matchedPlaces,
    matchedPlaceTitles,
    matchedExperienceIds,
    hasExplicitPlaceSignals,
  };
}

export function inferGatewayFromText(
  text: string,
  map: NeedPlaceMapData,
): DestinationCity | undefined {
  let best: { gateway: DestinationCity; boost: number } | undefined;
  for (const place of map.places) {
    const hit = place.patterns.some((source) => new RegExp(source, "i").test(text));
    if (!hit) continue;
    const current = best?.boost ?? -Infinity;
    if (place.gatewayBoost > current) {
      best = { gateway: place.gateway, boost: place.gatewayBoost };
    }
  }
  return best?.gateway;
}

export function scoreHighlight(
  highlight: ExperienceHighlight,
  profile: NeedProfile,
): number {
  let score = highlight.featured ? 10 : 0;
  for (const tag of highlight.tags) {
    score += profile.tagWeights[tag] ?? 0;
  }
  if (profile.matchedExperienceIds.includes(highlight.id)) {
    score += 8;
  }
  return score;
}

export function rankExperienceHighlights(
  highlights: ExperienceHighlight[],
  profile: NeedProfile,
): ExperienceHighlight[] {
  return [...highlights].sort((left, right) => {
    const delta = scoreHighlight(right, profile) - scoreHighlight(left, profile);
    if (delta !== 0) return delta;
    return Number(Boolean(right.featured)) - Number(Boolean(left.featured));
  });
}

/** 0–100; 50 = neutral. Only meaningful when profile.hasExplicitPlaceSignals. */
export function scoreGatewayAffinity(
  profile: NeedProfile,
  gateway: DestinationCity,
): number {
  const raw = profile.gatewayAffinity[gateway];
  const clamped = Math.max(-1, Math.min(1, raw));
  return Math.round((50 + clamped * 50) * 10) / 10;
}

export function blendIntentMatch(
  styleMatch: number,
  profile: NeedProfile,
  gateway: DestinationCity,
): number {
  if (!profile.hasExplicitPlaceSignals) {
    return styleMatch;
  }
  const placeMatch = scoreGatewayAffinity(profile, gateway);
  const placeWeight = profile.matchedPlaces.length > 0 ? 0.55 : 0.25;
  const styleWeight = 1 - placeWeight;
  return Math.round((styleWeight * styleMatch + placeWeight * placeMatch) * 10) / 10;
}

export function placeMatchReason(
  profile: NeedProfile,
  gateway: DestinationCity,
): string | undefined {
  if (!profile.hasExplicitPlaceSignals) return undefined;
  const affinity = profile.gatewayAffinity[gateway];
  if (profile.matchedPlaceTitles.length > 0 && affinity > 0) {
    const names = profile.matchedPlaceTitles.slice(0, 2).join(" and ");
    return `Your brief mentions ${names} — a strong fit for flying into ${gateway}.`;
  }
  if (affinity < 0) {
    return `Your brief suggests avoiding this gateway region.`;
  }
  return undefined;
}
