import type { DestinationCity, TripIntent } from "../../../../shared/types.js";
import {
  inferGatewayFromLocalities,
  loadLocalityGateway,
} from "../dataset/localityGateway.js";
import { inferGatewayFromText, loadNeedPlaceMap } from "../dataset/needPlaceMap.js";
import { DESTINATION_LEXICON } from "./lexicon.js";

/** Local DiscoveryMode until absorbed into shared contracts. */
export type DiscoveryMode = "discovery" | "route_known";

export interface ExplicitGatewayMention {
  city: DestinationCity;
  index: number;
  length: number;
}

const COMPARE_TOKEN = /\b(?:or|vs\.?|versus|either)\b/i;
const PRICE_ONLY_ASK =
  /\b(?:price|fare|how\s+much|cheapest|cost)\b/i;
const FIXED_DATES = /\bfixed\s+dates?\b/i;
const ISO_DATE = /\b(20\d{2}-\d{2}-\d{2})\b/;

/** Shared negation window used by heuristic + 3-panel helpers. */
export function isNegatedDestinationMention(
  text: string,
  matchIndex: number,
): boolean {
  const window = text.slice(Math.max(0, matchIndex - 40), matchIndex);
  return /\b(?:not|avoid|skip|without|no)\s+(?:going\s+to\s+)?$/i.test(window);
}

/** Non-negated HAN/SGN/DAD mentions from DESTINATION_LEXICON only (not locality inference). */
export function findExplicitGatewayMentions(
  text: string,
): ExplicitGatewayMention[] {
  const mentions: ExplicitGatewayMention[] = [];
  for (const entry of DESTINATION_LEXICON) {
    const flags = entry.pattern.flags.includes("g")
      ? entry.pattern.flags
      : `${entry.pattern.flags}g`;
    const re = new RegExp(entry.pattern.source, flags);
    for (const match of text.matchAll(re)) {
      if (match.index === undefined) continue;
      if (isNegatedDestinationMention(text, match.index)) continue;
      mentions.push({
        city: entry.city,
        index: match.index,
        length: match[0].length,
      });
    }
  }
  mentions.sort((a, b) => a.index - b.index);
  return mentions;
}

export function distinctCitiesFromMentions(
  mentions: readonly ExplicitGatewayMention[],
): DestinationCity[] {
  const seen = new Set<DestinationCity>();
  for (const mention of mentions) {
    seen.add(mention.city);
  }
  return [...seen];
}

export function distinctExplicitGateways(text: string): DestinationCity[] {
  return distinctCitiesFromMentions(findExplicitGatewayMentions(text));
}

/**
 * Compare detection: ≥2 distinct non-negated gateways AND a compare token
 * positioned between the first and last gateway match (avoids bare "or" in prose).
 */
export function isGatewayComparison(text: string): boolean {
  const mentions = findExplicitGatewayMentions(text);
  const cities = distinctCitiesFromMentions(mentions);
  if (cities.length < 2 || mentions.length < 2) return false;

  const first = mentions[0];
  const last = mentions[mentions.length - 1];
  const between = text.slice(first.index + first.length, last.index);
  return COMPARE_TOKEN.test(between);
}

export function hasPriceOnlyAsk(text: string): boolean {
  return PRICE_ONLY_ASK.test(text);
}

export function hasFixedOrIsoDate(text: string): boolean {
  return FIXED_DATES.test(text) || ISO_DATE.test(text);
}

/**
 * TDD-v2 §III: narrow route_known; default discovery.
 * Orthogonal to TripIntent.goal — locality inference may set choose_route + SGN
 * while discoveryMode stays "discovery" (e.g. Cà Mau without airport IATA).
 *
 * Scans DESTINATION_LEXICON once per call.
 */
export function classifyDiscoveryMode(
  _intent: TripIntent,
  briefText?: string,
): DiscoveryMode {
  const text = briefText?.trim() ?? "";

  // Quiz / cached intent without original brief → discovery (offer-safe default).
  if (!text) return "discovery";

  const mentions = findExplicitGatewayMentions(text);
  const cities = distinctCitiesFromMentions(mentions);

  if (cities.length >= 2 && mentions.length >= 2) {
    const first = mentions[0];
    const last = mentions[mentions.length - 1];
    const between = text.slice(first.index + first.length, last.index);
    if (COMPARE_TOKEN.test(between)) return "discovery";
  }

  if (cities.length === 0) {
    const fromLocality = inferGatewayFromLocalities(text, loadLocalityGateway());
    if (fromLocality || inferGatewayFromText(text, loadNeedPlaceMap())) {
      return "discovery";
    }
  }

  if (
    cities.length === 1 &&
    (hasFixedOrIsoDate(text) || hasPriceOnlyAsk(text))
  ) {
    return "route_known";
  }

  return "discovery";
}
