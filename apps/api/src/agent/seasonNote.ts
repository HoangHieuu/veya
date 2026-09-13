import type { MonthName, SeasonNote } from "../../../../shared/types.js";
import { monthNumber, type AgentDataSnapshot, type AgentSeasonRecord } from "./data.js";

/** Build an illustrative seasonal note from B data; never calls a weather API. */
export function buildSeasonNote(
  localityId: string,
  month: MonthName,
  data: AgentDataSnapshot,
  gateway?: AgentSeasonRecord["gateway"],
): SeasonNote | undefined {
  const monthValue = monthNumber(month);
  const record = data.seasons.find((candidate) => {
    const localityMatches = candidate.localityId === localityId;
    const gatewayMatches = gateway !== undefined && candidate.gateway === gateway;
    return (localityMatches || gatewayMatches) && candidate.month === monthValue;
  });
  if (!record) return undefined;
  return {
    localityId,
    month,
    headline: record.headline,
    summary: record.summary,
    bestMonths: [...record.bestMonths],
    caveats: [...record.caveats],
    sourceFields: [...record.sourceFields],
  };
}
