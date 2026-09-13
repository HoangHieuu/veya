import type {
  DestinationCity,
  LocalityResolution,
} from "../../../../shared/types.js";
import type { AgentDataSnapshot, AgentLocalityRecord } from "./data.js";

const GATEWAYS: readonly DestinationCity[] = ["HAN", "SGN", "DAD"];

/** Resolve a selected locality or exact text mention without fuzzy guessing. */
export function resolveLocalityGateway(
  query: string,
  data: AgentDataSnapshot,
): LocalityResolution | undefined {
  const normalized = normalize(query);
  if (!normalized) return undefined;

  const locality = data.localities.find((candidate) =>
    [candidate.id, candidate.title, ...candidate.aliases].some(
      (value) => normalize(value) === normalized,
    ),
  );
  return locality ? toResolution(locality) : undefined;
}

export function resolveLocalityGatewayFromRecord(
  locality: AgentLocalityRecord,
): LocalityResolution {
  return toResolution(locality);
}

function toResolution(locality: AgentLocalityRecord): LocalityResolution {
  return {
    localityId: locality.id,
    localityTitle: locality.title,
    gateway: locality.gateway,
    ruledOut: GATEWAYS.filter((gateway) => gateway !== locality.gateway).map((gateway) => ({
      gateway,
      reason: `The curated locality mapping points to ${locality.gateway} as the gateway for ${locality.title}.`,
    })),
    onwardNote: locality.onwardNote,
    sourceFields: [...locality.sourceFields, "locality.gateway"],
  };
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
