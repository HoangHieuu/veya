import type {
  BudgetBand,
  PriorityPreset,
  RouteRecord,
  ScoreBreakdown,
  TravelStyle,
  TripIntent,
} from "../../../../shared/types.js";
import { connectionReasonText } from "../../../../shared/routeLabels.js";

export const SCORING_VERSION = "0.1.0";

export type ScoreFactor =
  | "intentMatch"
  | "dateFit"
  | "routeConvenience"
  | "budgetFit"
  | "loyaltyValue"
  | "promotionBoost";

export type ScoreWeights = Record<ScoreFactor, number>;

export interface ReasonTrace {
  text: string;
  sourceFields: string[];
}

export interface ScoredRoute {
  route: RouteRecord;
  score: ScoreBreakdown;
  reasonTraces: ReasonTrace[];
}

export const SCORE_WEIGHTS: Record<PriorityPreset, ScoreWeights> = {
  lowest_hassle: {
    intentMatch: 0.25,
    dateFit: 0.15,
    routeConvenience: 0.35,
    budgetFit: 0.15,
    loyaltyValue: 0.05,
    promotionBoost: 0.05,
  },
  best_for_family: {
    intentMatch: 0.25,
    dateFit: 0.15,
    routeConvenience: 0.25,
    budgetFit: 0.15,
    loyaltyValue: 0.05,
    promotionBoost: 0.15,
  },
  maximise_miles: {
    intentMatch: 0.2,
    dateFit: 0.1,
    routeConvenience: 0.15,
    budgetFit: 0.1,
    loyaltyValue: 0.35,
    promotionBoost: 0.1,
  },
  food_and_culture: {
    intentMatch: 0.35,
    dateFit: 0.1,
    routeConvenience: 0.15,
    budgetFit: 0.1,
    loyaltyValue: 0.05,
    promotionBoost: 0.25,
  },
};

const FACTORS: ScoreFactor[] = [
  "intentMatch",
  "dateFit",
  "routeConvenience",
  "budgetFit",
  "loyaltyValue",
  "promotionBoost",
];

const BAND_ORDER: BudgetBand[] = ["budget", "standard", "premium"];

export function rankRoutes(
  intent: TripIntent,
  routes: RouteRecord[],
  now = new Date(),
): ScoredRoute[] {
  return routes
    .map((route) => scoreRoute(intent, route, now))
    .sort((left, right) => {
      if (right.score.weightedTotal !== left.score.weightedTotal) {
        return right.score.weightedTotal - left.score.weightedTotal;
      }
      if (right.score.routeConvenience !== left.score.routeConvenience) {
        return right.score.routeConvenience - left.score.routeConvenience;
      }
      if (right.score.intentMatch !== left.score.intentMatch) {
        return right.score.intentMatch - left.score.intentMatch;
      }
      return left.route.id < right.route.id ? -1 : left.route.id > right.route.id ? 1 : 0;
    });
}

export function scoreRoute(
  intent: TripIntent,
  route: RouteRecord,
  now = new Date(),
): ScoredRoute {
  const factors: Record<ScoreFactor, number> = {
    intentMatch: scoreIntentMatch(intent.travelStyles, route.tripArchetypes),
    dateFit: scoreDateFit(intent.dateWindow.start, intent.dateWindow.end, route),
    routeConvenience: scoreRouteConvenience(route.connectionType),
    budgetFit: scoreBudgetFit(intent.budgetBand, route.indicativeFareBand),
    loyaltyValue: scoreLoyaltyValue(route.lotusmilesIndicative?.earnBand),
    promotionBoost: scorePromotion(route.promotion, now),
  };
  const weights = SCORE_WEIGHTS[intent.priority];
  const weightedTotal = roundOneDecimal(
    FACTORS.reduce((total, factor) => total + factors[factor] * weights[factor], 0),
  );
  const reasonTraces = buildReasonTraces(intent, route, factors);

  return {
    route,
    reasonTraces,
    score: {
      ...factors,
      weightedTotal,
      weightsUsed: { ...weights },
      reasons: reasonTraces.map((reason) => reason.text),
    },
  };
}

export function scoreIntentMatch(
  intentStyles: TravelStyle[],
  routeStyles: TravelStyle[],
): number {
  if (intentStyles.length === 1 && intentStyles[0] === "mixed") return 70;
  if (intentStyles.length === 0) return 0;
  const matches = intentStyles.filter((style) => routeStyles.includes(style)).length;
  return roundOneDecimal((matches / intentStyles.length) * 100);
}

