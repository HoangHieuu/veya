import localityGatewayData from "../../../../data/locality-gateway.json";
import {
  hasVisitLocationContext,
  normalizeLocalityGateway,
  type LocalityGatewayData,
} from "@shared/localityGateway";
import type { TripIntent } from "@shared/types";

const LOCALITY = normalizeLocalityGateway(
  localityGatewayData as Parameters<typeof normalizeLocalityGateway>[0],
) as LocalityGatewayData;

export function isVfrTrip(intent: TripIntent): boolean {
  return (
    intent.travelStyles.includes("vfr") ||
    intent.travelStyles.includes("family") ||
    hasVisitLocationContext(intent.rawSummary, LOCALITY)
  );
}
