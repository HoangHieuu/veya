import type {
  AgentAction,
  AgentAckVars,
  DiscoveryMode,
  DiscoveryStage,
  NextTripField,
  PolicyOverlayId,
  TripIntent,
  TripSummary,
} from "../../../../shared/types.js";
import {
  understandMessage as cUnderstandMessage,
  type UnderstandOptions,
  type UnderstoodMessage,
} from "../intent/messageUnderstanding.js";
import {
  buildAgentAck as cBuildAgentAck,
} from "../intent/agentAckTemplates.js";
import { finalizeTripIntent as cFinalizeTripIntent } from "../intent/finalizeTripIntent.js";
import {
  classifyDiscoveryMode as cClassifyDiscoveryMode,
} from "../intent/discoveryMode.js";
import {
  classifyPolicyIntent as cClassifyPolicyIntent,
  patchTripSummary as cPatchTripSummary,
  suggestNextField as cSuggestNextField,
  type LocalTripSummary,
} from "../intent/tripOrchestration.js";

export interface AgentIntentDependencies {
  /** Free-text turn -> intent + trip patch (null clears a field). */
  understandMessage(
    message: string,
    current: TripSummary,
    options: UnderstandOptions,
  ): Promise<UnderstoodMessage>;
  patchTripSummary(
    message: string,
    current: TripSummary,
  ): Promise<Partial<TripSummary>> | Partial<TripSummary>;
  classifyDiscoveryMode(
    intent: TripIntent | null,
    briefText?: string,
  ): DiscoveryMode | undefined;
  /** Optional C-owned signal for a clear free-text mode change after session start. */
  shouldClassifyDiscoveryMode?(message: string, current: TripSummary): boolean;
  suggestNextField(trip: TripSummary): NextTripField;
  finalizeTripIntent?: (trip: TripSummary, options: { now: Date }) => TripIntent;
  classifyPolicyIntent(message: string): PolicyOverlayId | null;
  buildAgentAck(actionType: AgentAction["type"], vars?: AgentAckVars): string;
  buildNextFieldPrompt(input: {
    stage: DiscoveryStage;
    nextField: NextTripField;
    trip: TripSummary;
  }): string;
}

/** Temporary boundary adapter until C removes its local Round 2 type mirrors. */
export function createDefaultAgentIntentDependencies(): AgentIntentDependencies {
  return {
    understandMessage(message, current, options) {
      return cUnderstandMessage(message, current, options);
    },
    patchTripSummary(message, current) {
      return cPatchTripSummary(
        message,
        current as unknown as Partial<LocalTripSummary>,
      ) as unknown as Partial<TripSummary>;
    },
    classifyDiscoveryMode(intent, briefText) {
      const text = briefText?.trim();
      if (!text) return undefined;
      if (intent) return cClassifyDiscoveryMode(intent, text);

      // C's current implementation classifies from briefText and does not read the
      // TripIntent argument. Keep this compatibility call at the boundary so D does
      // not duplicate C's route-known/discovery heuristics.
      return cClassifyDiscoveryMode(undefined as unknown as TripIntent, text);
    },
    suggestNextField(trip) {
      const cField = cSuggestNextField(
        trip as unknown as Partial<LocalTripSummary>,
      );
      return normalizeNextField(cField, trip);
    },
    finalizeTripIntent: cFinalizeTripIntent,
    classifyPolicyIntent: cClassifyPolicyIntent,
    buildAgentAck(actionType, vars) {
      return cBuildAgentAck(actionType as Parameters<typeof cBuildAgentAck>[0], vars);
    },
    buildNextFieldPrompt: buildDefaultNextFieldPrompt,
  };
}

function normalizeNextField(
  field: string,
  trip: TripSummary,
): NextTripField {
  if (field === "originCity" || field === "travelStyle" || field === "destinationLocalityId") {
    return field;
  }
  if (field === "travellers") return "travellers";
  if (field === "departMonth") {
    return trip.departDate && !trip.returnDate ? "returnDate" : "departMonth";
  }
  if (field === "gateway") {
    return nextBookingField(trip);
  }
  if (field === "book") {
    return nextBookingField(trip);
  }
  return nextBookingField(trip);
}

function nextBookingField(trip: TripSummary): NextTripField {
  if (!trip.originCity) return "originCity";
  if (!trip.travelStyle) return "travelStyle";
  if (!trip.destinationLocalityId) return "destinationLocalityId";
  if (trip.travellers === undefined) return "travellers";
  if (!trip.departDate) return "departDate";
  if (!trip.returnDate) return "returnDate";
  if (!trip.fareBrandId) return "fareBrand";
  return null;
}

function buildDefaultNextFieldPrompt(input: {
  stage: DiscoveryStage;
  nextField: NextTripField;
  trip: TripSummary;
}): string {
  switch (input.nextField) {
    case "originCity":
      return "Where will you fly from: Sydney, Melbourne or Perth?";
    case "travelStyle":
      return "What kind of trip are you planning — family, beach, food and culture, or something else?";
    case "destinationLocalityId":
      return "Which destination or locality would you like to explore?";
    case "travellers":
      return "How many adults are travelling?";
    case "departDate":
      return "What is your departure date? Please use YYYY-MM-DD.";
    case "returnDate":
      return "What is your return date? Please use YYYY-MM-DD.";
    case "departMonth":
      return "When would you roughly like to travel?";
    case "fareBrand":
      return input.stage === "booking"
        ? "Pick a fare in the centre — Lite, Classic, Flex, Premium Economy or Business. I can explain the baggage and change rules for any of them."
        : input.stage === "season"
          ? "Have a look at the seasonal note, then continue when you want to see fares."
          : "Your trip is complete — continue when you want to see fares.";
    case null:
      return input.stage === "season"
        ? "Review the seasonal note, then continue when you are ready to book."
        : input.stage === "booking"
          ? "Your fare is locked in — review it in the centre, then continue on Vietnam Airlines."
          : "Your trip details are ready for the next step.";
  }
}
