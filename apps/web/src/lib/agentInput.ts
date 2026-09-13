import type { DestinationCity, OriginCity, TravelStyle } from "@shared/types";
import {
  extractMentionedLocalities,
  inferGatewayFromLocalities,
  normalizeLocalityGateway,
} from "@shared/localityGateway";
import localityGatewayData from "../../../../data/locality-gateway.json";
import type { AgentWidget, DestinationHint, TripDraft } from "./agentFlow";
import { tripToBrief, type TripSummary } from "./agentWorkspace";

const LOCALITY = normalizeLocalityGateway(
  localityGatewayData as Parameters<typeof normalizeLocalityGateway>[0],
);

function slugifyLocality(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseLocalityMention(
  text: string,
): { title: string; gateway: DestinationCity; id: string } | undefined {
  const titles = extractMentionedLocalities(text, LOCALITY);
  if (!titles.length) return undefined;
  const gateway = inferGatewayFromLocalities(text, LOCALITY);
  if (!gateway) return undefined;
  const title = titles[0];
  return { title, gateway, id: slugifyLocality(title) };
}

function gatewayLabel(gateway: DestinationCity): string {
  if (gateway === "HAN") return "Hanoi (HAN)";
  if (gateway === "DAD") return "Da Nang (DAD)";
  return "Saigon (SGN)";
}

export type AgentInputKind = "greeting" | "too_short" | "trip";

const TRIP_SIGNAL =
  /\b(?:SYD|MEL|PER|Sydney|Melbourne|Perth|visit|family|beach|food|hanoi|saigon|ho chi minh|da nang|danang|cà mau|ca mau|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|adult|child|children|kids|trip|fly|gateway)\b/i;

const MONTH_ABBR: Record<string, string> = {
  jan: "January",
  feb: "February",
  mar: "March",
  apr: "April",
  may: "May",
  jun: "June",
  jul: "July",
  aug: "August",
  sep: "September",
  sept: "September",
  oct: "October",
  nov: "November",
  dec: "December",
};

const MONTH_BY_NUM = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function capitalizeMonth(name: string): string {
  return name[0].toUpperCase() + name.slice(1).toLowerCase();
}

/** Parse when-travel hints: full month, abbreviations, dd/mm/yyyy, "22 oct". */
export function parseMonthHint(text: string): string | undefined {
  const dmy = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const monthNum = parseInt(dmy[2], 10);
    if (monthNum >= 1 && monthNum <= 12) {
      const yearRaw = dmy[3];
      const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
      const monthName = MONTH_BY_NUM[monthNum - 1];
      return `${day} ${monthName} ${year}`;
    }
  }

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const year = iso[1];
    const monthNum = parseInt(iso[2], 10);
    const day = parseInt(iso[3], 10);
    if (monthNum >= 1 && monthNum <= 12) {
      const monthName = new Date(Number(year), monthNum - 1, 1).toLocaleString("en-AU", {
        month: "long",
      });
      return `${day} ${monthName} ${year}`;
    }
  }

  const full = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  );
  if (full) {
    const month = capitalizeMonth(full[1]);
    const dayYear =
      text.match(/\b(\d{1,2})\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?\b/i) ??
      text.match(
        /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:\s+(\d{4}))?\b/i,
      );
    if (dayYear) {
      const day = dayYear[1];
      const year = dayYear[2];
      return year ? `${day} ${month} ${year}` : `${day} ${month}`;
    }
    return month;
  }

  const abbrDayFirst = text.match(
    /\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i,
  );
  if (abbrDayFirst) {
    const month = MONTH_ABBR[abbrDayFirst[2].toLowerCase()];
    return `${abbrDayFirst[1]} ${month}`;
  }

  const abbrDaySecond = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s*(\d{1,2})(?:\s+(\d{4}))?\b/i,
  );
  if (abbrDaySecond) {
    const month = MONTH_ABBR[abbrDaySecond[1].toLowerCase()];
    const year = abbrDaySecond[3];
    return year
      ? `${abbrDaySecond[2]} ${month} ${year}`
      : `${abbrDaySecond[2]} ${month}`;
  }

  const abbrOnly = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i);
  if (abbrOnly) return MONTH_ABBR[abbrOnly[1].toLowerCase()];

  return undefined;
}

export function parseTravellers(text: string, fallback = 2): number {
  const adultMatch = text.match(/(\d+)\s*adults?\b/i);
  if (adultMatch) return parseInt(adultMatch[1], 10);
  const withMatch = text.match(/\bwith\s+(\d+)\s+adults?\b/i);
  if (withMatch) return parseInt(withMatch[1], 10);
  const peopleMatch = text.match(/\b(\d+)\s*(?:people|pax|travellers?|guests?)\b/i);
  if (peopleMatch) return parseInt(peopleMatch[1], 10);
  return fallback;
}

export function parseChildCount(text: string): number | undefined {
  const m = text.match(/(\d+)\s*(?:child|children|kid|kids)\b/i);
  return m ? parseInt(m[1], 10) : undefined;
}

const DESTINATION_IN_TEXT =
  /\b(hanoi|saigon|ho chi minh|da nang|danang|c[aà]\s*mau|ca mau|phu quoc|nha trang)\b/i;

