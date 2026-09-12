/** Source of truth — Person A/B/C/D import from here (WORK_SPLIT §2). */

export type InputMode = "brief" | "quiz";

export type PriorityPreset =
  | "lowest_hassle"
  | "best_for_family"
  | "maximise_miles"
  | "food_and_culture";

export type BudgetBand = "budget" | "standard" | "premium";

export type TravelStyle =
  | "beach_relaxation"
  | "food_culture"
  | "education"
  | "family"
  | "vfr"
  | "mixed";

export type OriginCity = "SYD" | "MEL" | "PER";
export type DestinationCity = "HAN" | "SGN" | "DAD";

export interface QuizAnswers {
  travelStyle: TravelStyle;
  dateFlexibility: "fixed" | "flexible_±3" | "flexible_month";
  budgetBand: BudgetBand;
  travellers: number;
  priority: PriorityPreset;
  departAfter?: string;
  departBefore?: string;
  originCity: OriginCity;
}

export interface TripIntent {
  originCity: OriginCity;
  travelStyles: TravelStyle[];
  budgetBand: BudgetBand;
  travellers: number;
  priority: PriorityPreset;
  dateWindow: {
    start: string;
    end: string;
    flexibility: "fixed" | "flexible_±3" | "flexible_month";
  };
  tripDurationDays: number;
  goal: "discover_destination" | "choose_route";
  preferredDestination?: DestinationCity;
  constraints: {
    maxStops: 0 | 1 | 2;
    mustIncludeTags?: string[];
    avoidTags?: string[];
  };
  rawSummary: string;
  parseConfidence: number;
  missingFields: string[];
}

export interface RecommendRequest {
  mode: InputMode;
  briefText?: string;
  originCity?: OriginCity;
  quiz?: QuizAnswers;
  priorityOverride?: PriorityPreset;
  cachedIntent?: TripIntent;
  locale?: "en" | "vi";
}

export interface ApiError {
  errorCode: string;
  message: string;
}

export type IntentParseResult =
  | { ok: true; intent: TripIntent }
  | {
      ok: false;
      errorCode: "EMPTY_INPUT" | "UNPARSEABLE" | "VALIDATION_FAILED" | "LLM_ERROR";
      message: string;
    };

export type DataConfidence = "confirmed" | "illustrative";
export type ConnectionType = "direct" | "one_stop" | "two_stop";

export interface RouteRecord {
  id: string;
  originCity: OriginCity;
  originAirport: string;
  destinationCity: DestinationCity;
  destinationAirport: string;
  destinationName: string;
  connectionType: ConnectionType;
  viaHub?: DestinationCity | null;
  typicalDurationHours: number;
  seasonalityNotes: string;
  gettingAround: string;
  tripArchetypes: TravelStyle[];
  indicativeFareBand: BudgetBand;
  bestMonths: number[];
  shoulderMonths?: number[];
  backgroundImage: {
    url: string;
    archetype: TravelStyle;
    source: string;
    owner: string;
    licenseNote: string;
  };
  promotion?: {
    id: string;
    title: string;
    summary: string;
    validUntil?: string;
  } | null;
  lotusmilesIndicative?: {
    earnBand: "low" | "mid" | "high";
    note: string;
  } | null;
  dataConfidence: DataConfidence;
  sourceDocument: string;
  sourceOwner: string;
}

export interface ScoreBreakdown {
  intentMatch: number;
  dateFit: number;
  routeConvenience: number;
  budgetFit: number;
  loyaltyValue: number;
  promotionBoost: number;
  weightedTotal: number;
  weightsUsed: Record<
    keyof Omit<ScoreBreakdown, "weightedTotal" | "weightsUsed" | "reasons">,
    number
  >;
  reasons: string[];
}

export interface HandOffParams {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  adults: number;
  searchUrl: string;
}

export interface RankedCard {
  rank: 1 | 2 | 3;
  routeId: string;
  route: RouteRecord;
  score: ScoreBreakdown;
  tripOutline: string;
  handoff: HandOffParams;
}

export interface RankedResponse {
  requestId: string;
  intent: TripIntent;
  cards: RankedCard[];
  meta: {
    datasetVersion: string;
    scoringVersion: string;
    usedIllustrativeData: boolean;
    disclaimer: string;
  };
}

export interface SaveTripRequest {
  requestId: string;
  routeId: string;
  intent: TripIntent;
  consentReminder: boolean;
}

export interface SaveTripResponse {
  saveId: string;
  remindAfterHours: number;
  status: "saved";
}
