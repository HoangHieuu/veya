import { isGatewayComparison, isNegatedDestinationMention } from "./discoveryMode.js";
import {
  BUDGET_LEXICON,
  DESTINATION_LEXICON,
  DIRECT_ONLY_PATTERN,
  FEW_STOPS_PATTERN,
  ORIGIN_LEXICON,
  PRIORITY_LEXICON,
  STYLE_LEXICON,
} from "./lexicon.js";
import {
  hasVisitLocationContext,
  inferGatewayFromLocalities,
  loadLocalityGateway,
} from "../dataset/localityGateway.js";
import { inferGatewayFromText, loadNeedPlaceMap } from "../dataset/needPlaceMap.js";
import {
  COMPANION_TRAVEL_STYLES,
  DEFAULT_ORIGIN_CITY,
  DEFAULT_TRIP_DURATION_DAYS,
  MAX_TRAVEL_STYLES,
  PRIORITY_MAX_STOPS,
} from "./constants.js";
import type {
  BudgetBand,
  DestinationCity,
  OriginCity,
  PriorityPreset,
  TravelStyle,
  TripIntent,
} from "../../../../shared/types.js";
import {
  buildDateWindow,
  formatIsoDateUtc,
  isIsoDate,
  MONTHS,
  type DateFlexibility,
} from "./dateWindow.js";

export interface BriefParseHints {
  originCity?: OriginCity;
  priorityOverride?: PriorityPreset;
  now?: Date;
}

/** Why preferredDestination was set — internal only, not on TripIntent. */
export type DestinationSource =
  | "explicit"
  | "locality"
  | "need_place"
  | "compare"
  | "none";

export interface BriefHeuristicResult {
  intent: TripIntent;
  destinationSource: DestinationSource;
  fieldHits: {
    originCity: boolean;
    travelStyles: boolean;
    budgetBand: boolean;
    travellers: boolean;
    priority: boolean;
    tripDurationDays: boolean;
    preferredDestination: boolean;
  };
}

function extractOrigin(text: string): OriginCity | undefined {
  for (const entry of ORIGIN_LEXICON) {
    if (entry.pattern.test(text)) return entry.city;
  }
  return undefined;
}

function resolveDestination(
  text: string,
  localities: ReturnType<typeof loadLocalityGateway>,
): {
  city: DestinationCity | undefined;
  source: DestinationSource;
} {
  // Compare ≥2 gateways → leave destination open so ranking can return all three.
  if (isGatewayComparison(text)) {
    return { city: undefined, source: "compare" };
  }

  const fromLocality = inferGatewayFromLocalities(text, localities);
  if (fromLocality) return { city: fromLocality, source: "locality" };

  const fromPlaces = inferGatewayFromText(text, loadNeedPlaceMap());
  if (fromPlaces) return { city: fromPlaces, source: "need_place" };

  for (const entry of DESTINATION_LEXICON) {
    const match = text.match(entry.pattern);
    if (!match || match.index === undefined) continue;
    if (isNegatedDestinationMention(text, match.index)) continue;
    return { city: entry.city, source: "explicit" };
  }
  return { city: undefined, source: "none" };
}

function extractStyles(text: string): TravelStyle[] {
  const found: TravelStyle[] = [];
  for (const entry of STYLE_LEXICON) {
    if (entry.pattern.test(text) && !found.includes(entry.style)) {
      found.push(entry.style);
    }
  }
  if (found.length === 0) return [];
  if (found.length === 1) {
    return [...COMPANION_TRAVEL_STYLES[found[0]]].slice(0, MAX_TRAVEL_STYLES);
  }
  return found.slice(0, MAX_TRAVEL_STYLES);
}

function extractBudget(text: string): BudgetBand | undefined {
  for (const entry of BUDGET_LEXICON) {
    if (entry.pattern.test(text)) return entry.band;
  }
  return undefined;
}

function extractPriority(text: string): PriorityPreset | undefined {
  for (const entry of PRIORITY_LEXICON) {
    if (entry.pattern.test(text)) return entry.priority;
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

function extractTripDurationDays(text: string): number | undefined {
  const range = text.match(/\b(\d+)\s*[–-]\s*(\d+)\s+days?\b/i);
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    return Math.round((low + high) / 2);
  }

  // Drop flexibility window phrases so "±3 days" is not treated as trip length.
  const withoutFlex = text.replace(/±\s*\d+\s+days?|[+\-/]{1,2}\s*\d+\s+days?/gi, " ");
  const exact = withoutFlex.match(/\b(\d+)\s+days?\b/i);
  if (exact) return Number(exact[1]);

  if (/\blong\s+weekend\b/i.test(text)) return 3;
  if (/\btwo\s+weeks?\b|\b2\s+weeks?\b/i.test(text)) return 14;
  if (/\bone\s+week\b|\ba\s+week\b/i.test(text)) return 7;
  return undefined;
}

function extractFlexibility(text: string): DateFlexibility {
  if (/\bfixed\s+dates?\b/i.test(text)) return "fixed";
  if (/\bflexible\s+within\s+a\s+month\b|\bnext\s+month\b/i.test(text)) {
    return "flexible_month";
  }
  if (/\b±\s*3\b|\b\+\/-\s*3\b|\bflexible\s+within\s*±?\s*3\b/i.test(text)) {
    return "flexible_±3";
  }
  return "flexible_±3";
}

function extractStartDate(text: string, now: Date): string | undefined {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso && isIsoDate(iso[1])) return iso[1];

  const midMonth = text.match(/\bmid[- ]([A-Za-z]+)\b/i);
  if (midMonth) {
    const month = MONTHS[midMonth[1].toLowerCase()];
    if (month !== undefined) {
      const year = now.getUTCFullYear();
      const candidate = new Date(Date.UTC(year, month, 15));
      if (candidate.getTime() < now.getTime()) {
        candidate.setUTCFullYear(year + 1);
      }
      return formatIsoDateUtc(candidate);
    }
  }

  if (/\bnext\s+month\b/i.test(text)) {
    return formatIsoDateUtc(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    );
  }

  return undefined;
}

