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
  details?: Record<string, unknown>;
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

/** Curated place reachable from a VNA gateway (not a separate IATA). */
export interface ExperienceHighlight {
  id: string;
  title: string;
  subtitle: string;
  transferNote: string;
  imageUrl: string;
  tags: ("food" | "beach" | "quiet" | "family" | "culture" | "city")[];
  featured?: boolean;
}

export interface RankedCard {
  rank: 1 | 2 | 3;
  routeId: string;
  route: RouteRecord;
  score: ScoreBreakdown;
  tripOutline: string;
  handoff: HandOffParams;
  /** Places to explore after flying into this gateway (from data/experiences). */
  experienceHighlights?: ExperienceHighlight[];
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

/** Round 2 Agent Workspace contracts. Keep Phase 1 fields backward compatible. */
export type MemberDemoProfile =
  | "guest"
  | "lotusmiles_member"
  | "lotustudents_verified";

export type DiscoveryMode = "discovery" | "route_known";

export type DiscoveryStage =
  | "pick_origin"
  | "suggested_destinations"
  | "destination_detail"
  | "hotels"
  | "season"
  | "booking";

export type NextTripField =
  | "originCity"
  | "travelStyle"
  | "destinationLocalityId"
  | "travellers"
  | "departDate"
  | "returnDate"
  | "departMonth"
  | null;

export type MonthName =
  | "January"
  | "February"
  | "March"
  | "April"
  | "May"
  | "June"
  | "July"
  | "August"
  | "September"
  | "October"
  | "November"
  | "December";

export type PolicyOverlayId =
  | "direct-decision-offer"
  | "lotusmiles"
  | "lotustudents"
  | (string & {});

export interface TripSummary {
  originCity?: OriginCity;
  travelStyle?: TravelStyle;
  destinationLocalityId?: string;
  destinationTitle?: string;
  gateway?: DestinationCity;
  travellers?: number;
  departMonth?: MonthName;
  departDate?: string;
  returnDate?: string;
  hotelInterest?: boolean;
  memberProfile: MemberDemoProfile;
}

export type AgentInputEvent =
  | { type: "select_origin"; originCity: OriginCity }
  | { type: "select_vibe"; travelStyle: TravelStyle }
  | {
      type: "select_destination";
      destinationLocalityId: string;
      destinationTitle: string;
    }
  | { type: "set_travellers"; travellers: number }
  | { type: "set_dates"; departDate: string; returnDate: string }
  | { type: "continue_booking" }
  | { type: "view_policy"; policyId: PolicyOverlayId }
  | { type: "close_policy" }
  | { type: "reset_journey" };

export interface AgentTurnRequest {
  sessionId?: string;
  trip: TripSummary;
  message?: string;
  event?: AgentInputEvent;
}

/** A null value explicitly clears an optional trip field in the client reducer. */
export type TripSummaryPatch = Partial<{
  [K in keyof TripSummary]: TripSummary[K] | null;
}>;

export interface DestinationSuggestion {
  localityId: string;
  title: string;
  gateway: DestinationCity;
  summary: string;
  tags: string[];
  onwardNote?: string;
  promoted?: boolean;
  image?: {
    url: string;
    source: string;
    owner: string;
    licenseNote: string;
  };
  sourceFields: string[];
}

export interface RuledOutGateway {
  gateway: DestinationCity;
  reason: string;
}

export interface LocalityResolution {
  localityId: string;
  localityTitle: string;
  gateway: DestinationCity;
  ruledOut: RuledOutGateway[];
  onwardNote?: string;
  sourceFields: string[];
}

export interface SeasonNote {
  localityId: string;
  month: MonthName;
  headline: string;
  summary: string;
  bestMonths: number[];
  caveats: string[];
  sourceFields: string[];
}

export interface PolicySnippet {
  id: PolicyOverlayId;
  title: string;
  summary: string;
  bullets: string[];
  sourceDocument: string;
  sourceFields: string[];
}

export interface OfferQuote {
  eligible: boolean;
  ineligibleReason?: string;
  publicFareAud: number;
  offerFareAud: number;
  discountPct: number;
  expiresAt: string;
  termsId: string;
  illustrative: true;
  sourceDocument: string;
  sourceFields: string[];
}

export interface AgentAckVars {
  localityTitle?: string;
  gateway?: string;
}

export type AgentAction =
  | { type: "showIntent"; summary: string }
  | { type: "showLocality"; resolution: LocalityResolution }
  | { type: "showRoute"; cardIndex: number }
  | { type: "showExperiences"; cardIndex: number }
  | { type: "showOffer"; offer: OfferQuote }
  | { type: "showDirectValue"; cardIndex: number }
  | { type: "showEnrollment"; policyId: string }
  | { type: "showHandoff"; cardIndex: number };

export interface AgentCanvasState {
  discoveryMode: DiscoveryMode;
  agentMessage: string;
  actions: AgentAction[];
  offer?: OfferQuote;
  locality?: LocalityResolution;
}

export type AgentCenterContent =
  | { kind: "empty" }
  | { kind: "destination_grid"; suggestions: DestinationSuggestion[] }
  | {
      kind: "destination_detail";
      suggestion: DestinationSuggestion;
      locality: LocalityResolution;
    }
  | { kind: "hotels"; localityId: string }
  | { kind: "season"; note: SeasonNote }
  | {
      kind: "booking";
      recommendation: RankedResponse;
      canvas: AgentCanvasState;
    };

export interface AgentTurnResponse {
  sessionId: string;
  discoveryMode: DiscoveryMode;
  tripPatch: TripSummaryPatch;
  resetTrip: boolean;
  nextField: NextTripField;
  agentMessage: string;
  stage: DiscoveryStage;
  centerContent: AgentCenterContent;
  canvas?: AgentCanvasState;
  policyOverlay?: PolicyOverlayId | null;
  policySnippet?: PolicySnippet;
  meta: {
    generatedAt: string;
    datasetVersion: string;
    usedIllustrativeData: boolean;
    sourceFields: string[];
  };
}

/** Cart-abandonment analogue for discovery → handoff (no PSS cart). */
export type RecoveryTrigger =
  | "visibility_hidden"
  | "idle"
  | "leave_home"
  | "manual_save";

export type RecoverySessionStatus =
  | "active"
  | "resumed"
  | "dismissed"
  | "opened_vna";

export interface MockReminderStep {
  atHours: 0 | 1 | 24;
  subject: string;
  body: string;
  ctaLabel: string;
}

export interface RecoveryNudge {
  headline: string;
  itineraryLine: string;
  whyGateway: string[];
  loyaltyLine?: string;
  directValueLines: string[];
  disclaimer: string;
  primaryCta: string;
  secondaryCta: string;
}

export interface CreateRecoverySessionRequest {
  requestId: string;
  routeId: string;
  intent: TripIntent;
  trigger: RecoveryTrigger;
  consentReminder: boolean;
  screen: "results" | "handoff";
  email?: string;
  tripOutline?: string;
  reasons?: string[];
}

export interface RecoverySessionResponse {
  sessionId: string;
  status: RecoverySessionStatus;
  createdAt: string;
  nudge: RecoveryNudge;
  mockTimeline: MockReminderStep[];
  resume: {
    requestId: string;
    routeId: string;
    intent: TripIntent;
    screen: "results" | "handoff";
  };
  remindAfterHours: number;
}
