import type {
  ConnectionType,
  DestinationCity,
  PriorityPreset,
  TravelStyle,
} from "@shared/types";

export const PRIORITY_OPTIONS: { value: PriorityPreset; label: string }[] = [
  { value: "lowest_hassle", label: "Lowest hassle" },
  { value: "best_for_family", label: "Best for family" },
  { value: "maximise_miles", label: "Maximise miles" },
  { value: "food_and_culture", label: "Food & culture" },
];

export const TRAVEL_STYLE_OPTIONS: { value: TravelStyle; label: string }[] = [
  { value: "beach_relaxation", label: "Beach & relaxation" },
  { value: "food_culture", label: "Food & culture" },
  { value: "education", label: "Education" },
  { value: "family", label: "Family" },
  { value: "vfr", label: "Visiting family / friends" },
  { value: "mixed", label: "A bit of everything" },
];

export function connectionLabel(type: ConnectionType): string {
  switch (type) {
    case "direct":
      return "Direct";
    case "one_stop":
      return "1 stop";
    case "two_stop":
      return "2 stops";
  }
}

export function cityLabel(code: string): string {
  const map: Record<string, string> = {
    SYD: "Sydney",
    MEL: "Melbourne",
    PER: "Perth",
    HAN: "Hanoi",
    SGN: "Ho Chi Minh City",
    DAD: "Da Nang",
  };
  return map[code] ?? code;
}

export function travelStyleLabel(style: TravelStyle): string {
  return TRAVEL_STYLE_OPTIONS.find((o) => o.value === style)?.label ?? style;
}

export function budgetLabel(band: string): string {
  const map: Record<string, string> = {
    budget: "Budget",
    standard: "Standard",
    premium: "Premium",
  };
  return map[band] ?? band;
}

export function priorityLabel(preset: PriorityPreset | string): string {
  return (
    PRIORITY_OPTIONS.find((o) => o.value === preset)?.label ??
    String(preset).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function dateFlexLabel(
  flex: "fixed" | "flexible_±3" | "flexible_month" | undefined,
): string {
  switch (flex) {
    case "fixed":
      return "Fixed dates";
    case "flexible_±3":
      return "±3 days flexible";
    case "flexible_month":
      return "Flexible within a month";
    default:
      return "—";
  }
}

export function durationLabel(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function routePathLabel(
  origin: string,
  destination: string,
  via?: string | null,
): string {
  if (via) return `${origin} → ${via} → ${destination}`;
  return `${origin} → ${destination}`;
}

const GATEWAY_INFO: Record<
  DestinationCity,
  { title: string; subtitle: string; vibe: string }
> = {
  DAD: {
    title: "Da Nang",
    subtitle: "Central coast gateway",
    vibe: "Beach, Hoi An day trips, easy coast pace",
  },
  SGN: {
    title: "Ho Chi Minh City",
    subtitle: "Southern city gateway",
    vibe: "Street food, city life, beaches via road",
  },
  HAN: {
    title: "Hanoi",
    subtitle: "Northern culture gateway",
    vibe: "Old Quarter, history, family visits north",
  },
};

export function gatewayInfo(city: DestinationCity) {
  return GATEWAY_INFO[city];
}

export function fareBandLabel(band: string): string {
  const map: Record<string, string> = {
    budget: "Budget band",
    standard: "Standard band",
    premium: "Premium band",
  };
  return map[band] ?? band;
}
