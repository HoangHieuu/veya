import type { DestinationCity, OriginCity, TravelStyle } from "@shared/types";
import type { LocalityResolution } from "./agentTypes";
import type { DestinationHint, TripDraft } from "./agentFlow";
import { draftToBrief } from "./agentFlow";
import type { MemberDemoProfile } from "./memberDemo";

export type DiscoveryStage =
  | "suggested_destinations"
  | "destination_detail"
  | "season"
  | "hotels"
  | "booking";

export type PolicyOverlayId = "direct-decision-offer" | "lotusmiles" | "lotustudents";

export interface TripSummary extends TripDraft {
  memberProfile: MemberDemoProfile;
  destinationLocalityId?: string;
  destinationTitle?: string;
  gateway?: DestinationCity;
  hotelInterest?: boolean;
}

export interface DestinationSuggestion {
  id: string;
  title: string;
  subtitle: string;
  gateway: DestinationCity;
  vibes: TravelStyle[];
  spotlight?: boolean;
  tone: "south" | "central" | "north" | "any";
  /** Illustrative hero (Unsplash) — replace with B CMS assets in prod */
  imageUrl: string;
}

export type BentoShape = "portrait" | "landscape";
export type BentoLayout = "sidebar" | "sidebar4";
export type BentoSlot = "p1" | "l1" | "l2" | "l3";

export type BentoDestination = DestinationSuggestion & {
  shape: BentoShape;
  slot: BentoSlot;
};

export interface BentoBoard {
  layout: BentoLayout;
  tiles: BentoDestination[];
}

export const DESTINATION_SPOTLIGHT: DestinationSuggestion[] = [
  {
    id: "ca-mau",
    title: "Cà Mau",
    subtitle: "Mekong delta · fly via Saigon",
    gateway: "SGN",
    vibes: ["vfr", "mixed"],
    spotlight: true,
    tone: "south",
    imageUrl: "/assets/destinations/ca-mau.jpg",
  },
  {
    id: "ho-chi-minh-city",
    title: "Ho Chi Minh City",
    subtitle: "Street food & districts · direct gateway",
    gateway: "SGN",
    vibes: ["food_culture", "mixed", "vfr"],
    spotlight: true,
    tone: "south",
    imageUrl: "/assets/destinations/ho-chi-minh-city.jpg",
  },
  {
    id: "da-nang",
    title: "Da Nang",
    subtitle: "My Khe beach · Hoi An day trips",
    gateway: "DAD",
    vibes: ["beach_relaxation", "mixed"],
    spotlight: true,
    tone: "central",
    imageUrl: "/assets/da-nang-beach.jpg",
  },
  {
    id: "nha-trang",
    title: "Nha Trang",
    subtitle: "Central coast resort strip",
    gateway: "DAD",
    vibes: ["beach_relaxation"],
    tone: "central",
    imageUrl: "/assets/destinations/nha-trang.jpg",
  },
  {
    id: "hanoi",
    title: "Hanoi",
    subtitle: "Old Quarter · northern Vietnam base",
    gateway: "HAN",
    vibes: ["food_culture", "mixed", "vfr"],
    tone: "north",
    imageUrl: "/assets/destinations/hanoi.png",
  },
  {
    id: "phu-quoc",
    title: "Phu Quoc",
    subtitle: "Island escape · connect via SGN",
    gateway: "SGN",
    vibes: ["beach_relaxation"],
    tone: "south",
    imageUrl: "/assets/destinations/phu-quoc.jpg",
  },
];

export const SEASON_NOTES: Record<string, string> = {
  January: "Cool dry season in the north; south is warm with occasional rain.",
  February: "Tet season — book early; pleasant in central Vietnam.",
  March: "Dry and warm — great for Da Nang and southern beaches.",
  April: "Dry season peak — 28–32°C in the south; ideal for Mekong visits.",
  May: "Heat builds before rains; still good for Saigon city breaks.",
  June: "Start of wet season in the north; south still drier.",
  July: "Rainy central months — pack light layers for Hoi An.",
  August: "Wet season — fewer crowds; check domestic connections.",
  September: "Transition month — improving in the north.",
  October: "Dry returns to the north; excellent for Hanoi.",
  November: "Cool season begins — comfortable nationwide.",
  December: "Peak leisure season — book direct early.",
};

