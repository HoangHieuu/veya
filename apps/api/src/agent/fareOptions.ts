import type {
  ConnectionType,
  DestinationCity,
  FareBrandId,
  FareOption,
  FareRuleLine,
  FlightItineraryView,
  FlightSegmentView,
  RankedCard,
  TripSummary,
} from "../../../../shared/types.js";
import type { AgentDataSnapshot, FareBrandSnapshot } from "./data.js";

export interface BuildFareOptionsInput {
  card: RankedCard;
  trip: TripSummary;
  data: AgentDataSnapshot;
}

/**
 * Branded fare grid for the ranked route, mirroring the columns on
 * booking.vietnamairlines.com/booking/availability. Prices derive from the
 * sourced round-trip Economy snapshot in data/offers/illustrative-fares.json
 * multiplied by each brand's demo multiplier — see the disclaimer in
 * data/offers/fare-families.json before quoting any number as a VNA fare.
 */
export function buildFareOptions(
  input: BuildFareOptionsInput,
): FareOption[] {
  const families = input.data.fareFamilies;
  if (!families) return [];
  const fare = input.data.fares.find(
    (candidate) => candidate.routeId === input.card.routeId,
  );
  if (!fare || !Number.isFinite(fare.publicFareAud) || fare.publicFareAud <= 0) {
    return [];
  }

  const travellers = Math.max(1, input.trip.travellers ?? 1);
  const priced = families.brands.map((brand) => {
    const pricePerAdultAud = roundCurrency(fare.publicFareAud * brand.priceMultiplier);
    return {
      brand,
      pricePerAdultAud,
      totalAud: roundCurrency(pricePerAdultAud * travellers),
    };
  });
  const lowestPrice = Math.min(...priced.map((entry) => entry.pricePerAdultAud));

  return priced.map(({ brand, pricePerAdultAud, totalAud }) => ({
    brandId: brand.brandId,
    cabin: brand.cabin,
    brandLabel: brand.brandLabel,
    cabinLabel: brand.cabinLabel,
    pricePerAdultAud,
    totalAud,
    currency: "AUD" as const,
    lowest: pricePerAdultAud === lowestPrice,
    perks: [...brand.perks],
    rules: buildRules(brand, families.baggageSourceUrl),
    checkedBaggage: brand.checkedBaggage,
    handBaggage: brand.handBaggage,
    changePolicy: brand.changePolicy,
    refundPolicy: brand.refundPolicy,
    milesEarnPct: brand.milesEarnPct,
    ...(brand.seatsRemaining !== undefined
      ? { seatsRemaining: brand.seatsRemaining }
      : {}),
    illustrative: true as const,
    sourceFields: [
      ...fare.sourceFields,
      ...families.sourceFields,
      `brands.${brand.brandId}`,
    ],
  }));
}

function buildRules(
  brand: FareBrandSnapshot,
  baggageSourceUrl?: string,
): FareRuleLine[] {
  const baggageSource = brand.checkedBaggageIllustrative
    ? "data/offers/fare-families.json (illustrative)"
    : baggageSourceUrl ?? brand.checkedBaggageSource;
  return [
    {
      label: "Checked baggage",
      value: brand.checkedBaggage,
      source: baggageSource,
      illustrative: brand.checkedBaggageIllustrative,
    },
    {
      label: "Hand baggage",
      value: brand.handBaggage,
      source: "https://www.vietnamairlines.com/vn/en/travel-information/baggage/baggage-allowance-hand-baggage",
      illustrative: false,
    },
    {
      label: "Changes",
      value: brand.changePolicy,
      source: "data/offers/fare-families.json (illustrative)",
      illustrative: true,
    },
    {
      label: "Refunds",
      value: brand.refundPolicy,
      source: "data/offers/fare-families.json (illustrative)",
      illustrative: true,
    },
    {
      label: "Seat selection",
      value: brand.seatSelection,
      source: "data/offers/fare-families.json (illustrative)",
      illustrative: true,
    },
    {
      label: "Lotusmiles earn",
      value: `${brand.milesEarnPct}% of base miles`,
      source: "data/offers/fare-families.json (illustrative)",
      illustrative: true,
    },
  ];
}

