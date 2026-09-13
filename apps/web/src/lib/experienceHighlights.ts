import localityGatewayData from "../../../../data/locality-gateway.json";
import needPlaceMapData from "../../../../data/need-place-map.json";
import {
  extractMentionedLocalities,
  hasVisitLocationContext,
  normalizeLocalityGateway,
  type LocalityGatewayData,
} from "@shared/localityGateway";
import {
  buildNeedProfile,
  rankExperienceHighlights,
  type NeedPlaceMapData,
} from "@shared/needPlaceMap";
import type {
  DestinationCity,
  ExperienceHighlight,
  RankedCard,
  TravelStyle,
  TripIntent,
} from "@shared/types";

const NEED_PLACE_MAP = needPlaceMapData as NeedPlaceMapData;
const LOCALITY_GATEWAY = normalizeLocalityGateway(
  localityGatewayData as Parameters<typeof normalizeLocalityGateway>[0],
) as LocalityGatewayData;

function needProfile(intent: TripIntent) {
  return buildNeedProfile(intent, NEED_PLACE_MAP, LOCALITY_GATEWAY);
}

export type { ExperienceHighlight };

export type AgentChip = "more_food" | "quieter_beach" | "family_friendly" | "culture";

export const AGENT_CHIPS: { id: AgentChip; label: string }[] = [
  { id: "more_food", label: "More food" },
  { id: "quieter_beach", label: "Quieter beach" },
  { id: "family_friendly", label: "Family-friendly" },
  { id: "culture", label: "Culture & history" },
];

/** Fallback when API omits experienceHighlights (mock mode). Mirrors data/experiences/*.json */
const HIGHLIGHTS: Record<DestinationCity, ExperienceHighlight[]> = {
  DAD: [
    {
      id: "dad-mykhe",
      title: "My Khe Beach",
      subtitle: "Wide sand and gentle surf — stay in Da Nang, not just the airport code.",
      transferNote: "25 min from DAD · taxi or Grab",
      imageUrl: "/assets/da-nang-beach.jpg",
      tags: ["beach", "quiet"],
      featured: true,
    },
    {
      id: "dad-hoian",
      title: "Hoi An Ancient Town",
      subtitle: "Lantern streets, tailors, and riverside cafés.",
      transferNote: "45 min south by road",
      imageUrl: "/assets/experiences/dad-hoi-an.jpg",
      tags: ["culture", "food"],
      featured: true,
    },
    {
      id: "dad-marble",
      title: "Marble Mountains",
      subtitle: "Caves, pagodas, and coastal views above the city.",
      transferNote: "20 min south · half-day",
      imageUrl: "/assets/experiences/dad-marble-mountains.jpg",
      tags: ["culture", "family"],
    },
    {
      id: "dad-bana",
      title: "Bà Nà Hills",
      subtitle: "Cable car and Golden Bridge views in the hills.",
      transferNote: "45 min west",
      imageUrl: "/assets/da-nang-beach.jpg",
      tags: ["family", "city"],
    },
  ],
  SGN: [
    {
      id: "sgn-street-food",
      title: "District 1 street food",
      subtitle: "Bánh mì, cơm tấm, and night-market stalls.",
      transferNote: "In-city · Districts 1 & 3",
      imageUrl: "/assets/saigon-food.jpg",
      tags: ["food", "city"],
      featured: true,
    },
    {
      id: "sgn-vungtau",
      title: "Vũng Tàu beach",
      subtitle: "Seaside escape by road from Saigon.",
      transferNote: "~2h by road",
      imageUrl: "/assets/experiences/sgn-vung-tau.jpg",
      tags: ["beach", "quiet", "family"],
      featured: true,
    },
    {
      id: "sgn-cholon",
      title: "Chợ Lớn heritage",
      subtitle: "Temples and markets in the Chinese quarter.",
      transferNote: "30 min from central hotels",
      imageUrl: "/assets/saigon-food.jpg",
      tags: ["culture", "family"],
    },
    {
      id: "sgn-mekong",
      title: "Mekong Delta day",
      subtitle: "Canals and floating markets south of the city.",
      transferNote: "~2h drive · tour",
      imageUrl: "/assets/saigon-food.jpg",
      tags: ["culture", "food"],
    },
  ],
  HAN: [
    {
      id: "han-old-quarter",
      title: "Old Quarter walks",
      subtitle: "Phở lanes, lake loops, and weekend street life.",
      transferNote: "In-city · walk or cyclo",
      imageUrl: "/assets/hanoi-food.jpg",
      tags: ["food", "culture"],
      featured: true,
    },
    {
      id: "han-hoan-kiem",
      title: "Hoàn Kiếm Lake",
      subtitle: "Calm paths and Ngoc Son temple at dusk.",
      transferNote: "Central Hanoi",
      imageUrl: "/assets/hanoi-food.jpg",
      tags: ["quiet", "culture", "family"],
      featured: true,
    },
    {
      id: "han-halong",
      title: "Hạ Long Bay cruise",
      subtitle: "Karst islands — the north's signature day trip.",
      transferNote: "~3h each way",
      imageUrl: "/assets/experiences/han-ha-long-bay.jpg",
      tags: ["culture", "family"],
    },
    {
      id: "han-ninh-binh",
      title: "Ninh Binh day trip",
      subtitle: "Boat rides between limestone cliffs.",
      transferNote: "~2h south · Trang An",
      imageUrl: "/assets/experiences/han-ninh-binh.jpg",
      tags: ["culture", "quiet"],
    },
  ],
};