export interface HotelSuggestion {
  id: string;
  name: string;
  area: string;
  note: string;
}

export interface HotelSuggestionPanel {
  eyebrow: string;
  hotels: HotelSuggestion[];
}

const GATEWAY_HOTELS: Record<DestinationCity, HotelSuggestion[]> = {
  SGN: [
    {
      id: "ibis-tsn",
      name: "Ibis Saigon Airport",
      area: "Tan Son Nhat",
      note: "~5 min from TSN · earn Lotusmiles on Booking.com",
    },
    {
      id: "sheraton-tsn",
      name: "Sheraton Tan Son Nhat",
      area: "Phu Nhuan",
      note: "Airport shuttle · handy first night before heading south",
    },
    {
      id: "pullman-d1",
      name: "Pullman Saigon Centre",
      area: "District 1",
      note: "City stay if overnighting in Saigon · partner earn",
    },
  ],
  HAN: [
    {
      id: "novotel-han",
      name: "Novotel Suites Hanoi",
      area: "Near Noi Bai route",
      note: "Late arrivals · earn on Booking.com partner link",
    },
    {
      id: "metropole",
      name: "Sofitel Legend Metropole Hanoi",
      area: "Hoan Kiem",
      note: "Old Quarter base · illustrative member rate",
    },
    {
      id: "lotte-han",
      name: "Lotte Hotel Hanoi",
      area: "Ba Dinh",
      note: "Central · Lotusmiles partner stay",
    },
  ],
  DAD: [
    {
      id: "hyatt-dad",
      name: "Hyatt Regency Danang Resort",
      area: "Non Nuoc",
      note: "Near airport · good VFR stopover on central coast",
    },
    {
      id: "novotel-dad",
      name: "Novotel Danang Premier Han River",
      area: "Han River",
      note: "Gateway city · walk to food and riverfront",
    },
    {
      id: "fusion-maia",
      name: "Fusion Maia Da Nang",
      area: "My Khe Beach",
      note: "Beachfront · partner earn on Booking.com",
    },
  ],
};

const DESTINATION_HOTELS: Record<string, HotelSuggestion[]> = {
  "da-nang": [
    {
      id: "fusion-maia",
      name: "Fusion Maia Da Nang",
      area: "My Khe Beach",
      note: "All-pool villas · earn Lotusmiles on Booking.com",
    },
    {
      id: "intercon-dad",
      name: "InterContinental Danang Sun Peninsula",
      area: "Son Tra Peninsula",
      note: "Resort stay · illustrative partner rate",
    },
    {
      id: "novotel-dad",
      name: "Novotel Danang Premier Han River",
      area: "City centre",
      note: "Walk to Han River promenade · member earn",
    },
  ],
  "ho-chi-minh-city": [
    {
      id: "des-arts",
      name: "Hotel des Arts Saigon",
      area: "District 3",
      note: "Boutique · earn on Booking.com partner link",
    },
    {
      id: "reverie",
      name: "The Reverie Saigon",
      area: "District 1",
      note: "Central Saigon · illustrative Lotusmiles stay",
    },
    {
      id: "liberty-central",
      name: "Liberty Central Saigon Citypoint",
      area: "Ben Thanh",
      note: "Walk to markets & street food · partner earn",
    },
  ],
  hanoi: [
    {
      id: "metropole",
      name: "Sofitel Legend Metropole Hanoi",
      area: "Hoan Kiem",
      note: "Heritage stay · earn Lotusmiles on Booking.com",
    },
    {
      id: "apricot",
      name: "Apricot Hotel Hanoi",
      area: "Old Quarter",
      note: "Lake views · partner rate (illustrative)",
    },
    {
      id: "lotte-han",
      name: "Lotte Hotel Hanoi",
      area: "Ba Dinh",
      note: "Modern central base · member earn copy",
    },
  ],
  "nha-trang": [
    {
      id: "amiana",
      name: "Amiana Resort Nha Trang",
      area: "Nha Trang Bay",
      note: "Beach resort · Booking.com partner earn",
    },
    {
      id: "intercon-nt",
      name: "InterContinental Nha Trang",
      area: "Tran Phu Beach",
      note: "Seafront · illustrative member rate",
    },
    {
      id: "liberty-central-nt",
      name: "Liberty Central Nha Trang Hotel",
      area: "City beach",
      note: "Central coast stay · partner link",
    },
  ],
  "phu-quoc": [
    {
      id: "jw-phuquoc",
      name: "JW Marriott Phu Quoc Emerald Bay",
      area: "Khem Beach",
      note: "Resort island stay · earn on partner booking",
    },
    {
      id: "salinda",
      name: "Salinda Resort Phu Quoc",
      area: "Bai Truong",
      note: "Beachfront · Lotusmiles partner (illustrative)",
    },
    {
      id: "novotel-pq",
      name: "Novotel Phu Quoc Resort",
      area: "Duong Dong",
      note: "Near town & airport · member earn",
    },
  ],
};