export function findFareOption(
  options: FareOption[],
  brandId: FareBrandId | undefined,
): FareOption | undefined {
  if (!brandId) return undefined;
  return options.find((option) => option.brandId === brandId);
}

/**
 * Demo itinerary rows for the availability grid. Times are derived
 * deterministically from the route so the same trip always renders the same
 * flight, but they are not a live schedule lookup.
 */
export function buildItineraries(
  card: RankedCard,
  trip: TripSummary,
): FlightItineraryView[] {
  const { route } = card;
  const departDate = trip.departDate;
  const returnDate = trip.returnDate;
  if (!departDate || !returnDate) return [];

  const outbound = buildItinerary({
    direction: "outbound",
    date: departDate,
    originAirport: route.originAirport,
    destinationAirport: route.destinationAirport,
    connectionType: route.connectionType,
    viaHub: route.viaHub ?? null,
    durationHours: route.typicalDurationHours,
    seed: hashSeed(`${route.id}-out`),
  });
  const inbound = buildItinerary({
    direction: "inbound",
    date: returnDate,
    originAirport: route.destinationAirport,
    destinationAirport: route.originAirport,
    connectionType: route.connectionType,
    viaHub: route.viaHub ?? null,
    durationHours: route.typicalDurationHours,
    seed: hashSeed(`${route.id}-in`),
  });
  return [outbound, inbound];
}

interface ItineraryInput {
  direction: "outbound" | "inbound";
  date: string;
  originAirport: string;
  destinationAirport: string;
  connectionType: ConnectionType;
  viaHub: DestinationCity | null;
  durationHours: number;
  seed: number;
}

function buildItinerary(input: ItineraryInput): FlightItineraryView {
  const departMinutes = 6 * 60 + (input.seed % 16) * 45;
  const totalMinutes = Math.round(input.durationHours * 60);
  const stops = input.connectionType === "direct" ? 0 : input.viaHub ? 1 : 0;

  const segments: FlightSegmentView[] = [];
  if (stops === 0 || !input.viaHub) {
    segments.push({
      flightNumber: flightNumber(input.seed),
      departAirport: input.originAirport,
      arriveAirport: input.destinationAirport,
      departTime: minutesToClock(departMinutes),
      arriveTime: minutesToClock(departMinutes + totalMinutes),
      durationLabel: durationLabel(totalMinutes),
    });
  } else {
    const layoverMinutes = 90 + (input.seed % 5) * 15;
    const firstLeg = Math.round((totalMinutes - layoverMinutes) * 0.62);
    const secondLeg = totalMinutes - layoverMinutes - firstLeg;
    segments.push({
      flightNumber: flightNumber(input.seed),
      departAirport: input.originAirport,
      arriveAirport: input.viaHub,
      departTime: minutesToClock(departMinutes),
      arriveTime: minutesToClock(departMinutes + firstLeg),
      durationLabel: durationLabel(firstLeg),
    });
    segments.push({
      flightNumber: flightNumber(input.seed + 37),
      departAirport: input.viaHub,
      arriveAirport: input.destinationAirport,
      departTime: minutesToClock(departMinutes + firstLeg + layoverMinutes),
      arriveTime: minutesToClock(departMinutes + totalMinutes),
      durationLabel: durationLabel(secondLeg),
    });
  }

  return {
    direction: input.direction,
    date: input.date,
    originAirport: input.originAirport,
    destinationAirport: input.destinationAirport,
    departTime: segments[0].departTime,
    arriveTime: segments[segments.length - 1].arriveTime,
    durationLabel: durationLabel(totalMinutes),
    connectionType: input.connectionType,
    viaHub: input.viaHub,
    stopsLabel: stops === 0 ? "Direct" : `1 stop · ${input.viaHub}`,
    segments,
    illustrative: true,
  };
}

function flightNumber(seed: number): string {
  return `VN ${100 + (seed % 780)}`;
}

function minutesToClock(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const dayOffset = Math.floor(minutes / 1440);
  const clock = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return dayOffset > 0 ? `${clock}+${dayOffset}` : clock;
}

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100000;
  }
  return hash;
}

/** Whole dollars: the grid is illustrative, and cents imply false precision. */
export function roundCurrency(value: number): number {
  return Math.round(value);
}
