import { createHash } from "node:crypto";

import type { AppDependencies } from "../app.js";
import {
  type AgentCenterContent,
  type AgentInputEvent,
  type AgentMessageIntent,
  type AgentTurnRequest,
  type AgentTurnResponse,
  type DestinationSuggestion,
  type DiscoveryMode,
  type DiscoveryStage,
  type FareOption,
  type FlightItineraryView,
  type LocalityResolution,
  type MonthName,
  type NextTripField,
  type PolicyAnswer,
  type PolicyOverlayId,
  type TripIntent,
  type TripSummary,
  type TripSummaryPatch,
} from "../../../../shared/types.js";
import { HttpApiError, httpError } from "../errors.js";
import {
  formatValidationIssues,
  tripSummarySchema,
  tripIntentSchema,
} from "../validation.js";
import { requireDataset, recommendFromIntent } from "../routes/recommend.js";
import type { TripPatch } from "../intent/messageUnderstanding.js";
import { buildAgentCanvasState } from "./canvasState.js";
import { buildDestinationSuggestions } from "./destinationSuggestions.js";
import { buildFareOptions, buildItineraries, findFareOption } from "./fareOptions.js";
import { answerPolicyQuestion } from "./policyRag.js";
import { resolveLocalityGateway } from "./localityResolution.js";
import { buildOfferQuote } from "./offerQuote.js";
import { buildSeasonNote } from "./seasonNote.js";
import type { AgentSession } from "./sessionStore.js";

export async function handleAgentTurn(
  input: AgentTurnRequest,
  dependencies: AppDependencies,
): Promise<AgentTurnResponse> {
  const requestNow = dependencies.clock();
  const createdNewSession = input.sessionId === undefined;
  const session = getOrCreateSession(input, dependencies, requestNow);
  try {
    return await executeAgentTurn(input, dependencies, requestNow, session);
  } catch (error) {
    if (createdNewSession) dependencies.agentSessionStore.delete(session.id);
    throw error;
  }
}

