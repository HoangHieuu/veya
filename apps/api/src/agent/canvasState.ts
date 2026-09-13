import type {
  AgentAction,
  AgentCanvasState,
  DiscoveryMode,
  LocalityResolution,
  MemberDemoProfile,
  OfferQuote,
  RankedResponse,
} from "../../../../shared/types.js";

export interface BuildCanvasStateInput {
  discoveryMode: DiscoveryMode;
  recommendation: RankedResponse;
  locality?: LocalityResolution;
  offer?: OfferQuote;
  memberProfile: MemberDemoProfile;
  hasEnrollmentPolicy?: boolean;
  agentMessage?: string;
}

/** Build only renderable actions; it never changes scoring or route order. */
export function buildAgentCanvasState(
  input: BuildCanvasStateInput,
): AgentCanvasState {
  const card = input.recommendation.cards[0];
  const actions: AgentAction[] = [
    {
      type: "showIntent",
      summary: input.recommendation.intent.rawSummary,
    },
  ];

  if (input.locality) {
    actions.push({ type: "showLocality", resolution: structuredClone(input.locality) });
  }
  if (card) {
    actions.push({ type: "showRoute", cardIndex: 0 });
    if (card.experienceHighlights && card.experienceHighlights.length > 0) {
      actions.push({ type: "showExperiences", cardIndex: 0 });
    }
    if (input.offer?.eligible) {
      actions.push({ type: "showOffer", offer: structuredClone(input.offer) });
    }
    actions.push({ type: "showDirectValue", cardIndex: 0 });
    if (input.memberProfile === "guest" && input.hasEnrollmentPolicy) {
      actions.push({ type: "showEnrollment", policyId: "lotusmiles" });
    }
    actions.push({ type: "showHandoff", cardIndex: 0 });
  }

  return {
    discoveryMode: input.discoveryMode,
    agentMessage:
      card
        ? input.agentMessage?.trim() || "Your booking options are ready."
        : "No matching route is ready yet.",
    actions,
    ...(input.offer && input.discoveryMode === "discovery"
      ? { offer: structuredClone(input.offer) }
      : {}),
    ...(input.locality ? { locality: structuredClone(input.locality) } : {}),
  };
}
