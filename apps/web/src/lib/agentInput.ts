import type { OriginCity, TravelStyle } from "@shared/types";
import type { AgentWidget, DestinationHint, TripDraft } from "./agentFlow";

export type AgentInputKind = "greeting" | "too_short" | "trip";

const TRIP_SIGNAL =
  /\b(?:SYD|MEL|PER|Sydney|Melbourne|Perth|visit|family|beach|food|hanoi|saigon|ho chi minh|da nang|danang|cà mau|ca mau|april|november|adult|trip|fly|gateway)\b/i;

export function classifyAgentInput(text: string): AgentInputKind {
  const t = text.trim();
  if (!t) return "too_short";

  if (/^(?:hi|hello|hey|chào|xin chào|yo|sup)\b[!.?\s]*$/i.test(t)) {
    return "greeting";
  }

  if (t.length < 14 && !TRIP_SIGNAL.test(t)) {
    return "too_short";
  }

  return "trip";
}

export function agentReplyForInput(kind: Exclude<AgentInputKind, "trip">): string {
  if (kind === "greeting") {
    return "Hi! Tell me about your Vietnam trip — where you're leaving from, when, and what you're trying to do. I'll build your panel on the right when I have enough.";
  }
  return "Add a little more — city you're leaving from, when, and what you're planning. Example: “Melbourne, visit family in Cà Mau, April, 2 adults.”";
}

export function friendlyApiError(message: string): string {
  if (/extract enough trip fields|UNPARSEABLE|too thin/i.test(message)) {
    return agentReplyForInput("too_short");
  }
  if (/EMPTY_INPUT/i.test(message)) {
    return "Tell me about your trip — origin, dates, and what you're planning in Vietnam.";
  }
  return message;
}

export function parseOrigin(text: string): OriginCity | undefined {
  if (/\bmelbourne|\bmel\b/i.test(text)) return "MEL";
  if (/\bperth|\bper\b/i.test(text)) return "PER";
  if (/\bsydney|\bsyd\b/i.test(text)) return "SYD";
  return undefined;
}

export function parseTravelStyle(text: string): TravelStyle | undefined {
  if (/\bfamily|vfr|visit(?:ing)?\s+family|thăm/i.test(text)) return "vfr";
  if (/\bbeach|coast|relax|central coast/i.test(text)) return "beach_relaxation";
  if (/\bfood|street food|culture|eating/i.test(text)) return "food_culture";
  return undefined;
}

export function parseDestinationHint(text: string): DestinationHint | undefined {
  if (/\bc[aà]\s*mau|ca mau|mekong|deep south|family.*south|south.*family/i.test(text)) {
    return "family_south";
  }
  if (/\bda nang|danang|hoi an|central coast|beach/i.test(text)) return "beach_central";
  if (/\bhanoi|saigon|ho chi minh|street food/i.test(text)) return "food_city";
  return undefined;
}

export function mergeTextIntoDraft(text: string, draft: TripDraft): TripDraft {
  const next = { ...draft };
  // A newly mentioned value must win over whatever was already in the draft —
  // otherwise "I fly from Perth" can never correct an origin the user (or a
  // persona seed) already set, which silently no-ops the whole message even
  // though the chat reports success. travellers/monthHint below already got
  // this right; origin/travelStyle/destinationHint previously used `??` and
  // so could only ever fill a blank, never change an existing value.
  next.origin = parseOrigin(text) ?? next.origin;
  next.travelStyle = parseTravelStyle(text) ?? next.travelStyle;
  next.destinationHint = parseDestinationHint(text) ?? next.destinationHint;

  const paxMatch = text.match(/(\d+)\s*adult/i);
  if (paxMatch) next.travellers = parseInt(paxMatch[1], 10);

  const monthMatch = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  );
  if (monthMatch) next.monthHint = monthMatch[1][0].toUpperCase() + monthMatch[1].slice(1).toLowerCase();

  return next;
}

export function hasEnoughForCanvas(draft: TripDraft, text: string): boolean {
  const merged = mergeTextIntoDraft(text, draft);
  const origin = merged.origin ?? parseOrigin(text);
  if (!origin) return false;

  const hasDestination =
    merged.destinationHint ||
    parseDestinationHint(text) ||
    /\b(hanoi|saigon|ho chi minh|da nang|danang|c[aà]\s*mau|ca mau)\b/i.test(text);

  const hasPurpose =
    merged.travelStyle ||
    parseTravelStyle(text) ||
    hasDestination;

  if (text.trim().length >= 28 && origin && (hasPurpose || hasDestination)) return true;
  if (origin && hasDestination) return true;
  if (origin && merged.travelStyle && text.trim().length >= 18) return true;

  return false;
}

export function whatToAsk(
  draft: TripDraft,
  text: string,
): { reply: string; widget?: AgentWidget } {
  const merged = mergeTextIntoDraft(text, draft);

  if (!merged.origin) {
    return {
      reply: "Which Australian city are you flying from?",
      widget: { type: "pick_origin" },
    };
  }

  const hasDestination = merged.destinationHint || parseDestinationHint(text);
  const hasPurpose = merged.travelStyle || parseTravelStyle(text);

  if (merged.travelStyle === "vfr" && !hasDestination) {
    return {
      reply: "Visiting family — which province or area? Cà Mau and the Mekong delta usually fly in via Saigon.",
      widget: { type: "pick_destination" },
    };
  }

  if (!hasPurpose && !hasDestination) {
    return {
      reply: "What kind of trip — visiting family, beach, or food & culture? Type it or tap one:",
      widget: { type: "pick_vibe" },
    };
  }

  return {
    reply: "Almost there — where in Vietnam, when roughly, and how many adults?",
  };
}
