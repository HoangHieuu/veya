import type { OriginCity, TravelStyle } from "@shared/types";

export type DestinationHint =
  | "compare_gateways"
  | "family_south"
  | "beach_central"
  | "food_city";

export interface TripDraft {
  origin?: OriginCity;
  travelStyle?: TravelStyle;
  destinationHint?: DestinationHint;
  localityNote?: string;
  travellers: number;
  monthHint?: string;
}

export type AgentWidget =
  | { type: "pick_origin" }
  | { type: "pick_vibe" }
  | { type: "pick_destination" }
  | { type: "pick_travellers" };

export const ORIGIN_OPTIONS: { value: OriginCity; label: string }[] = [
  { value: "SYD", label: "Sydney" },
  { value: "MEL", label: "Melbourne" },
  { value: "PER", label: "Perth" },
];

export const VIBE_OPTIONS: { value: TravelStyle; label: string; hint: string }[] = [
  { value: "vfr", label: "Visit family", hint: "VFR — province or hometown" },
  { value: "beach_relaxation", label: "Beach & relax", hint: "Coast and easy pace" },
  { value: "food_culture", label: "Food & culture", hint: "City life and eating" },
  { value: "mixed", label: "Not sure yet", hint: "Compare gateways" },
];

export const DESTINATION_OPTIONS: {
  value: DestinationHint;
  label: string;
  hint: string;
}[] = [
  {
    value: "compare_gateways",
    label: "Compare Hanoi, Saigon, Da Nang",
    hint: "Still deciding where to fly in",
  },
  {
    value: "family_south",
    label: "Family in the south",
    hint: "e.g. Cà Mau, Mekong — fly via Saigon",
  },
  {
    value: "beach_central",
    label: "Beach & central coast",
    hint: "Da Nang area, Hoi An",
  },
  {
    value: "food_city",
    label: "City & street food",
    hint: "Saigon or Hanoi",
  },
];

export function emptyDraft(): TripDraft {
  return { travellers: 2, monthHint: "April" };
}

export function nextWidget(draft: TripDraft): AgentWidget | null {
  if (!draft.origin) return { type: "pick_origin" };
  if (!draft.travelStyle) return { type: "pick_vibe" };
  if (!draft.destinationHint) return { type: "pick_destination" };
  return null;
}

export function draftToBrief(draft: TripDraft): string {
  const city = draft.origin ?? "SYD";
  const originName =
    city === "MEL" ? "Melbourne" : city === "PER" ? "Perth" : "Sydney";
  const when = draft.monthHint ?? "April";
  const pax = draft.travellers;

  if (draft.destinationHint === "family_south") {
    return `${originName}, visit family in Cà Mau, ${when}, ${pax} adults — one stop max.`;
  }
  if (draft.destinationHint === "beach_central") {
    return `${originName}, beach trip with a friend in ${when} — thinking Da Nang or coast, low hassle.`;
  }
  if (draft.destinationHint === "food_city") {
    return `${originName}, food-focused trip in ${when}, ${pax} travellers — Saigon or Hanoi.`;
  }
  if (draft.travelStyle === "vfr") {
    return `${originName}, visiting family in Vietnam, ${when}, ${pax} adults.`;
  }
  return `${originName}, ${when}, ${pax} travellers — not sure Hanoi, Ho Chi Minh City, or Da Nang. Beach and food.`;
}

export function labelForDraft(draft: TripDraft): string {
  const parts: string[] = [];
  if (draft.origin) parts.push(draft.origin);
  if (draft.travelStyle) parts.push(draft.travelStyle.replace(/_/g, " "));
  if (draft.destinationHint) parts.push(draft.destinationHint.replace(/_/g, " "));
  return parts.join(" · ") || "your trip";
}