export function scoreDateFit(
  start: string,
  end: string,
  route: Pick<RouteRecord, "bestMonths" | "shoulderMonths">,
): number {
  if (route.bestMonths.length === 0) return 50;
  const months = monthsTouchedByWindow(start, end);
  if (months.some((month) => route.bestMonths.includes(month))) return 100;
  if (route.shoulderMonths?.some((month) => months.includes(month))) return 70;
  return 40;
}

export function scoreRouteConvenience(
  connectionType: RouteRecord["connectionType"],
): number {
  switch (connectionType) {
    case "direct":
      return 100;
    case "one_stop":
      return 70;
    case "two_stop":
      return 40;
  }
}

export function scoreBudgetFit(intentBand: BudgetBand, routeBand: BudgetBand): number {
  const distance = Math.abs(BAND_ORDER.indexOf(intentBand) - BAND_ORDER.indexOf(routeBand));
  return distance === 0 ? 100 : distance === 1 ? 60 : 20;
}

export function scoreLoyaltyValue(
  earnBand: "low" | "mid" | "high" | undefined,
): number {
  switch (earnBand) {
    case "low":
      return 35;
    case "mid":
      return 65;
    case "high":
      return 100;
    default:
      return 0;
  }
}

export function scorePromotion(
  promotion: RouteRecord["promotion"],
  now: Date,
): number {
  if (!promotion) return 0;
  if (!promotion.validUntil) return 100;
  return promotion.validUntil >= toIsoDate(now) ? 100 : 0;
}

function buildReasonTraces(
  intent: TripIntent,
  route: RouteRecord,
  factors: Record<ScoreFactor, number>,
): ReasonTrace[] {
  const matchedStyles = intent.travelStyles.filter((style) =>
    route.tripArchetypes.includes(style),
  );
  const styleText = buildStyleReason(intent.travelStyles, matchedStyles, factors.intentMatch);

  const connectionText = connectionReasonText(route.connectionType, route.viaHub);

  const dateText =
    factors.dateFit === 100
      ? `Your date window overlaps the route's listed best travel months (${formatMonths(route.bestMonths)}).`
      : factors.dateFit === 70
        ? `Your date window falls in the route's listed shoulder months (${formatMonths(route.shoulderMonths ?? [])}).`
        : factors.dateFit === 50
          ? "No structured best-month signal is recorded for this route, so seasonal fit is treated neutrally."
          : "Your date window does not overlap the route's listed best or shoulder months.";

  const fourth = route.promotion && factors.promotionBoost === 100
    ? {
        text: `The curated record includes the promotion “${route.promotion.title}”.`,
        sourceFields: ["route.promotion"],
      }
    : {
        text: `The destination record notes: ${route.gettingAround}`,
        sourceFields: ["route.gettingAround"],
      };

  return [
    {
      text: styleText,
      sourceFields: ["route.tripArchetypes", "intent.travelStyles"],
    },
    {
      text: connectionText,
      sourceFields: ["route.connectionType", "route.viaHub"],
    },
    {
      text: dateText,
      sourceFields: ["route.bestMonths", "route.shoulderMonths", "intent.dateWindow"],
    },
    fourth,
  ];
}

function buildStyleReason(
  intentStyles: TravelStyle[],
  matchedStyles: TravelStyle[],
  intentMatch: number,
): string {
  if (intentStyles.length === 1 && intentStyles[0] === "mixed") {
    return "Mixed-trip intent is treated as a neutral 70-point style fit for this route.";
  }

  if (matchedStyles.length === intentStyles.length) {
    return `The route matches all requested trip styles: ${matchedStyles
      .map(formatTravelStyle)
      .join(" and ")}.`;
  }

  if (matchedStyles.length > 0) {
    return `The route matches ${matchedStyles
      .map(formatTravelStyle)
      .join(" and ")}, but not every requested trip style (intent-match score ${intentMatch}).`;
  }

  return `The route is a weak style fit: none of the requested trip styles (${intentStyles
    .map(formatTravelStyle)
    .join(", ")}) appears in its archetypes.`;
}

function monthsTouchedByWindow(start: string, end: string): number[] {
  const first = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  const months = new Set<number>();
  const cursor = new Date(first);
  let guard = 0;
  while (cursor <= last && guard < 370) {
    months.add(cursor.getUTCMonth() + 1);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return [...months];
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTravelStyle(style: TravelStyle): string {
  return style.replaceAll("_", " ");
}

function formatMonths(months: number[]): string {
  return months.length > 0 ? months.join(", ") : "none recorded";
}