async function executeAgentTurn(
  input: AgentTurnRequest,
  dependencies: AppDependencies,
  requestNow: Date,
  session: AgentSession,
): Promise<AgentTurnResponse> {
  const currentTrip = structuredClone(input.trip);

  if (input.event?.type === "reset_journey") {
    resetSession(session, requestNow, dependencies);
    return {
      sessionId: session.id,
      discoveryMode: "discovery",
      tripPatch: { memberProfile: currentTrip.memberProfile },
      resetTrip: true,
      nextField: "originCity",
      agentMessage: "Your trip has been reset. Where will you fly from?",
      stage: "pick_origin",
      centerContent: inspirationContent(dependencies),
      policyOverlay: null,
      meta: baseMeta(dependencies, requestNow, false, []),
    };
  }

  let sessionInvalidated = false;
  if (
    session.tripFingerprint &&
    session.tripFingerprint !== fingerprintTrip(currentTrip)
  ) {
    session.offer = undefined;
    session.bookingRequestId = undefined;
    session.bookingGeneratedAt = undefined;
    session.seasonAcknowledged = false;
    session.lastStage = undefined;
    sessionInvalidated = true;
  }

  const result = await applyInput(
    currentTrip,
    input,
    dependencies,
    session.discoveryMode === undefined,
    requestNow,
  );

  if (result.requestReset) {
    resetSession(session, requestNow, dependencies);
    return {
      sessionId: session.id,
      discoveryMode: "discovery",
      tripPatch: { memberProfile: currentTrip.memberProfile },
      resetTrip: true,
      nextField: "originCity",
      agentMessage: "Starting fresh. Where will you fly from — Sydney, Melbourne or Perth?",
      stage: "pick_origin",
      centerContent: inspirationContent(dependencies),
      policyOverlay: null,
      messageIntent: "reset",
      meta: baseMeta(dependencies, requestNow, false, []),
    };
  }

  const nextTrip = enrichTripFromData(result.trip, dependencies);
  const touched = diffTrip(currentTrip, nextTrip);
  const routeChanged = touched.some((field) =>
    [
      "originCity",
      "travelStyle",
      "destinationLocalityId",
      "gateway",
      "travellers",
      "departMonth",
      "departDate",
      "returnDate",
    ].includes(field),
  );
  // A different route prices differently, so the chosen brand no longer applies.
  // Party size is not part of that: it only re-totals the same per-adult fare,
  // so the traveller keeps their selection.
  const farePriceInvalidated = touched.some((field) =>
    ["originCity", "gateway", "destinationLocalityId", "departDate", "returnDate"].includes(
      field,
    ),
  );
  if (farePriceInvalidated && nextTrip.fareBrandId) delete nextTrip.fareBrandId;

  const changedFields = diffTrip(currentTrip, nextTrip);
  if (routeChanged) {
    session.offer = undefined;
    session.bookingRequestId = undefined;
    session.bookingGeneratedAt = undefined;
    sessionInvalidated = true;
  }
  if (changedFields.some((field) => ["destinationLocalityId", "gateway", "departMonth", "departDate", "returnDate"].includes(field))) {
    session.seasonAcknowledged = false;
    sessionInvalidated = true;
  }

  const discoveryMode = resolveDiscoveryMode(session, result.mode);
  const locality = nextTrip.destinationLocalityId
    ? resolveLocality(nextTrip, dependencies)
    : undefined;
  const continueBooking = input.event?.type === "continue_booking";
  if (continueBooking) {
    const missingFields = missingFieldsFromTrip(nextTrip);
    if (missingFields.length > 0) {
      if (sessionInvalidated) {
        session.updatedAt = requestNow.toISOString();
        dependencies.agentSessionStore.set(session);
      }
      throw httpError(
        400,
        "INTENT_INCOMPLETE",
        "The trip is missing details required to continue to booking.",
        { missingFields },
      );
    }
  }
  const stage = chooseStage({
    trip: nextTrip,
    previousStage: session.lastStage,
    policyOnly: result.policyOnly,
    continueBooking,
    seasonAcknowledged: session.seasonAcknowledged,
  });
  const resultModeIsAuthoritative =
    result.mode !== undefined &&
    (
      input.event !== undefined ||
      result.mode === "route_known" ||
      changedFields.some((field) => field !== "memberProfile")
    );
  const discoveryModeResolved =
    session.discoveryMode !== undefined || resultModeIsAuthoritative;
  if (stage === "booking" && !discoveryModeResolved) {
    throw httpError(
      503,
      "AGENT_INTENT_UNAVAILABLE",
      "The discovery-mode classifier from Person C is not ready yet.",
    );
  }

  const nextField = dependencies.agentIntent.suggestNextField(nextTrip);
  const agentMessage = stage === "booking"
    ? dependencies.agentIntent.buildNextFieldPrompt({
        stage,
        nextField,
        trip: nextTrip,
      })
    : result.policyId
      ? "Here are the policy details for this trip."
      : stage === "destination_detail" && locality
        ? dependencies.agentIntent.buildAgentAck("showLocality", {
            localityTitle: locality.localityTitle,
            gateway: locality.gateway,
          })
        : dependencies.agentIntent.buildNextFieldPrompt({
            stage,
            nextField,
            trip: nextTrip,
          });

  let policySnippet = result.policyId
    ? getPolicySnippet(result.policyId, dependencies)
    : undefined;
  let centerContent: AgentCenterContent;
  let offer = session.offer;
  let bookingRequestId: string | undefined;
  let bookingGeneratedAt: string | undefined;
  let fareOptions: FareOption[] = [];
  let itineraries: FlightItineraryView[] = [];
  let selectedFare: FareOption | undefined;
  const sourceFields = [...(locality?.sourceFields ?? [])];

  if (stage === "pick_origin") {
    centerContent = inspirationContent(dependencies, nextTrip.travelStyle);
    if (centerContent.kind === "destination_grid") {
      sourceFields.push(
        ...centerContent.suggestions.flatMap((suggestion) => suggestion.sourceFields),
      );
    }
  } else if (stage === "suggested_destinations") {
    if (!nextTrip.originCity) {
      centerContent = { kind: "empty" };
    } else {
      requireCapability(dependencies, "destinations");
      const suggestions = buildDestinationSuggestions(
        { originCity: nextTrip.originCity, travelStyle: nextTrip.travelStyle, limit: 6 },
        dependencies.agentData,
      );
      centerContent = { kind: "destination_grid", suggestions };
      sourceFields.push(...suggestions.flatMap((suggestion) => suggestion.sourceFields));
    }
  } else if (stage === "destination_detail") {
    // A destination typed in chat ("Ninh Binh", "Hoi An") will not be in the
    // curated suggestion grid. As long as we resolved a gateway for it, render
    // it from the trip itself rather than failing the turn.
    const suggestion =
      getSelectedSuggestion(nextTrip, dependencies) ?? suggestionFromTrip(nextTrip);
    const resolved =
      locality ?? resolveFromSuggestion(suggestion) ?? localityFromTrip(nextTrip);
    if (!suggestion || !resolved) {
      requireCapability(dependencies, "destinations");
      throw httpError(
        503,
        "AGENT_DATA_UNAVAILABLE",
        "Destination detail data is not ready yet.",
      );
    }
    centerContent = {
      kind: "destination_detail",
      suggestion: structuredClone(suggestion),
      locality: structuredClone(resolved),
    };
    sourceFields.push(...suggestion.sourceFields, ...resolved.sourceFields);
  } else if (stage === "season") {
    if (!nextTrip.destinationLocalityId || !nextTrip.departMonth) {
      centerContent = { kind: "empty" };
    } else {
      requireCapability(dependencies, "season");
      const note = buildSeasonNote(
        nextTrip.destinationLocalityId,
        nextTrip.departMonth,
        dependencies.agentData,
        nextTrip.gateway,
      );
      if (!note) {
        throw httpError(503, "AGENT_DATA_UNAVAILABLE", "Season data is not ready for this destination.");
      }
      centerContent = { kind: "season", note };
      sourceFields.push(...note.sourceFields);
    }
  } else if (stage === "hotels") {
    centerContent = { kind: "hotels", localityId: nextTrip.destinationLocalityId ?? "" };
  } else {
    const intent = finalizeIntent(nextTrip, dependencies, requestNow);
    const dataset = requireDataset(dependencies);
    const recommendationNow = result.policyOnly && session.bookingGeneratedAt
      ? new Date(session.bookingGeneratedAt)
      : requestNow;
    bookingRequestId = result.policyOnly && session.bookingRequestId
      ? session.bookingRequestId
      : dependencies.idGenerator();
    bookingGeneratedAt = recommendationNow.toISOString();
    const recommendation = recommendFromIntent(intent, {
      dataset,
      now: recommendationNow,
      requestId: bookingRequestId,
      auditStore:
        !result.policyOnly && dependencies.enableDevScoring
          ? dependencies.auditStore
          : undefined,
      experienceHighlightsFor: dependencies.experienceHighlightsFor,
    });
    if (recommendation.cards.length === 0) {
      offer = undefined;
    } else if (discoveryMode === "discovery") {
      requireCapability(dependencies, "offer");
      offer ??= buildOfferQuote({
        trip: nextTrip,
        recommendation,
        discoveryMode,
        data: dependencies.agentData,
        now: recommendationNow,
      });
      if (!offer) {
        throw httpError(
          503,
          "AGENT_DATA_UNAVAILABLE",
          "Offer data is not ready for the selected route.",
        );
      }
    } else {
      offer = undefined;
    }
    const canvas = buildAgentCanvasState({
      discoveryMode,
      recommendation,
      locality,
      offer,
      memberProfile: nextTrip.memberProfile,
      hasEnrollmentPolicy: dependencies.agentData.policies.some(
        (policy) => policy.id === "lotusmiles",
      ),
      agentMessage,
    });
    const card = recommendation.cards[0];
    fareOptions = card
      ? buildFareOptions({ card, trip: nextTrip, data: dependencies.agentData })
      : [];
    itineraries = card ? buildItineraries(card, nextTrip) : [];
    selectedFare = findFareOption(fareOptions, nextTrip.fareBrandId);
    // A brand that no longer exists in the grid must not linger on the trip.
    if (nextTrip.fareBrandId && !selectedFare) delete nextTrip.fareBrandId;
    centerContent = {
      kind: "booking",
      recommendation,
      canvas,
      fareOptions,
      itineraries,
      ...(selectedFare
        ? {
            selectedFare: {
              fare: structuredClone(selectedFare),
              travellers: nextTrip.travellers ?? 1,
              totalAud: selectedFare.totalAud,
              selectedAt: requestNow.toISOString(),
            },
          }
        : {}),
    };
    sourceFields.push(...fareOptions.flatMap((option) => option.sourceFields));
    sourceFields.push(...recommendation.cards.flatMap((card) => [
      card.route.sourceDocument,
      "route.id",
      "route.tripArchetypes",
      "route.connectionType",
      "route.bestMonths",
      "route.gettingAround",
    ]));
    if (offer) sourceFields.push(...offer.sourceFields);
  }

  let policyAnswer: PolicyAnswer | undefined;
  let finalMessage = agentMessage;

  if (result.policyQuestion) {
    policyAnswer = await resolvePolicyAnswer(
      result.policyQuestion,
      nextTrip,
      centerContent,
      dependencies,
    );
    finalMessage = policyAnswer.answered
      ? policyAnswer.answer
      : policyAnswer.lookupFailed
        ? "My policy lookup did not respond just then, so I have not answered rather than guess. Ask me again in a moment."
        : "I could not find that in the Vietnam Airlines policy pages I have indexed, so I would rather not guess. Try rephrasing, or check vietnamairlines.com for the exact rule.";
  } else if (result.messageIntent === "select_fare" && selectedFare) {
    finalMessage = `${selectedFare.brandLabel} it is — A$${formatAud(selectedFare.totalAud)} total for ${nextTrip.travellers ?? 1} adult${(nextTrip.travellers ?? 1) > 1 ? "s" : ""}, ${selectedFare.checkedBaggage} checked. Ask me about its baggage or change rules any time.`;
  } else if (result.messageIntent === "smalltalk" && stage !== "booking") {
    finalMessage = `Hi! Tell me about your Vietnam trip and I will build it in the centre panel. ${agentMessage}`;
  } else if (result.messageIntent === "unknown") {
    finalMessage = `I did not catch a trip detail in that. ${agentMessage}`;
  } else if (result.messageIntent === "change_trip" && changedFields.length > 0) {
    finalMessage = `${describeChanges(changedFields, nextTrip)} ${agentMessage}`;
  }

  if (result.policyId && !policySnippet) {
    if (dependencies.agentData.capabilities.policies === "ready") {
      throw httpError(400, "INVALID_AGENT_INPUT", "The requested policy is not available.");
    }
    throw httpError(503, "AGENT_DATA_UNAVAILABLE", "Policy data is not ready yet.");
  }
  if (policySnippet) sourceFields.push(...policySnippet.sourceFields);

  if (discoveryModeResolved) session.discoveryMode = discoveryMode;
  session.lastStage = stage;
  session.updatedAt = requestNow.toISOString();
  session.tripFingerprint = fingerprintTrip(nextTrip);
  if (stage === "booking") {
    session.offer = offer;
    session.bookingRequestId = bookingRequestId;
    session.bookingGeneratedAt = bookingGeneratedAt;
    session.seasonAcknowledged = true;
  }
  dependencies.agentSessionStore.set(session);

  const usedIllustrativeData =
    stage === "season" || stage === "destination_detail" ||
    (centerContent.kind === "booking" &&
      (centerContent.recommendation.meta.usedIllustrativeData || Boolean(offer)));
  return {
    sessionId: session.id,
    discoveryMode,
    tripPatch: changedFields.reduce<TripSummaryPatch>((patch, field) => {
      const value = nextTrip[field as keyof TripSummary];
      patch[field as keyof TripSummary] = value === undefined
        ? null
        : structuredClone(value) as never;
      return patch;
    }, {}),
    resetTrip: false,
    nextField,
    agentMessage: finalMessage,
    stage,
    centerContent,
    ...(centerContent.kind === "booking" ? { canvas: centerContent.canvas } : {}),
    ...(result.policyId ? { policyOverlay: result.policyId } : input.event?.type === "close_policy" ? { policyOverlay: null } : {}),
    ...(policySnippet ? { policySnippet } : {}),
    ...(policyAnswer ? { policyAnswer } : {}),
    ...(result.messageIntent ? { messageIntent: result.messageIntent } : {}),
    meta: baseMeta(dependencies, requestNow, usedIllustrativeData, sourceFields),
  };
}

