import type { DestinationCity, RankedResponse, TripIntent } from "@shared/types";
import type { MemberDemoProfile } from "./memberDemo";

/** Local duplicate until D merges Appendix E into shared/types.ts */
export type DiscoveryMode = "discovery" | "route_known";

export interface OfferQuote {
  eligible: boolean;
  ineligibleReason?: string;
  /** Standard Lotusmiles earn on this route (illustrative) */
  baseMiles: number;
  /** Limited-time bonus if booked before expiresAt */
  bonusMiles: number;
  /** baseMiles + bonusMiles when offer is claimed */
  totalMiles: number;
  expiresAt: string;
  termsId: string;
  illustrative: true;
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
}

export type AgentAction =
  | { type: "showIntent"; summary: string; intent: TripIntent }
  | { type: "showLocality"; resolution: LocalityResolution }
  | { type: "showRoute"; cardIndex: number }
  | { type: "showExperiences"; cardIndex: number }
  | { type: "showOffer"; offer: OfferQuote }
  | { type: "showDirectValue"; cardIndex: number }
  | { type: "showEnrollment" }
  | { type: "showHandoff"; cardIndex: number };

export interface AgentCanvasState {
  discoveryMode: DiscoveryMode;
  agentMessage: string;
  actions: AgentAction[];
  offer?: OfferQuote;
  locality?: LocalityResolution;
  response: RankedResponse;
}

import type { AgentWidget } from "./agentFlow";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  ts: number;
  /** Inline wizard-style picker shown inside the agent bubble */
  widget?: AgentWidget;
}

export interface AgentSessionState {
  messages: ChatMessage[];
  canvas?: AgentCanvasState;
  status: "idle" | "typing" | "ready" | "error";
  errorMessage?: string;
  memberProfile: MemberDemoProfile;
}
