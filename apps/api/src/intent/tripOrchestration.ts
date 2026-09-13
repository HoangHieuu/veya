import type {
  DestinationCity,
  OriginCity,
  TravelStyle,
} from "../../../../shared/types.js";
import {
  extractMentionedLocalities,
  inferGatewayFromLocalities,
  loadLocalityGateway,
} from "../dataset/localityGateway.js";
import { inferGatewayFromText, loadNeedPlaceMap } from "../dataset/needPlaceMap.js";
import { COMPANION_TRAVEL_STYLES } from "./constants.js";
import { extractDepartMonth } from "./dateWindow.js";
import {
  isGatewayComparison,
  isNegatedDestinationMention,
} from "./discoveryMode.js";
import {
  DESTINATION_LEXICON,
  ORIGIN_LEXICON,
  STYLE_LEXICON,
} from "./lexicon.js";

/**
 * Local TripSummary helpers for the three-panel agent workspace (TDD-v2-3panel §IX / §XI).
 * Kept in intent until the shared contract lands the same shapes.
 */
export type MemberDemoProfile =
  | "guest"
  | "lotusmiles_member"
  | "lotustudents_verified";

export interface LocalTripSummary {
  memberProfile?: MemberDemoProfile;
  originCity?: OriginCity;
  travelStyle?: TravelStyle;
  destinationLocalityId?: string;
  destinationTitle?: string;
  gateway?: DestinationCity;
  travellers?: number;
  departMonth?: string;
  departDate?: string;
  returnDate?: string;
  hotelInterest?: boolean;
}

/** Field names for chat prompts — not DiscoveryStage (A owns stages). */
export type TripFieldPriority =
  | "originCity"
  | "travelStyle"
  | "destinationLocalityId"
  | "gateway"
  | "travellers"
  | "departMonth"
  | "book";

export type PolicyOverlayId =
  | "direct-decision-offer"
  | "lotusmiles"
  | "lotustudents";

const FIELD_ORDER: readonly TripFieldPriority[] = [
  "originCity",
  "travelStyle",
  "destinationLocalityId",
  "gateway",
  "travellers",
  "departMonth",
  "book",
] as const;

function extractOrigin(text: string): OriginCity | undefined {
  for (const entry of ORIGIN_LEXICON) {
    if (entry.pattern.test(text)) return entry.city;
  }
  return undefined;
}

function extractPrimaryStyle(text: string): TravelStyle | undefined {
  for (const entry of STYLE_LEXICON) {
    if (entry.pattern.test(text)) return entry.style;
  }
  return undefined;
}

function extractTravellers(text: string): number | undefined {
  const adults = text.match(/\b(\d+)\s+adults?\b/i);
  if (adults) return Math.max(1, Number(adults[1]));
  const familyOf = text.match(/\bfamily\s+of\s+(\d+)\b/i);
  if (familyOf) return Math.max(1, Number(familyOf[1]));
  if (/\bsolo\b/i.test(text)) return 1;
  if (/\bwith\s+a\s+friend\b|\btwo\s+friends\b|\bfor\s+two\b/i.test(text)) {
    return 2;
  }
  return undefined;
}

function extractExplicitGateway(text: string): DestinationCity | undefined {
  if (isGatewayComparison(text)) return undefined;
  for (const entry of DESTINATION_LEXICON) {
    const match = text.match(entry.pattern);
    if (!match || match.index === undefined) continue;
    if (isNegatedDestinationMention(text, match.index)) continue;
    return entry.city;
  }
  return undefined;
}

function extractIsoDate(text: string): string | undefined {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return iso?.[1];
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveLocality(
  text: string,
): { id: string; title: string; gateway?: DestinationCity } | undefined {
  const data = loadLocalityGateway();
  const titles = extractMentionedLocalities(text, data);
  if (titles.length > 0) {
    const title = titles[0];
    return {
      id: slugify(title),
      title,
      gateway: inferGatewayFromLocalities(text, data),
    };
  }

  for (const entry of DESTINATION_LEXICON) {
    const match = text.match(entry.pattern);
    if (!match || match.index === undefined) continue;
    if (isNegatedDestinationMention(text, match.index)) continue;
    return {
      id: entry.city.toLowerCase(),
      title: match[0],
      gateway: entry.city,
    };
  }

  const fromPlaces = inferGatewayFromText(text, loadNeedPlaceMap());
  if (fromPlaces) {
    return {
      id: fromPlaces.toLowerCase(),
      title: fromPlaces,
      gateway: fromPlaces,
    };
  }
  return undefined;
}

/**
 * TDD-v2-3panel §III priority walk.
 * Skip member (A chrome) and hotel (P1). Gateway is "inferred, ack only"
 * when locality already implies one.
 */
export function suggestNextField(
  trip: Partial<LocalTripSummary>,
): TripFieldPriority {
  for (const field of FIELD_ORDER) {
    if (field === "book") return "book";
    if (field === "originCity" && !trip.originCity) return "originCity";
    if (field === "travelStyle" && !trip.travelStyle) return "travelStyle";
    if (field === "destinationLocalityId" && !trip.destinationLocalityId) {
      return "destinationLocalityId";
    }
    if (field === "gateway") {
      // No destination yet → destination step already returned above.
      if (trip.destinationLocalityId && !trip.gateway) return "gateway";
      continue;
    }
    if (field === "travellers" && trip.travellers === undefined) {
      return "travellers";
    }
    if (field === "departMonth" && !trip.departMonth && !trip.departDate) {
      return "departMonth";
    }
  }
  return "book";
}

/**
 * Partial / full chat message → TripSummary patch (merge onto current).
 * Full brief skip-chat rule from TDD-v2-3panel §III.
 */
export function patchTripSummary(
  message: string,
  current: Partial<LocalTripSummary> = {},
): Partial<LocalTripSummary> {
  const text = message.trim();
  if (!text) return { ...current };

  const patch: Partial<LocalTripSummary> = { ...current };

  const origin = extractOrigin(text);
  if (origin) patch.originCity = origin;

  const style = extractPrimaryStyle(text);
  if (style) {
    patch.travelStyle = COMPANION_TRAVEL_STYLES[style][0] ?? style;
  }

  const travellers = extractTravellers(text);
  if (travellers !== undefined) patch.travellers = travellers;

  const month = extractDepartMonth(text);
  if (month) patch.departMonth = month;

  const iso = extractIsoDate(text);
  if (iso) patch.departDate = iso;

  const locality = resolveLocality(text);
  if (locality) {
    patch.destinationLocalityId = locality.id;
    patch.destinationTitle = locality.title;
    if (locality.gateway) patch.gateway = locality.gateway;
  } else if (!patch.gateway) {
    const explicitGateway = extractExplicitGateway(text);
    if (explicitGateway) patch.gateway = explicitGateway;
  }

  return patch;
}

/** Keyword-only policy routing — no data/policies file dependency (B not shipped yet). */
export function classifyPolicyIntent(message: string): PolicyOverlayId | null {
  const text = message.trim();
  if (!text) return null;

  // Avoid \b around "-5%" — hyphen is non-word so \b-5 never matches.
  if (
    /direct\s+decision\s+offer|offer\s+terms|discount\s+terms|-5\s*%|5\s*%\s+off/i.test(
      text,
    )
  ) {
    return "direct-decision-offer";
  }
  if (/\blotustudents?\b|\bstudent\s+(?:fare|discount|promo)\b/i.test(text)) {
    return "lotustudents";
  }
  if (/\blotusmiles?\b|\bmembership\s+terms\b|\benrol(?:l)?ment\b/i.test(text)) {
    return "lotusmiles";
  }
  return null;
}