interface AppliedInput {
  trip: TripSummary;
  mode?: DiscoveryMode;
  policyOnly: boolean;
  policyId?: PolicyOverlayId;
  /** Free-text policy question to answer from the corpus after the trip resolves. */
  policyQuestion?: string;
  messageIntent?: AgentMessageIntent;
  requestReset?: boolean;
}

async function applyInput(
  current: TripSummary,
  input: AgentTurnRequest,
  dependencies: AppDependencies,
  shouldClassifyMode: boolean,
  now: Date,
): Promise<AppliedInput> {
  if (input.event) {
    if (input.event.type === "view_policy") {
      return { trip: current, policyOnly: true, policyId: input.event.policyId };
    }
    if (input.event.type === "close_policy") {
      return { trip: current, policyOnly: true };
    }
    if (input.event.type === "open_workspace") {
      // Pure render request: never advances the journey or resolves a mode.
      return { trip: current, policyOnly: false };
    }
    return {
      trip: applyEvent(current, input.event, dependencies),
      mode: "discovery",
      policyOnly: false,
      messageIntent: input.event.type === "select_fare" ? "select_fare" : undefined,
    };
  }

  const message = input.message?.trim() ?? "";

  // Keyword overlays stay ahead of the corpus: they open a specific curated
  // panel ("offer terms") rather than answering in prose.
  const policyId = dependencies.agentIntent.classifyPolicyIntent(message);
  if (policyId) {
    return {
      trip: current,
      policyOnly: true,
      policyId,
      messageIntent: "policy_question",
    };
  }

  let understood;
  try {
    understood = await dependencies.agentIntent.understandMessage(message, current, {
      now,
      apiKey: process.env.OPENAI_API_KEY?.trim(),
    });
  } catch (error) {
    throw mapIntentDependencyError(error, "The intent patcher failed unexpectedly.");
  }

  if (understood.intent === "reset") {
    return { trip: current, policyOnly: false, requestReset: true, messageIntent: "reset" };
  }

  if (understood.intent === "policy_question") {
    return {
      trip: current,
      policyOnly: true,
      policyQuestion: understood.policyQuestion ?? message,
      messageIntent: "policy_question",
    };
  }

  const nextTrip = canonicalizeTrip(applyTripPatch(current, understood.patch));

  let mode: DiscoveryMode | undefined;
  const messageChangedRoute =
    understood.intent === "change_trip" ||
    understood.patch.gateway !== undefined ||
    understood.patch.destinationLocalityId !== undefined;
  if (
    shouldClassifyMode ||
    messageChangedRoute ||
    dependencies.agentIntent.shouldClassifyDiscoveryMode?.(message, current)
  ) {
    try {
      mode = dependencies.agentIntent.classifyDiscoveryMode(null, message);
    } catch (error) {
      throw mapIntentDependencyError(
        error,
        "The discovery-mode classifier failed unexpectedly.",
      );
    }
  }
  return {
    trip: nextTrip,
    mode,
    policyOnly: false,
    messageIntent: understood.intent,
  };
}

