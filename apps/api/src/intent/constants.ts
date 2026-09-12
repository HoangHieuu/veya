import type {
  DestinationCity,
  OriginCity,
  PriorityPreset,
  TravelStyle,
} from "../../../../shared/types.js";

export const DEFAULT_ORIGIN_CITY: OriginCity = "SYD";
export const DEFAULT_TRIP_DURATION_DAYS = 7;
export const MAX_TRAVEL_STYLES = 3;
export const QUIZ_MAX_TRAVEL_STYLES = 2;

export const ORIGIN_CITIES = ["SYD", "MEL", "PER"] as const satisfies readonly OriginCity[];
export const DESTINATION_CITIES = [
  "HAN",
  "SGN",
  "DAD",
] as const satisfies readonly DestinationCity[];

/**
 * Quiz sends one style; expand to at most two so scorer intentMatch
 * can match multi-archetype routes (see mock Olivia beach + food).
 * Keep this table explicit — do not invent styles at runtime.
 */
export const COMPANION_TRAVEL_STYLES: Readonly<
  Record<TravelStyle, readonly TravelStyle[]>
> = {
  beach_relaxation: ["beach_relaxation", "food_culture"],
  food_culture: ["food_culture"],
  education: ["education"],
  family: ["family"],
  vfr: ["vfr", "family"],
  mixed: ["mixed"],
};

/**
 * maxStops policy (plan risk #2):
 * - 0 only when brief says "direct only" / "nonstop"
 * - lowest_hassle / best_for_family → 1 (matches Olivia mock)
 * - otherwise → 2
 */
export const PRIORITY_MAX_STOPS: Readonly<
  Record<PriorityPreset, 0 | 1 | 2>
> = {
  lowest_hassle: 1,
  best_for_family: 1,
  maximise_miles: 2,
  food_and_culture: 2,
};
