import localityGatewayData from "../../../../data/locality-gateway.json";
import {
  inferGatewayFromLocalities,
  normalizeLocalityGateway,
  type LocalityGatewayData,
} from "@shared/localityGateway";
import type { RankedResponse } from "@shared/types";

const LOCALITY_GATEWAY = normalizeLocalityGateway(
  localityGatewayData as Parameters<typeof normalizeLocalityGateway>[0],
) as LocalityGatewayData;

/** Narrow mock ranked cards when a brief names a Vietnamese locality (e.g. Cà Mau → SGN). */
export function applyMockBriefLocality(
  data: RankedResponse,
  briefText: string,
): void {
  const gateway = inferGatewayFromLocalities(briefText, LOCALITY_GATEWAY);
  if (!gateway) return;

  data.intent.goal = "choose_route";
  data.intent.preferredDestination = gateway;
  if (!data.intent.travelStyles.includes("vfr")) {
    data.intent.travelStyles = [...data.intent.travelStyles, "vfr"];
  }

  const origin = data.intent.originCity;
  const template =
    data.cards.find((c) => c.route.destinationCity === gateway) ?? data.cards[0];
  if (!template) return;

  const card = structuredClone(template);
  card.rank = 1;
  card.route = {
    ...card.route,
    originCity: origin,
    originAirport: origin,
    destinationCity: gateway,
    destinationAirport: gateway,
    id: `${origin}-${gateway}-${card.route.connectionType}`,
  };
  data.cards = [card];
}
