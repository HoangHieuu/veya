import type {
  AgentCenterContent,
  AgentTurnResponse,
  DiscoveryStage,
  MemberDemoProfile,
  PolicyAnswer,
  PolicyOverlayId,
  TripSummary,
  TripSummaryPatch,
} from "@shared/types";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  ts: number;
  /** Grounded policy answer rendered with its citations under the bubble. */
  policyAnswer?: PolicyAnswer;
  /** Soft error styling for a failed turn. */
  tone?: "error";
}

export interface AgentSessionState {
  sessionId?: string;
  trip: TripSummary;
  stage: DiscoveryStage;
  centerContent: AgentCenterContent;
  messages: ChatMessage[];
  status: "idle" | "thinking" | "error";
  policyOverlay: PolicyOverlayId | null;
  lastMeta?: AgentTurnResponse["meta"];
}

export function emptyTrip(memberProfile: MemberDemoProfile = "guest"): TripSummary {
  return { memberProfile };
}

export function initialSessionState(
  memberProfile: MemberDemoProfile,
  opening: string,
): AgentSessionState {
  return {
    trip: emptyTrip(memberProfile),
    stage: "pick_origin",
    centerContent: { kind: "empty" },
    messages: [agentMessage(opening)],
    status: "idle",
    policyOverlay: null,
  };
}

let messageCounter = 0;
function nextId(): string {
  messageCounter += 1;
  return `m-${Date.now()}-${messageCounter}`;
}

export function agentMessage(
  text: string,
  extra: Pick<ChatMessage, "policyAnswer" | "tone"> = {},
): ChatMessage {
  return { id: nextId(), role: "agent", text, ts: Date.now(), ...extra };
}

export function userMessage(text: string): ChatMessage {
  return { id: nextId(), role: "user", text, ts: Date.now() };
}

/**
 * Apply a server patch to the local trip. A `null` value clears the field —
 * that is how a correction ("actually, not Da Nang") removes an earlier answer
 * instead of leaving a stale one behind.
 */
export function applyTripPatch(
  trip: TripSummary,
  patch: TripSummaryPatch,
): TripSummary {
  const next = { ...trip } as Record<string, unknown>;
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) {
      delete next[field];
      continue;
    }
    next[field] = value;
  }
  return next as unknown as TripSummary;
}

/** Fold one server turn into session state. The server owns stage and centre. */
export function reduceTurn(
  state: AgentSessionState,
  response: AgentTurnResponse,
): AgentSessionState {
  const trip = response.resetTrip
    ? emptyTrip(state.trip.memberProfile)
    : applyTripPatch(state.trip, response.tripPatch);

  return {
    ...state,
    sessionId: response.sessionId,
    trip,
    stage: response.stage,
    centerContent: response.centerContent,
    status: "idle",
    policyOverlay:
      response.policyOverlay === undefined
        ? state.policyOverlay
        : response.policyOverlay,
    lastMeta: response.meta,
    messages: [
      ...state.messages,
      agentMessage(response.agentMessage, {
        ...(response.policyAnswer ? { policyAnswer: response.policyAnswer } : {}),
      }),
    ],
  };
}

const GATEWAY_LABEL: Record<string, string> = {
  HAN: "Hanoi",
  SGN: "Ho Chi Minh City",
  DAD: "Da Nang",
};

const ORIGIN_LABEL: Record<string, string> = {
  SYD: "Sydney",
  MEL: "Melbourne",
  PER: "Perth",
};

export function originLabel(code?: string): string {
  return code ? (ORIGIN_LABEL[code] ?? code) : "—";
}

export function gatewayLabel(code?: string): string {
  return code ? (GATEWAY_LABEL[code] ?? code) : "—";
}

export function formatAud(value: number): string {
  return value.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatTripDate(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return iso;
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
