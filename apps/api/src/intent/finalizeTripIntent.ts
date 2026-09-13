import type {
  BudgetBand,
  DestinationCity,
  PriorityPreset,
  TravelStyle,
  TripIntent,
  TripSummary,
} from "../../../../shared/types.js";
import {
  COMPANION_TRAVEL_STYLES,
  MAX_TRAVEL_STYLES,
  PRIORITY_MAX_STOPS,
} from "./constants.js";

const GATEWAY_LABEL: Record<DestinationCity, string> = {
  HAN: "Hanoi",
  SGN: "Ho Chi Minh City",
  DAD: "Da Nang",
};

const ORIGIN_LABEL: Record<string, string> = {
  SYD: "Sydney",
  MEL: "Melbourne",
  PER: "Perth",
};

const PRIORITY_BY_STYLE: Partial<Record<TravelStyle, PriorityPreset>> = {
  vfr: "lowest_hassle",
  family: "best_for_family",
  food_culture: "food_and_culture",
  beach_relaxation: "lowest_hassle",
  education: "lowest_hassle",
};

export class IncompleteTripError extends Error {
  readonly errorCode = "INTENT_INCOMPLETE";
  constructor(readonly missingFields: string[]) {
    super(`The trip is missing: ${missingFields.join(", ")}`);
    this.name = "IncompleteTripError";
  }
}

/**
 * Turn the three-panel TripSummary the traveller has been building in chat into
 * the TripIntent the scoring engine consumes. Everything here is derived from
 * fields the traveller actually supplied — nothing is guessed except the
 * budget band and priority, which are presentation defaults the UI lets them
 * override downstream.
 */
export function finalizeTripIntent(
  trip: TripSummary,
  options: { now: Date },
): TripIntent {
  const missing = missingFields(trip);
  if (missing.length > 0) throw new IncompleteTripError(missing);

  const originCity = trip.originCity!;
  const start = trip.departDate!;
  const end = trip.returnDate!;
  const travellers = trip.travellers!;

  const travelStyles = resolveTravelStyles(trip.travelStyle);
  const durationDays = Math.max(1, daysBetween(start, end));
  const priority = PRIORITY_BY_STYLE[travelStyles[0]] ?? "lowest_hassle";

  return {
    originCity,
    travelStyles,
    budgetBand: resolveBudgetBand(trip),
    travellers,
    priority,
    dateWindow: { start, end, flexibility: "fixed" },
    tripDurationDays: durationDays,
    goal: trip.gateway ? "choose_route" : "discover_destination",
    ...(trip.gateway ? { preferredDestination: trip.gateway } : {}),
    constraints: { maxStops: PRIORITY_MAX_STOPS[priority] },
    rawSummary: buildRawSummary(trip, durationDays),
    parseConfidence: 1,
    missingFields: [],
  };
}

export function missingFields(trip: TripSummary): string[] {
  const missing: string[] = [];
  if (!trip.originCity) missing.push("originCity");
  if (!trip.travelStyle) missing.push("travelStyle");
  if (!trip.destinationLocalityId) missing.push("destinationLocalityId");
  if (!trip.gateway) missing.push("gateway");
  if (trip.travellers === undefined) missing.push("travellers");
  if (!trip.departDate) missing.push("departDate");
  if (!trip.returnDate) missing.push("returnDate");
  return missing;
}

function resolveTravelStyles(style: TravelStyle | undefined): TravelStyle[] {
  if (!style) return ["mixed"];
  const companions = COMPANION_TRAVEL_STYLES[style] ?? [];
  const ordered = [style, ...companions.filter((item) => item !== style)];
  return [...new Set(ordered)].slice(0, MAX_TRAVEL_STYLES);
}

function resolveBudgetBand(trip: TripSummary): BudgetBand {
  switch (trip.fareBrandId) {
    case "business_classic":
    case "business_flex":
    case "premium_economy":
      return "premium";
    case "economy_lite":
      return "budget";
    default:
      return "standard";
  }
}

function buildRawSummary(trip: TripSummary, durationDays: number): string {
  const origin = ORIGIN_LABEL[trip.originCity!] ?? trip.originCity!;
  const destination =
    trip.destinationTitle ?? GATEWAY_LABEL[trip.gateway!] ?? trip.gateway!;
  const gateway = GATEWAY_LABEL[trip.gateway!] ?? trip.gateway!;
  const pax = trip.travellers === 1 ? "1 adult" : `${trip.travellers} adults`;
  const style = (trip.travelStyle ?? "mixed").replace(/_/g, " ");
  const viaGateway =
    destination.toLowerCase() === gateway.toLowerCase() ? "" : ` via ${gateway}`;
  return `${origin} to ${destination}${viaGateway}, ${trip.departDate} to ${trip.returnDate} (${durationDays} days), ${pax}, ${style}.`;
}

function daysBetween(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 1;
  return Math.round((endMs - startMs) / 86_400_000);
}
