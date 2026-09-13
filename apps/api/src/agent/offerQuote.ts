import type {
  DiscoveryMode,
  OfferQuote,
  RankedResponse,
  TripSummary,
} from "../../../../shared/types.js";
import type { AgentDataSnapshot } from "./data.js";

export type OfferIneligibleReason =
  | "ROUTE_KNOWN"
  | "DIRECT_ROUTE_REQUIRED"
  | "NO_ILLUSTRATIVE_FARE";

export interface BuildOfferQuoteInput {
  trip: TripSummary;
  recommendation: RankedResponse;
  discoveryMode: DiscoveryMode;
  data: AgentDataSnapshot;
  now: Date;
}

/** Build the demo offer from approved B snapshots; member profile is display-only. */
export function buildOfferQuote(
  input: BuildOfferQuoteInput,
): OfferQuote | undefined {
  const card = input.recommendation.cards[0];
  const policy = input.data.directOfferPolicy;
  if (
    !card ||
    !policy ||
    !Number.isFinite(policy.discountPct) ||
    policy.discountPct < 0 ||
    policy.discountPct > 100 ||
    !Number.isFinite(policy.expiryHours) ||
    policy.expiryHours <= 0
  ) return undefined;

  const fare = input.data.fares.find((candidate) => candidate.routeId === card.routeId);
  if (!fare || !Number.isFinite(fare.publicFareAud) || fare.publicFareAud <= 0) return undefined;

  const sourceFields = [
    ...fare.sourceFields,
    "data/policies/direct-decision-offer.json",
  ];
  const ineligibleReason: OfferIneligibleReason | undefined =
    input.discoveryMode !== "discovery"
      ? "ROUTE_KNOWN"
      : card.route.connectionType !== "direct"
        ? "DIRECT_ROUTE_REQUIRED"
        : undefined;
  const eligible = ineligibleReason === undefined;
  const discountPct = eligible ? policy.discountPct : 0;
  const offerFareAud = roundCurrency(
    fare.publicFareAud * (1 - discountPct / 100),
  );
  return {
    eligible,
    ...(ineligibleReason
      ? { ineligibleReason: reasonText(ineligibleReason) }
      : {}),
    publicFareAud: roundCurrency(fare.publicFareAud),
    offerFareAud,
    discountPct,
    expiresAt: new Date(
      input.now.getTime() + policy.expiryHours * 60 * 60 * 1000,
    ).toISOString(),
    termsId: policy.id,
    illustrative: true,
    sourceDocument: policy.sourceDocument,
    sourceFields,
  };
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function reasonText(reason: OfferIneligibleReason): string {
  switch (reason) {
    case "ROUTE_KNOWN":
      return "Direct Decision Offer is available only while discovering a destination.";
    case "DIRECT_ROUTE_REQUIRED":
      return "This offer is limited to direct itineraries.";
    case "NO_ILLUSTRATIVE_FARE":
      return "No approved illustrative fare is available for this route.";
  }
}