export function classifyAgentInput(text: string): AgentInputKind {
  const t = text.trim();
  if (!t) return "too_short";

  if (/^(?:hi|hello|hey|chào|xin chào|yo|sup)\b[!.?\s]*$/i.test(t)) {
    return "greeting";
  }

  if (
    t.length < 14 &&
    !TRIP_SIGNAL.test(t) &&
    !parseLocalityMention(t) &&
    !parseMonthHint(t) &&
    !/\d+\s*adults?\b/i.test(t)
  ) {
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
  next.origin = next.origin ?? parseOrigin(text);
  next.travelStyle = next.travelStyle ?? parseTravelStyle(text);
  next.destinationHint = next.destinationHint ?? parseDestinationHint(text);

  if (/\d+\s*adults?\b/i.test(text) || /\bwith\s+\d+\s+adults?\b/i.test(text)) {
    next.travellers = parseTravellers(text, next.travellers);
  }

  const monthHint = parseMonthHint(text);
  if (monthHint) next.monthHint = monthHint;

  const locality = parseLocalityMention(text);
  if (locality) {
    next.localityNote = next.localityNote ?? locality.title;
    if (/\bc[aà]\s*mau|ca mau|mekong|deep south/i.test(text)) {
      next.destinationHint = next.destinationHint ?? "family_south";
    }
  }

  return next;
}

/** Merge chat text into full trip state (draft + destination title / gateway from locality data). */
export function mergeTextIntoTrip(text: string, trip: TripSummary): TripSummary {
  const next: TripSummary = { ...trip, ...mergeTextIntoDraft(text, trip) };
  const locality = parseLocalityMention(text);
  if (!locality) return next;

  next.localityNote = locality.title;
  next.destinationTitle = next.destinationTitle ?? locality.title;
  next.gateway = next.gateway ?? locality.gateway;
  next.destinationLocalityId = next.destinationLocalityId ?? locality.id;

  if (!next.destinationHint && next.travelStyle === "vfr" && locality.gateway === "SGN") {
    if (/c[aà]\s*mau|ca mau|mekong|can tho|cần thơ/i.test(text)) {
      next.destinationHint = "family_south";
    }
  }

  return next;
}

function hasDestinationInDraft(draft: TripDraft, text: string): boolean {
  return Boolean(
    draft.destinationHint ||
      draft.localityNote ||
      parseDestinationHint(text) ||
      parseLocalityMention(text) ||
      DESTINATION_IN_TEXT.test(text),
  );
}

/** True when a recommend/handoff call makes sense — needs schedule + destination, not just vibe. */
export function hasEnoughForRecommend(
  draft: TripDraft,
  text: string,
  trip?: Pick<TripSummary, "destinationTitle">,
): boolean {
  const merged = mergeTextIntoDraft(text, draft);
  if (!merged.origin || !merged.monthHint || merged.travellers < 1) return false;
  if (hasDestinationInDraft(merged, text) || trip?.destinationTitle) return true;

  // One-shot freeform brief typed in chat (not widget fragments).
  if (
    text.trim().length >= 28 &&
    parseOrigin(text) &&
    (parseTravelStyle(text) || parseDestinationHint(text) || DESTINATION_IN_TEXT.test(text))
  ) {
    return true;
  }

  return false;
}

/** @deprecated Use hasEnoughForRecommend — kept for imports during transition */
export function hasEnoughForCanvas(draft: TripDraft, text: string): boolean {
  return hasEnoughForRecommend(draft, text);
}

export function buildRecommendBrief(text: string, trip: TripSummary): string {
  const selfContained =
    text.trim().length >= 28 &&
    Boolean(parseOrigin(text)) &&
    (Boolean(parseTravelStyle(text)) ||
      Boolean(parseDestinationHint(text)) ||
      Boolean(parseLocalityMention(text)) ||
      DESTINATION_IN_TEXT.test(text));

  if (selfContained) return text.trim();
  return tripToBrief(trip);
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

  const hasDestination = hasDestinationInDraft(merged, text);
  const hasPurpose = Boolean(merged.travelStyle || parseTravelStyle(text));
  const hasSchedule = Boolean(merged.monthHint && merged.travellers >= 1);

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

  const localityTitle = merged.localityNote ?? parseLocalityMention(text)?.title;
  const localityGateway = tripGatewayFromDraft(text);

  if (localityTitle && !hasSchedule) {
    return {
      reply: `${localityTitle} — fly into ${gatewayLabel(localityGateway ?? "SGN")}. When roughly, and how many adults?`,
    };
  }

  if (!hasSchedule) {
    return {
      reply: "When roughly, and how many adults?",
    };
  }

  if (!hasDestination) {
    const origin =
      merged.origin === "MEL" ? "Melbourne" : merged.origin === "PER" ? "Perth" : "Sydney";
    const vibe =
      merged.travelStyle === "beach_relaxation"
        ? "beach"
        : merged.travelStyle === "food_culture"
          ? "food & culture"
          : merged.travelStyle === "vfr"
            ? "family visit"
            : "trip";
    return {
      reply: `Got it — ${origin}, ${vibe}, ${merged.monthHint}, ${merged.travellers} adult${merged.travellers > 1 ? "s" : ""}. Pick a destination in the centre to continue.`,
    };
  }

  if (localityTitle && hasSchedule) {
    const childNote = parseChildCount(text);
    const childSuffix =
      childNote && childNote > 0
        ? ` (+ ${childNote} child${childNote > 1 ? "ren" : ""})`
        : "";
    return {
      reply: `Got it — ${localityTitle}, ${merged.monthHint}, ${merged.travellers} adult${merged.travellers > 1 ? "s" : ""}${childSuffix}. Review the centre panel or add anything else in chat.`,
    };
  }

  return {
    reply: "Almost there — confirm your destination in the centre or add any last details in chat.",
  };
}

function tripGatewayFromDraft(text: string): DestinationCity | undefined {
  return parseLocalityMention(text)?.gateway ?? inferGatewayFromLocalities(text, LOCALITY);
}