function prefersGatewayHotels(trip: TripSummary): boolean {
  if (trip.travelStyle === "vfr") return true;
  if (trip.destinationHint === "family_south") return true;
  if (trip.destinationLocalityId === "ca-mau") return true;
  if (trip.localityNote && trip.destinationLocalityId !== trip.gateway?.toLowerCase()) {
    const cityIds = ["ho-chi-minh-city", "hanoi", "da-nang"];
    if (trip.destinationLocalityId && !cityIds.includes(trip.destinationLocalityId)) {
      return true;
    }
  }
  return false;
}

export function getHotelSuggestionsForTrip(trip: TripSummary): HotelSuggestionPanel {
  const gateway = trip.gateway ?? "SGN";
  const destId = trip.destinationLocalityId;
  const destTitle = trip.destinationTitle ?? gatewayDisplay(gateway);

  if (prefersGatewayHotels(trip)) {
    const gwName =
      gateway === "SGN" ? "Ho Chi Minh City" : gateway === "HAN" ? "Hanoi" : "Da Nang";
    return {
      eyebrow: `Stay · Near ${gwName} (${gateway})`,
      hotels: GATEWAY_HOTELS[gateway],
    };
  }

  if (destId && DESTINATION_HOTELS[destId]) {
    return {
      eyebrow: `Stay · ${destTitle}`,
      hotels: DESTINATION_HOTELS[destId],
    };
  }

  return {
    eyebrow: `Stay · ${destTitle}`,
    hotels: GATEWAY_HOTELS[gateway],
  };
}

export const POLICY_SNIPPETS: Record<
  PolicyOverlayId,
  { title: string; bullets: string[] }
> = {
  "direct-decision-offer": {
    title: "Bonus Lotusmiles offer terms",
    bullets: [
      "Illustrative bonus miles when you book on vietnamairlines.com during discovery.",
      "Standard route earn plus limited-time bonus — totals shown after member sign-in in demo.",
      "Bonus miles credited after eligible travel per Lotusmiles program rules.",
      "Offer expires 24h from first eligible view (demo timer) — not valid on OTA channels.",
    ],
  },
  lotusmiles: {
    title: "Lotusmiles enrollment",
    bullets: [
      "Free to join on vietnamairlines.com.",
      "Earn miles on eligible Vietnam Airlines flights.",
      "Unlock member-only web fares in production.",
    ],
  },
  lotustudents: {
    title: "LotuStudents",
    bullets: [
      "Verified student status required in production.",
      "Demo shows illustrative extra bonus miles on direct channel.",
      "Terms apply at checkout on vietnamairlines.com.",
    ],
  },
};