function stylePhrase(styles: TravelStyle[]): string {
  const labels: Partial<Record<TravelStyle, string>> = {
    beach_relaxation: "beach time",
    food_culture: "food and culture",
    family: "family-friendly pacing",
    vfr: "time with family in Vietnam",
    education: "learning and history",
    mixed: "a mix of experiences",
  };
  return styles.map((s) => labels[s] ?? s.replace(/_/g, " ")).join(" and ");
}

export function resolveHighlights(
  card: RankedCard,
  intent?: TripIntent,
): ExperienceHighlight[] {
  const base =
    card.experienceHighlights?.length
      ? card.experienceHighlights
      : HIGHLIGHTS[card.route.destinationCity];
  if (!intent) {
    return [...base].sort((a, b) => Number(b.featured) - Number(a.featured));
  }
  const profile = needProfile(intent);
  return rankExperienceHighlights(base, profile);
}

function isVfrIntent(intent: TripIntent): boolean {
  return (
    intent.travelStyles.includes("vfr") ||
    hasVisitLocationContext(intent.rawSummary, LOCALITY_GATEWAY)
  );
}

export function buildAgentIntro(intent: TripIntent, card: RankedCard): string {
  const text = intent.rawSummary;
  const localities = extractMentionedLocalities(text, LOCALITY_GATEWAY);

  if (isVfrIntent(intent)) {
    if (localities.length > 0) {
      const place = localities[0]!;
      return `Fly into ${card.route.destinationName} — the closest Vietnam Airlines gateway if you're visiting family in ${place}. After you land at ${card.route.destinationAirport}, plan the onward leg to reach them (road or domestic connection).`;
    }
    return `Fly into ${card.route.destinationName} — your best Vietnam Airlines gateway for time with family in Vietnam. You'll connect from ${card.route.destinationAirport} to wherever your relatives live.`;
  }

  const highlights = resolveHighlights(card, intent);
  const featured = highlights.filter((h) => h.featured).slice(0, 2);
  const spotNames =
    featured.length >= 2
      ? `${featured[0]!.title} and ${featured[1]!.title}`
      : featured[0]?.title ?? card.route.destinationName;
  const vibe = stylePhrase(intent.travelStyles);
  return `Fly into ${card.route.destinationName} — from there, ${spotNames} fit your ${vibe} plans. The airport is just the start of the trip.`;
}

export function getExperienceHighlights(city: DestinationCity): ExperienceHighlight[] {
  return HIGHLIGHTS[city];
}

const CHIP_FILTERS: Record<AgentChip, (h: ExperienceHighlight) => boolean> = {
  more_food: (h) => h.tags.includes("food"),
  quieter_beach: (h) => h.tags.includes("beach") || h.tags.includes("quiet"),
  family_friendly: (h) => h.tags.includes("family"),
  culture: (h) => h.tags.includes("culture"),
};

export function filterHighlights(
  highlights: ExperienceHighlight[],
  chip: AgentChip | null,
  intent?: TripIntent,
): ExperienceHighlight[] {
  const ranked = intent
    ? rankExperienceHighlights(highlights, needProfile(intent))
    : [...highlights].sort((a, b) => Number(b.featured) - Number(a.featured));
  if (!chip) {
    return ranked;
  }
  const match = ranked.filter(CHIP_FILTERS[chip]);
  return match.length > 0 ? match : ranked;
}

export function attachMockExperienceHighlights(
  response: {
    cards: RankedCard[];
    intent: TripIntent;
  },
): void {
  const profile = needProfile(response.intent);
  for (const card of response.cards) {
    if (!card.experienceHighlights?.length) {
      card.experienceHighlights = structuredClone(HIGHLIGHTS[card.route.destinationCity]);
    }
    card.experienceHighlights = rankExperienceHighlights(
      card.experienceHighlights,
      profile,
    );
  }
}
