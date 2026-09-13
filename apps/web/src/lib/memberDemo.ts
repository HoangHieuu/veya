import type { OriginCity, TravelStyle } from "@shared/types";
import type { DestinationHint } from "./agentFlow";

export type MemberDemoProfile =
  | "guest"
  | "lotusmiles_member"
  | "lotustudents_verified";

export type MemberTierTone = "guest" | "gold" | "student";

export interface MemberDemoPersona {
  displayName: string;
  programLabel: string;
  tierLabel: string;
  tierTone: MemberTierTone;
  memberId?: string;
  milesBalance?: number;
  since?: string;
  note?: string;
  /** Typical trip intent for this demo persona */
  intentSummary: string;
  defaultOrigin: OriginCity;
  defaultTravelStyle: TravelStyle;
}

/** Full trip seed + brief aligned with each demo customer */
export interface PersonaTripSeed {
  origin: OriginCity;
  travelStyle: TravelStyle;
  travellers: number;
  monthHint: string;
  destinationHint?: DestinationHint;
  localityNote?: string;
  briefText: string;
  openingText: string;
}

export const MEMBER_LABELS: Record<MemberDemoProfile, string> = {
  guest: "Guest",
  lotusmiles_member: "Lotusmiles member",
  lotustudents_verified: "LotuStudents verified",
};

export const MEMBER_PERSONAS: Record<MemberDemoProfile, MemberDemoPersona> = {
  guest: {
    displayName: "Guest traveller",
    programLabel: "Not signed in",
    tierLabel: "Guest",
    tierTone: "guest",
    note: "Join Lotusmiles to unlock bonus miles on direct bookings.",
    intentSummary: "Exploring Vietnam · pick origin and vibe first",
    defaultOrigin: "SYD",
    defaultTravelStyle: "mixed",
  },
  lotusmiles_member: {
    displayName: "Minh Nguyen",
    programLabel: "Lotusmiles",
    tierLabel: "Gold",
    tierTone: "gold",
    memberId: "884 291 445",
    milesBalance: 14280,
    since: "Member since 2019",
    intentSummary: "VFR to Mekong Delta · prefers direct routes & miles earn",
    defaultOrigin: "MEL",
    defaultTravelStyle: "vfr",
  },
  lotustudents_verified: {
    displayName: "Alex Tran",
    programLabel: "LotuStudents",
    tierLabel: "Verified",
    tierTone: "student",
    memberId: "LS-AU-2847",
    milesBalance: 3200,
    since: "Verified student · UTS Sydney",
    intentSummary: "Student break · street food & culture, budget-conscious",
    defaultOrigin: "SYD",
    defaultTravelStyle: "food_culture",
  },
};

export const MEMBER_PROFILE_OPTIONS: MemberDemoProfile[] = [
  "guest",
  "lotusmiles_member",
  "lotustudents_verified",
];

export const PERSONA_TRIP_SEEDS: Record<MemberDemoProfile, PersonaTripSeed> = {
  guest: {
    origin: "SYD",
    travelStyle: "mixed",
    travellers: 2,
    monthHint: "",
    briefText:
      "Example brief — type your own: origin, vibe, dates, adults…",
    openingText:
      "Hi — where are you flying from in Australia? Use the globe below, then explore destinations in the centre →",
  },
  lotusmiles_member: {
    origin: "MEL",
    travelStyle: "vfr",
    travellers: 2,
    monthHint: "April",
    destinationHint: "family_south",
    localityNote: "Cà Mau",
    briefText:
      "Melbourne, visit family in Cà Mau, April, 2 adults — one stop max, prefer direct routes and miles earn.",
    openingText:
      "Hi Minh — visiting family in the Mekong Delta from Melbourne in April. Pick a destination in the centre or refine in chat →",
  },
  lotustudents_verified: {
    origin: "SYD",
    travelStyle: "food_culture",
    travellers: 2,
    monthHint: "November",
    destinationHint: "food_city",
    briefText:
      "Sydney, street food and culture trip in November — 2 adults, budget-conscious student break.",
    openingText:
      "Hi Alex — food and culture from Sydney in November for two. Explore cities in the centre or tell me more →",
  },
};

export function getMemberPersona(profile: MemberDemoProfile): MemberDemoPersona {
  return MEMBER_PERSONAS[profile];
}

export function getPersonaTripSeed(profile: MemberDemoProfile): PersonaTripSeed {
  return PERSONA_TRIP_SEEDS[profile];
}

export function memberInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatMiles(n: number): string {
  return new Intl.NumberFormat("en-AU").format(n);
}

export function isMember(profile: MemberDemoProfile): boolean {
  return profile !== "guest";
}

/** Member demos load a seeded brief; guest starts blank with the origin globe. */
export function shouldSeedTripFromProfile(profile: MemberDemoProfile): boolean {
  return profile !== "guest";
}