export function emptyTripSummary(profile: MemberDemoProfile = "guest"): TripSummary {
  return { memberProfile: profile, travellers: 2, monthHint: undefined };
}

export function draftFromSummary(trip: TripSummary): TripDraft {
  return {
    origin: trip.origin,
    travelStyle: trip.travelStyle,
    destinationHint: trip.destinationHint,
    localityNote: trip.localityNote,
    travellers: trip.travellers,
    monthHint: trip.monthHint,
  };
}

export function getFilteredSuggestions(
  origin?: OriginCity,
  vibe?: TravelStyle,
): DestinationSuggestion[] {
  let list = [...DESTINATION_SPOTLIGHT];
  if (vibe && vibe !== "mixed") {
    list = list.filter((s) => s.vibes.includes(vibe));
  }
  if (origin === "PER") {
    list = [...list].sort((a, b) => (b.spotlight ? 1 : 0) - (a.spotlight ? 1 : 0));
  }
  if (origin === "MEL") {
    list = [...list].sort((a, b) => {
      if (a.tone === "south" && b.tone !== "south") return -1;
      if (b.tone === "south" && a.tone !== "south") return 1;
      return 0;
    });
  }
  return list;
}

const BENTO_PLANS: Record<
  BentoLayout,
  { slot: BentoSlot; shape: BentoShape }[]
> = {
  /** 1 cột đứng trái + 2 thanh ngang phải (wireframe user) */
  sidebar: [
    { slot: "p1", shape: "portrait" },
    { slot: "l1", shape: "landscape" },
    { slot: "l2", shape: "landscape" },
  ],
  /** Cột đứng trái + 3 thanh ngang phải */
  sidebar4: [
    { slot: "p1", shape: "portrait" },
    { slot: "l1", shape: "landscape" },
    { slot: "l2", shape: "landscape" },
    { slot: "l3", shape: "landscape" },
  ],
};

function pickDestinations(
  origin: OriginCity | undefined,
  vibe: TravelStyle | undefined,
): { layout: BentoLayout; ids: string[] } {
  if (vibe === "beach_relaxation") {
    return { layout: "sidebar", ids: ["da-nang", "phu-quoc", "nha-trang"] };
  }
  if (vibe === "vfr") {
    return { layout: "sidebar", ids: ["ca-mau", "ho-chi-minh-city", "hanoi"] };
  }
  if (vibe === "food_culture") {
    return { layout: "sidebar", ids: ["ho-chi-minh-city", "hanoi", "da-nang"] };
  }
  if (origin === "MEL") {
    return {
      layout: "sidebar4",
      ids: ["ho-chi-minh-city", "da-nang", "phu-quoc", "nha-trang"],
    };
  }
  return { layout: "sidebar", ids: ["ca-mau", "da-nang", "hanoi"] };
}

/** Curated bento — portrait (đứng) vs landscape (nằm ngang), layout đổi theo vibe */
export function getBentoSuggestions(
  origin?: OriginCity,
  vibe?: TravelStyle,
): BentoBoard {
  const pool = getFilteredSuggestions(origin, vibe);
  const { layout, ids } = pickDestinations(origin, vibe);
  const plan = BENTO_PLANS[layout];

  const tiles = ids
    .map((id, i) => {
      const dest = pool.find((s) => s.id === id);
      const cell = plan[i];
      if (!dest || !cell) return null;
      return { ...dest, shape: cell.shape, slot: cell.slot };
    })
    .filter((t): t is BentoDestination => Boolean(t));

  return { layout, tiles };
}

export function deriveStage(trip: TripSummary, bookingReady: boolean): DiscoveryStage {
  if (bookingReady) return "booking";
  if (!trip.destinationTitle) return "suggested_destinations";
  if (trip.hotelInterest && trip.monthHint) return "hotels";
  if (trip.monthHint && trip.destinationTitle && trip.travellers) return "season";
  return "destination_detail";
}

