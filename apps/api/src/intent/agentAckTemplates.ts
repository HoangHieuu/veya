/**
 * Deterministic agent ack lines (TDD-v2 §V #18 / §VIII).
 * Action type names match AgentAction in the Round 2 contract.
 */

export type AgentAckActionType =
  | "showIntent"
  | "showLocality"
  | "showRoute"
  | "showExperiences"
  | "showOffer"
  | "showDirectValue"
  | "showEnrollment"
  | "showHandoff";

export interface AgentAckVars {
  localityTitle?: string;
  gateway?: string;
}

const TEMPLATES: Readonly<Record<AgentAckActionType, (vars: AgentAckVars) => string>> = {
  showIntent: () => "Got it — here is what I heard about your trip.",
  showLocality: (vars) => {
    const place = vars.localityTitle?.trim();
    const gateway = vars.gateway?.trim();
    if (place && gateway) {
      return `${place} is reached via ${gateway}.`;
    }
    if (place) {
      return `${place} maps to the nearest Vietnam Airlines gateway.`;
    }
    return "Here is the locality and nearest gateway.";
  },
  showRoute: () => "Here are the best-fit gateways for this trip.",
  showExperiences: () => "A few ideas for after you land.",
  showOffer: () =>
    "A limited Direct Decision Offer may apply while you explore.",
  showDirectValue: () => "Booking direct keeps your trip in one place.",
  showEnrollment: () => "Join Lotusmiles to unlock member fares.",
  showHandoff: () => "Ready when you are — continue on Vietnam Airlines.",
};

function sentenceCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/(?<=[.!?])\s+/).filter(Boolean).length;
}

/** Returns ≤2 short English sentences. Never calls an LLM. */
export function buildAgentAck(
  actionType: AgentAckActionType,
  vars: AgentAckVars = {},
): string {
  const text = TEMPLATES[actionType](vars).trim();
  if (sentenceCount(text) > 2) {
    return text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  }
  return text;
}

export const AGENT_ACK_ACTION_TYPES = Object.keys(
  TEMPLATES,
) as AgentAckActionType[];
