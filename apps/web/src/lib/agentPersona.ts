import type { TripSummary } from "./agentWorkspace";
import { emptyTripSummary } from "./agentWorkspace";
import {
  getPersonaTripSeed,
  type MemberDemoProfile,
} from "./memberDemo";

export function tripFromPersona(profile: MemberDemoProfile): TripSummary {
  const seed = getPersonaTripSeed(profile);
  return {
    ...emptyTripSummary(profile),
    origin: seed.origin,
    travelStyle: seed.travelStyle,
    travellers: seed.travellers,
    monthHint: seed.monthHint,
    destinationHint: seed.destinationHint,
    localityNote: seed.localityNote,
  };
}
