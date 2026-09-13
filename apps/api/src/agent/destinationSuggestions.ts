import type {
  DestinationSuggestion,
  OriginCity,
  TravelStyle,
} from "../../../../shared/types.js";
import type { AgentDataSnapshot, DestinationSuggestionRecord } from "./data.js";

export interface DestinationSuggestionInput {
  /** Omit to show every curated destination as inspiration before an origin is known. */
  originCity?: OriginCity;
  travelStyle?: TravelStyle;
  limit?: number;
}

const STYLE_ALIASES: Readonly<Record<string, TravelStyle>> = {
  beach: "beach_relaxation",
  beaches: "beach_relaxation",
  relax: "beach_relaxation",
  food: "food_culture",
  culture: "food_culture",
  family: "family",
  education: "education",
  vfr: "vfr",
  mixed: "mixed",
};

/** Pure, deterministic spotlight builder for the center discovery canvas. */
export function buildDestinationSuggestions(
  input: DestinationSuggestionInput,
  data: AgentDataSnapshot,
): DestinationSuggestion[] {
  const limit = clampLimit(input.limit ?? 6);
  return data.destinationSuggestions
    .filter((suggestion) => supportsOrigin(suggestion, input.originCity))
    .map((suggestion) => ({
      suggestion,
      vibeMatch: input.travelStyle
        ? suggestion.tags.filter((tag) => canonicalStyle(tag) === input.travelStyle).length
        : 0,
    }))
    .sort((left, right) => {
      if (right.vibeMatch !== left.vibeMatch) return right.vibeMatch - left.vibeMatch;
      const leftPromoted = left.suggestion.promoted ? 1 : 0;
      const rightPromoted = right.suggestion.promoted ? 1 : 0;
      if (rightPromoted !== leftPromoted) return rightPromoted - leftPromoted;
      const leftWeight = left.suggestion.promotionWeight ?? 0;
      const rightWeight = right.suggestion.promotionWeight ?? 0;
      if (rightWeight !== leftWeight) return rightWeight - leftWeight;
      const leftOrder = left.suggestion.order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.suggestion.order ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.suggestion.localityId.localeCompare(right.suggestion.localityId);
    })
    .slice(0, limit)
    .map(({ suggestion }) => publicSuggestion(suggestion));
}

export function canonicalStyle(tag: string): TravelStyle | undefined {
  const normalized = tag.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return STYLE_ALIASES[normalized] ?? (normalized as TravelStyle);
}

function supportsOrigin(
  suggestion: DestinationSuggestionRecord,
  origin: OriginCity | undefined,
): boolean {
  if (!origin) return true;
  return !suggestion.supportedOrigins || suggestion.supportedOrigins.includes(origin);
}

function publicSuggestion(
  suggestion: DestinationSuggestionRecord,
): DestinationSuggestion {
  const { supportedOrigins: _origins, promotionWeight: _weight, order: _order, ...publicValue } =
    structuredClone(suggestion);
  return publicValue;
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return 6;
  return Math.max(0, Math.min(6, Math.floor(value)));
}