function resolveMaxStops(text: string, priority: PriorityPreset): 0 | 1 | 2 {
  if (DIRECT_ONLY_PATTERN.test(text)) return 0;
  if (FEW_STOPS_PATTERN.test(text)) return 1;
  return PRIORITY_MAX_STOPS[priority];
}

function scoreConfidence(hits: BriefHeuristicResult["fieldHits"]): number {
  const keys = Object.keys(hits) as Array<keyof BriefHeuristicResult["fieldHits"]>;
  const scored = keys.filter((key) => hits[key]).length;
  const ratio = scored / keys.length;
  return Math.round((0.55 + ratio * 0.4) * 100) / 100;
}

export function parseBriefHeuristic(
  briefText: string,
  hints: BriefParseHints = {},
): BriefHeuristicResult {
  const text = briefText.trim();
  const now = hints.now ?? new Date();
  const missingFields: string[] = [];

  const extractedOrigin = extractOrigin(text);
  // Prefer city named in briefText over request hint (WORK_SPLIT: hint is fallback).
  const originCity = extractedOrigin ?? hints.originCity;
  const originHit = Boolean(originCity);
  const resolvedOrigin = originCity ?? DEFAULT_ORIGIN_CITY;
  if (!originHit) missingFields.push("originCity");

  const styles = extractStyles(text);
  const travelStylesHit = styles.length > 0;
  const travelStyles: TravelStyle[] = travelStylesHit ? styles : ["mixed"];
  if (!travelStylesHit) missingFields.push("travelStyles");

  const extractedBudget = extractBudget(text);
  const budgetBand = extractedBudget ?? "standard";
  const budgetHit = extractedBudget !== undefined;
  if (!budgetHit) missingFields.push("budgetBand");

  const extractedTravellers = extractTravellers(text);
  const travellers = extractedTravellers ?? 1;
  const travellersHit = extractedTravellers !== undefined;
  if (!travellersHit) missingFields.push("travellers");

  const extractedPriority = extractPriority(text);
  const priority =
    hints.priorityOverride ?? extractedPriority ?? "lowest_hassle";
  const priorityHit = Boolean(hints.priorityOverride ?? extractedPriority);
  if (!priorityHit) missingFields.push("priority");

  const duration = extractTripDurationDays(text);
  const tripDurationDays = duration ?? DEFAULT_TRIP_DURATION_DAYS;
  const durationHit = duration !== undefined;
  if (!durationHit) missingFields.push("tripDurationDays");

  const localities = loadLocalityGateway();
  const { city: preferredDestination, source: destinationSource } =
    resolveDestination(text, localities);
  const destinationHit = preferredDestination !== undefined;
  const visitContext =
    travelStyles.includes("vfr") || hasVisitLocationContext(text, localities);
  const goal: TripIntent["goal"] = destinationHit
    ? "choose_route"
    : "discover_destination";

  // Compare leaves gateway intentionally open — do not push preferredDestination
  // into missingFields (Veya should answer the comparison, not ask for it).
  if (destinationSource !== "compare" && !destinationHit) {
    const needsGateway =
      visitContext ||
      /\bPhu\s*Quoc\b|\bNha\s*Trang\b|\bHue\b/i.test(text);
    if (needsGateway) missingFields.push("preferredDestination");
  }

  const flexibility = extractFlexibility(text);
  const extractedStart = extractStartDate(text, now);
  const start = extractedStart ?? formatIsoDateUtc(now);
  if (!extractedStart) missingFields.push("dateWindow.start");

  const dateWindow = buildDateWindow(start, tripDurationDays, flexibility);
  const maxStops = resolveMaxStops(text, priority);

  const fieldHits: BriefHeuristicResult["fieldHits"] = {
    originCity: originHit,
    travelStyles: travelStylesHit,
    budgetBand: budgetHit,
    travellers: travellersHit,
    priority: priorityHit,
    tripDurationDays: durationHit,
    preferredDestination: destinationHit,
  };

  const intent: TripIntent = {
    originCity: resolvedOrigin,
    travelStyles,
    budgetBand,
    travellers,
    priority,
    dateWindow,
    tripDurationDays,
    goal,
    ...(preferredDestination ? { preferredDestination } : {}),
    constraints: { maxStops },
    rawSummary: text.length > 220 ? `${text.slice(0, 217)}...` : text,
    parseConfidence: scoreConfidence(fieldHits),
    missingFields,
  };

  return { intent, destinationSource, fieldHits };
}