/**
 * Merge a patch onto the trip. `null` deletes the field, which is how a
 * correction ("actually, not Da Nang") unwinds an earlier answer; `undefined`
 * or an absent key leaves the current value alone.
 */
export function applyTripPatch(
  current: TripSummary,
  patch: TripPatch,
): TripSummary {
  const next = structuredClone(current) as unknown as Record<string, unknown>;
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

function applyEvent(
  current: TripSummary,
  event: AgentInputEvent,
  dependencies: AppDependencies,
): TripSummary {
  const next = structuredClone(current);
  switch (event.type) {
    case "select_origin":
      next.originCity = event.originCity;
      if (
        current.destinationLocalityId &&
        !destinationSupportsOrigin(current.destinationLocalityId, event.originCity, dependencies)
      ) {
        delete next.destinationLocalityId;
        delete next.destinationTitle;
        delete next.gateway;
      }
      return next;
    case "select_vibe":
      next.travelStyle = event.travelStyle;
      return next;
    case "select_destination": {
      const suggestion = dependencies.agentData.destinationSuggestions.find(
        (item) => item.localityId === event.destinationLocalityId,
      );
      const locality = resolveLocalityGateway(event.destinationLocalityId, dependencies.agentData);
      if (!suggestion && !locality) {
        if (
          dependencies.agentData.capabilities.destinations === "unavailable" &&
          dependencies.agentData.capabilities.locality === "unavailable"
        ) {
          throw httpError(503, "AGENT_DATA_UNAVAILABLE", "Destination data is not ready yet.");
        }
        throw httpError(400, "INVALID_AGENT_INPUT", "The selected destination is not supported.");
      }
      if (suggestion?.supportedOrigins && next.originCity && !suggestion.supportedOrigins.includes(next.originCity)) {
        throw httpError(400, "INVALID_AGENT_INPUT", "The selected destination is not supported from this origin.");
      }
      next.destinationLocalityId = event.destinationLocalityId;
      next.destinationTitle = suggestion?.title ?? locality?.localityTitle ?? event.destinationTitle;
      next.gateway = suggestion?.gateway ?? locality?.gateway;
      return next;
    }
    case "set_travellers":
      next.travellers = event.travellers;
      return next;
    case "set_dates":
      next.departDate = event.departDate;
      next.returnDate = event.returnDate;
      next.departMonth = monthNameFromIso(event.departDate);
      return next;
    case "select_fare":
      next.fareBrandId = event.fareBrandId;
      return next;
    case "open_workspace":
    case "continue_booking":
    case "view_policy":
    case "close_policy":
    case "reset_journey":
      return next;
  }
}

function chooseStage(input: {
  trip: TripSummary;
  previousStage?: DiscoveryStage;
  policyOnly: boolean;
  continueBooking: boolean;
  seasonAcknowledged: boolean;
}): DiscoveryStage {
  if (input.policyOnly && input.previousStage) return input.previousStage;
  if (!input.trip.originCity) return "pick_origin";
  if (!input.trip.travelStyle || !input.trip.destinationLocalityId) {
    return "suggested_destinations";
  }
  if (!input.trip.gateway || input.trip.travellers === undefined) {
    return "destination_detail";
  }
  if (!input.trip.departMonth && !input.trip.departDate) {
    return "destination_detail";
  }
  // Once the traveller has reached booking, a later correction re-prices in
  // place instead of demoting them back through the season step.
  if (input.previousStage === "booking") return "booking";
  if (!input.continueBooking) return "season";
  return "booking";
}

function resolveDiscoveryMode(
  session: AgentSession,
  eventMode: DiscoveryMode | undefined,
): DiscoveryMode {
  if (session.discoveryMode === "discovery") return "discovery";
  if (session.discoveryMode === "route_known") return "route_known";
  if (eventMode) return eventMode;
  // Public contract has no unresolved value. Use discovery for presentation but
  // do not persist it; booking still fails closed until C positively classifies.
  return "discovery";
}

function finalizeIntent(
  trip: TripSummary,
  dependencies: AppDependencies,
  now: Date,
): TripIntent {
  if (!dependencies.agentIntent.finalizeTripIntent) {
    throw httpError(
      503,
      "AGENT_INTENT_UNAVAILABLE",
      "The intent finalizer from Person C is not ready yet.",
    );
  }
  let intent: TripIntent;
  try {
    intent = dependencies.agentIntent.finalizeTripIntent(trip, { now });
  } catch (error) {
    throw mapIntentDependencyError(
      error,
      "The intent finalizer failed unexpectedly.",
    );
  }
  const parsed = tripIntentSchema.safeParse(intent);
  if (!parsed.success) {
    const missingFields = [
      ...missingFieldsFromTrip(trip),
      ...parsed.error.issues.flatMap((issue) => {
        const field = issue.path[0];
        return typeof field === "string" ? [field] : [];
      }),
    ];
    throw httpError(
      400,
      "INTENT_INCOMPLETE",
      `The trip details are incomplete: ${formatValidationIssues(parsed.error)}`,
      { missingFields: [...new Set(missingFields)] },
    );
  }
  return structuredClone(parsed.data as TripIntent);
}

function getOrCreateSession(
  input: AgentTurnRequest,
  dependencies: AppDependencies,
  now: Date,
): AgentSession {
  if (input.sessionId) {
    const session = dependencies.agentSessionStore.get(input.sessionId, now);
    if (!session) {
      throw httpError(404, "AGENT_SESSION_NOT_FOUND", "The agent session was not found or has expired.");
    }
    return session;
  }
  return dependencies.agentSessionStore.create(
    now,
    dependencies.idGenerator,
    dependencies.agentData.directOfferPolicy?.expiryHours,
  );
}

function resetSession(
  session: AgentSession,
  now: Date,
  dependencies: AppDependencies,
): void {
  session.discoveryMode = undefined;
  session.lastStage = undefined;
  session.seasonAcknowledged = false;
  session.offer = undefined;
  session.bookingRequestId = undefined;
  session.bookingGeneratedAt = undefined;
  session.tripFingerprint = fingerprintTrip({ memberProfile: "guest" });
  session.updatedAt = now.toISOString();
  dependencies.agentSessionStore.set(session);
}

function resolveLocality(
  trip: TripSummary,
  dependencies: AppDependencies,
): LocalityResolution | undefined {
  if (!trip.destinationLocalityId) return undefined;
  return resolveLocalityGateway(trip.destinationLocalityId, dependencies.agentData);
}

function enrichTripFromData(
  trip: TripSummary,
  dependencies: AppDependencies,
): TripSummary {
  const next = structuredClone(trip);
  if (next.departDate) {
    next.departMonth = monthNameFromIso(next.departDate);
  }
  if (!next.destinationLocalityId) return next;

  const locality = resolveLocalityGateway(next.destinationLocalityId, dependencies.agentData);
  const suggestion = getSelectedSuggestion(next, dependencies);
  const canonicalGateway = locality?.gateway ?? suggestion?.gateway;
  if (canonicalGateway) next.gateway = canonicalGateway;
  if (!next.destinationTitle) {
    next.destinationTitle = locality?.localityTitle ?? suggestion?.title;
  }
  return next;
}

function getSelectedSuggestion(
  trip: TripSummary,
  dependencies: AppDependencies,
): DestinationSuggestion | undefined {
  return trip.destinationLocalityId
    ? dependencies.agentData.destinationSuggestions.find(
        (suggestion) => suggestion.localityId === trip.destinationLocalityId,
      )
    : undefined;
}

/**
 * Minimal suggestion card for a destination the traveller named in chat that
 * B's curated grid does not cover. Carries no editorial copy it cannot source.
 */
function suggestionFromTrip(trip: TripSummary): DestinationSuggestion | undefined {
  if (!trip.destinationLocalityId || !trip.gateway) return undefined;
  const title = trip.destinationTitle ?? trip.destinationLocalityId;
  return {
    localityId: trip.destinationLocalityId,
    title,
    gateway: trip.gateway,
    summary: `You named ${title}. Vietnam Airlines flies into ${GATEWAY_LABEL[trip.gateway] ?? trip.gateway} for this area.`,
    tags: [],
    sourceFields: ["trip.destinationLocalityId", "trip.gateway"],
  };
}

function localityFromTrip(trip: TripSummary): LocalityResolution | undefined {
  if (!trip.destinationLocalityId || !trip.gateway) return undefined;
  return {
    localityId: trip.destinationLocalityId,
    localityTitle: trip.destinationTitle ?? trip.destinationLocalityId,
    gateway: trip.gateway,
    ruledOut: [],
    sourceFields: ["trip.destinationLocalityId", "trip.gateway"],
  };
}

function resolveFromSuggestion(
  suggestion: DestinationSuggestion | undefined,
): LocalityResolution | undefined {
  if (!suggestion) return undefined;
  return {
    localityId: suggestion.localityId,
    localityTitle: suggestion.title,
    gateway: suggestion.gateway,
    ruledOut: ["HAN", "SGN", "DAD"]
      .filter((gateway) => gateway !== suggestion.gateway)
      .map((gateway) => ({
        gateway: gateway as "HAN" | "SGN" | "DAD",
        reason: `The curated destination record uses ${suggestion.gateway} as its gateway.`,
      })),
    onwardNote: suggestion.onwardNote,
    sourceFields: [...suggestion.sourceFields, "suggestion.gateway"],
  };
}

/**
 * Opening the workspace to a blank panel gives the traveller nothing to react
 * to, so the origin step shows the curated destinations as inspiration. With no
 * origin yet they are unfiltered; naming a city re-filters them next turn.
 */
function inspirationContent(
  dependencies: AppDependencies,
  travelStyle?: TripSummary["travelStyle"],
): AgentCenterContent {
  if (dependencies.agentData.capabilities.destinations !== "ready") {
    return { kind: "empty" };
  }
  return {
    kind: "destination_grid",
    suggestions: buildDestinationSuggestions({ travelStyle, limit: 6 }, dependencies.agentData),
  };
}

const GATEWAY_LABEL: Record<string, string> = {
  HAN: "Hanoi",
  SGN: "Ho Chi Minh City",
  DAD: "Da Nang",
};

/**
 * Answer a free-text policy question from the scraped corpus, scoped to this
 * traveller's route and selected fare. Never invents an answer: when nothing
 * clears the relevance threshold the caller says so explicitly.
 */
async function resolvePolicyAnswer(
  question: string,
  trip: TripSummary,
  centerContent: AgentCenterContent,
  dependencies: AppDependencies,
): Promise<PolicyAnswer> {
  const selectedFare =
    centerContent.kind === "booking" ? centerContent.selectedFare?.fare : undefined;
  const routeLabel =
    trip.originCity && trip.gateway
      ? `${trip.originCity} → ${trip.gateway} (${GATEWAY_LABEL[trip.gateway] ?? trip.gateway})`
      : undefined;

  let result;
  let lookupFailed = false;
  try {
    result = await answerPolicyQuestion(
      question,
      process.env.OPENAI_API_KEY?.trim(),
      { trip, selectedFare, routeLabel },
    );
  } catch (error) {
    // A transient provider error is not the same as "the corpus has no answer",
    // and telling the traveller it is not covered would be wrong. Log it —
    // swallowing this silently made the failure impossible to diagnose.
    console.error("[policy] lookup failed:", error);
    lookupFailed = true;
  }

  if (!result) {
    return {
      answer: "",
      grounded: false,
      answered: false,
      lookupFailed,
      sources: [],
      ...(selectedFare ? { appliedFareBrandId: selectedFare.brandId } : {}),
    };
  }
  return {
    answer: result.answer,
    grounded: result.grounded,
    answered: true,
    sources: result.sources,
    ...(selectedFare ? { appliedFareBrandId: selectedFare.brandId } : {}),
  };
}

const CHANGE_LABELS: Partial<Record<keyof TripSummary, string>> = {
  originCity: "departure",
  gateway: "arrival gateway",
  destinationTitle: "destination",
  travellers: "travellers",
  departDate: "departure date",
  returnDate: "return date",
  travelStyle: "trip style",
  fareBrandId: "fare",
};

/** Short "updated X to Y" line so a correction is visibly acknowledged. */
function describeChanges(
  changedFields: (keyof TripSummary)[],
  trip: TripSummary,
): string {
  const destinationEqualsGateway =
    trip.gateway !== undefined &&
    trip.destinationTitle?.toLowerCase() ===
      (GATEWAY_LABEL[trip.gateway] ?? trip.gateway).toLowerCase();
  const described = changedFields
    .filter((field) => field in CHANGE_LABELS && trip[field] !== undefined)
    .filter((field) => !(field === "gateway" && destinationEqualsGateway))
    .slice(0, 3)
    .map((field) => {
      const value = trip[field];
      const rendered =
        field === "gateway"
          ? `${GATEWAY_LABEL[String(value)] ?? String(value)} (${String(value)})`
          : String(value).replace(/_/g, " ");
      return `${CHANGE_LABELS[field]} → ${rendered}`;
    });
  if (described.length === 0) return "Updated.";
  return `Updated ${described.join(", ")}.`;
}

function formatAud(value: number): string {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function getPolicySnippet(
  policyId: PolicyOverlayId,
  dependencies: AppDependencies,
) {
  const snippet = dependencies.agentData.policies.find((policy) => policy.id === policyId);
  if (snippet) return snippet;
  const directOffer = dependencies.agentData.directOfferPolicy;
  if (policyId !== "direct-decision-offer" || !directOffer) return undefined;
  return {
    id: directOffer.id,
    title: directOffer.title ?? "Direct Decision Offer",
    summary: directOffer.summary ?? directOffer.disclaimer,
    bullets: directOffer.bullets?.length
      ? [...directOffer.bullets]
      : [
          `${directOffer.discountPct}% off an eligible illustrative direct-route fare.`,
          ...(directOffer.eligibility.length > 0
            ? [`Eligibility: ${directOffer.eligibility.join(", ")}.`]
            : []),
          `Offer terms expire after ${directOffer.expiryHours} hours.`,
        ],
    sourceDocument: directOffer.sourceDocument,
    sourceFields: ["data/policies/direct-decision-offer.json"],
  };
}

function destinationSupportsOrigin(
  localityId: string,
  originCity: TripSummary["originCity"],
  dependencies: AppDependencies,
): boolean {
  if (!originCity) return true;
  const suggestion = dependencies.agentData.destinationSuggestions.find(
    (item) => item.localityId === localityId,
  );
  return !suggestion?.supportedOrigins || suggestion.supportedOrigins.includes(originCity);
}

function requireCapability(
  dependencies: AppDependencies,
  capability: keyof AppDependencies["agentData"]["capabilities"],
): void {
  if (dependencies.agentData.capabilities[capability] !== "ready") {
    throw httpError(
      503,
      "AGENT_DATA_UNAVAILABLE",
      `Agent ${capability} data is not ready yet.`,
    );
  }
}

function canonicalizeTrip(trip: TripSummary): TripSummary {
  const parsed = tripSummarySchema.safeParse(trip);
  if (!parsed.success) {
    throw httpError(400, "INVALID_AGENT_INPUT", `Invalid trip summary: ${formatValidationIssues(parsed.error)}`);
  }
  return structuredClone(parsed.data);
}

function diffTrip(current: TripSummary, next: TripSummary): (keyof TripSummary)[] {
  const fields: (keyof TripSummary)[] = [
    "originCity",
    "travelStyle",
    "destinationLocalityId",
    "destinationTitle",
    "gateway",
    "travellers",
    "departMonth",
    "departDate",
    "returnDate",
    "hotelInterest",
    "fareBrandId",
    "memberProfile",
  ];
  return fields.filter((field) => JSON.stringify(current[field]) !== JSON.stringify(next[field]));
}

function missingFieldsFromTrip(trip: TripSummary): string[] {
  const missing: string[] = [];
  if (!trip.originCity) missing.push("originCity");
  if (!trip.travelStyle) missing.push("travelStyle");
  if (!trip.destinationLocalityId) missing.push("destinationLocalityId");
  if (!trip.gateway) missing.push("gateway");
  if (trip.travellers === undefined) missing.push("travellers");
  if (!trip.departDate) missing.push("departDate");
  if (!trip.returnDate) missing.push("returnDate");
  return missing;
}

function monthNameFromIso(value: string): MonthName {
  const month = Number(value.slice(5, 7));
  const names: MonthName[] = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return names[month - 1];
}

function fingerprintTrip(trip: TripSummary): string {
  const input = [
    trip.originCity ?? null,
    trip.travelStyle ?? null,
    trip.destinationLocalityId ?? null,
    trip.destinationTitle ?? null,
    trip.gateway ?? null,
    trip.travellers ?? null,
    trip.departMonth ?? null,
    trip.departDate ?? null,
    trip.returnDate ?? null,
    trip.hotelInterest ?? null,
  ];
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function baseMeta(
  dependencies: AppDependencies,
  now: Date,
  usedIllustrativeData: boolean,
  sourceFields: string[],
) {
  return {
    generatedAt: now.toISOString(),
    datasetVersion: dependencies.dataset.getSnapshot().version,
    usedIllustrativeData,
    sourceFields: [...new Set(sourceFields)],
  };
}

function mapIntentDependencyError(
  error: unknown,
  fallbackMessage: string,
): HttpApiError {
  if (error instanceof HttpApiError) return error;
  const errorCode = readIntentErrorCode(error);
  if (errorCode === "LLM_ERROR") {
    return httpError(503, "LLM_ERROR", "The intent provider is temporarily unavailable.");
  }
  if (
    errorCode === "EMPTY_INPUT" ||
    errorCode === "UNPARSEABLE" ||
    errorCode === "VALIDATION_FAILED" ||
    errorCode === "INTENT_INCOMPLETE"
  ) {
    return httpError(
      400,
      errorCode === "INTENT_INCOMPLETE" ? "INTENT_INCOMPLETE" : "INVALID_AGENT_INPUT",
      error instanceof Error && error.message ? error.message : "The trip input is invalid.",
    );
  }
  return httpError(500, "INTERNAL_ERROR", fallbackMessage);
}

function readIntentErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("errorCode" in error && typeof error.errorCode === "string") {
    return error.errorCode;
  }
  if ("code" in error && typeof error.code === "string") return error.code;
  return undefined;
}