export function localityFromSuggestion(suggestion: DestinationSuggestion): LocalityResolution {
  return {
    localityId: suggestion.id,
    localityTitle: suggestion.title,
    gateway: suggestion.gateway,
    ruledOut: [],
    onwardNote:
      suggestion.id === "ca-mau"
        ? "Plan ~3 hours by road from Tan Son Nhat (SGN) to reach Cà Mau — or a domestic connection."
        : undefined,
  };
}

export function suggestionToTrip(
  suggestion: DestinationSuggestion,
  current: TripSummary,
): TripSummary {
  const hint: DestinationHint | undefined =
    suggestion.id === "ca-mau"
      ? "family_south"
      : suggestion.vibes.includes("beach_relaxation")
        ? "beach_central"
        : suggestion.vibes.includes("food_culture")
          ? "food_city"
          : suggestion.vibes.includes("vfr")
            ? "family_south"
            : "compare_gateways";

  return {
    ...current,
    destinationLocalityId: suggestion.id,
    destinationTitle: suggestion.title,
    gateway: suggestion.gateway,
    destinationHint: hint,
  };
}

// The backend's heuristic brief parser (parseBriefHeuristic) only accepts a
// brief when it recognizes 3+ of {origin, travelStyle, travellers, priority,
// budgetBand} — otherwise it rejects the whole request as UNPARSEABLE. A bare
// "Melbourne, Ho Chi Minh City, April, 2 adults." only hits origin +
// travellers, so it must always fail. This fragment supplies a travelStyle
// keyword the lexicon recognizes (STYLE_LEXICON in apps/api/src/intent/lexicon.ts).
function tripStyleBriefFragment(style?: TravelStyle): string {
  switch (style) {
    case "vfr":
      return "visiting family in";
    case "family":
      return "a family trip to";
    case "food_culture":
      return "a food & culture trip to";
    case "education":
      return "an education-focused trip to";
    case "mixed":
      return "a mixed-interest trip to";
    default:
      return "a trip to";
  }
}

export function tripToBrief(trip: TripSummary): string {
  if (trip.destinationTitle && trip.origin) {
    const originName =
      trip.origin === "MEL" ? "Melbourne" : trip.origin === "PER" ? "Perth" : "Sydney";
    const when = trip.monthHint ?? "April";
    const pax = trip.travellers;
    if (/cà mau|ca mau/i.test(trip.destinationTitle)) {
      return `${originName}, visit family in Cà Mau, ${when}, ${pax} adults — one stop max.`;
    }
    if (trip.travelStyle === "beach_relaxation" || trip.destinationHint === "beach_central") {
      return `${originName}, beach trip in ${when} — ${trip.destinationTitle}, ${pax} adults, low hassle.`;
    }
    const styleFragment = tripStyleBriefFragment(trip.travelStyle);
    return `${originName}, ${styleFragment} ${trip.destinationTitle} in ${when}, ${pax} adults, low hassle.`;
  }
  return draftToBrief(draftFromSummary(trip));
}

export function hasEnoughForBooking(trip: TripSummary): boolean {
  return Boolean(
    trip.origin &&
      trip.destinationTitle &&
      trip.travellers >= 1 &&
      trip.monthHint,
  );
}

export function originDisplay(origin?: OriginCity): string {
  if (!origin) return "—";
  return origin === "MEL" ? "Melbourne (MEL)" : origin === "PER" ? "Perth (PER)" : "Sydney (SYD)";
}

export function vibeDisplay(vibe?: TravelStyle): string {
  if (!vibe) return "—";
  const map: Record<TravelStyle, string> = {
    vfr: "Visit family",
    beach_relaxation: "Beach & relax",
    food_culture: "Food & culture",
    education: "Education",
    family: "Family",
    mixed: "Compare options",
  };
  return map[vibe] ?? vibe;
}

export function gatewayDisplay(gw?: DestinationCity): string {
  if (!gw) return "—";
  return gw === "HAN" ? "Hanoi (HAN)" : gw === "SGN" ? "Ho Chi Minh City (SGN)" : "Da Nang (DAD)";
}
