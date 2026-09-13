import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AgentTurnResponse, TripSummary } from "../../../../shared/types.js";
import { createApp, type AppDependencies } from "../app.js";
import { handleAgentTurn, applyTripPatch } from "./orchestrator.js";
import { createDefaultAgentIntentDependencies } from "./intentAdapter.js";
import { loadAgentData } from "./data.js";
import { InMemoryAgentSessionStore } from "./sessionStore.js";
import { loadDataset, createDatasetProvider } from "../dataset/loader.js";
import { loadExperienceHighlights } from "../dataset/experiences.js";
import { parseTripIntent } from "../intent/parseTripIntent.js";
import { InMemoryTripStore } from "../trips.js";
import { ScoringAuditStore } from "../scoring/audit.js";

const NOW = new Date("2026-09-13T00:00:00.000Z");

function deps(): AppDependencies {
  let counter = 0;
  return {
    parseTripIntent: (input, options) =>
      parseTripIntent(input, { now: options?.now ?? NOW }),
    dataset: createDatasetProvider(loadDataset()),
    clock: () => NOW,
    idGenerator: () => `id-${++counter}`,
    tripStore: new InMemoryTripStore(),
    auditStore: new ScoringAuditStore(20),
    enableDevScoring: false,
    agentIntent: {
      ...createDefaultAgentIntentDependencies(),
      // Deterministic: never reach for the network inside a unit test.
      understandMessage: (message, current) =>
        createDefaultAgentIntentDependencies().understandMessage(message, current, {
          now: NOW,
          llmEnabled: false,
        }),
    },
    agentData: loadAgentData(),
    agentSessionStore: new InMemoryAgentSessionStore(),
    experienceHighlightsFor: loadExperienceHighlights,
  };
}

function guest(overrides: Partial<TripSummary> = {}): TripSummary {
  return { memberProfile: "guest", ...overrides };
}

/** Client-side reducer equivalent: apply the patch the server hands back. */
function reduce(trip: TripSummary, response: AgentTurnResponse): TripSummary {
  if (response.resetTrip) {
    return { memberProfile: trip.memberProfile };
  }
  return applyTripPatch(trip, response.tripPatch);
}

const COMPLETE = guest({
  originCity: "SYD",
  travelStyle: "beach_relaxation",
  destinationLocalityId: "dad",
  destinationTitle: "Da Nang",
  gateway: "DAD",
  travellers: 2,
  departMonth: "April",
  departDate: "2027-04-12",
  returnDate: "2027-04-26",
});

describe("applyTripPatch", () => {
  it("deletes a field when the patch carries null", () => {
    const next = applyTripPatch(guest({ gateway: "DAD" }), { gateway: null });
    assert.equal(next.gateway, undefined);
    assert.ok(!("gateway" in next));
  });

  it("leaves absent keys untouched", () => {
    const next = applyTripPatch(guest({ gateway: "DAD", travellers: 2 }), { travellers: 3 });
    assert.equal(next.gateway, "DAD");
    assert.equal(next.travellers, 3);
  });
});

describe("handleAgentTurn — opening the workspace", () => {
  it("opens on destination inspiration rather than an empty panel", async () => {
    const dependencies = deps();
    const response = await handleAgentTurn(
      { trip: guest(), event: { type: "open_workspace" } },
      dependencies,
    );
    assert.equal(response.stage, "pick_origin");
    assert.equal(response.centerContent.kind, "destination_grid");
    if (response.centerContent.kind !== "destination_grid") return;
    assert.ok(
      response.centerContent.suggestions.length >= 3,
      "the opening grid needs enough cards to be worth showing",
    );
  });

  it("does not advance the journey or touch the trip", async () => {
    const dependencies = deps();
    const trip = guest({ originCity: "MEL" });
    const response = await handleAgentTurn(
      { trip, event: { type: "open_workspace" } },
      dependencies,
    );
    assert.deepEqual(response.tripPatch, {});
    assert.equal(reduce(trip, response).originCity, "MEL");
  });

  it("still shows the grid after a reset", async () => {
    const dependencies = deps();
    const response = await handleAgentTurn(
      { trip: COMPLETE, event: { type: "reset_journey" } },
      dependencies,
    );
    assert.equal(response.resetTrip, true);
    assert.equal(response.centerContent.kind, "destination_grid");
  });
});

describe("handleAgentTurn — chat drives the canvas", () => {
  it("moves off pick_origin as soon as a message names an origin", async () => {
    const dependencies = deps();
    const response = await handleAgentTurn(
      { trip: guest(), message: "flying from Melbourne" },
      dependencies,
    );
    assert.equal(response.tripPatch.originCity, "MEL");
    assert.notEqual(response.stage, "pick_origin");
  });

  it("changes the arrival gateway mid-conversation and re-renders the centre", async () => {
    const dependencies = deps();
    let trip = guest();
    let response = await handleAgentTurn(
      { trip, message: "Sydney, beach trip, 2 adults, Da Nang" },
      dependencies,
    );
    trip = reduce(trip, response);
    assert.equal(trip.gateway, "DAD");

    response = await handleAgentTurn(
      { trip, sessionId: response.sessionId, message: "actually make it Hanoi instead" },
      dependencies,
    );
    trip = reduce(trip, response);
    assert.equal(trip.gateway, "HAN");
    assert.equal(response.messageIntent, "change_trip");
    assert.match(response.agentMessage, /destination → Hanoi/i);
    assert.doesNotMatch(
      response.agentMessage,
      /arrival gateway/i,
      "the gateway is not restated when it repeats the destination name",
    );
  });

  it("names the gateway when it differs from the destination", async () => {
    const dependencies = deps();
    let trip = guest({ originCity: "MEL" });
    const response = await handleAgentTurn(
      { trip, message: "actually we're visiting family in Cà Mau" },
      dependencies,
    );
    trip = reduce(trip, response);
    assert.equal(trip.gateway, "SGN");
    assert.match(response.agentMessage, /arrival gateway → Ho Chi Minh City/i);
  });

  it("keeps the chosen fare when only the party size changes", async () => {
    const dependencies = deps();
    let trip = COMPLETE;
    const booked = await handleAgentTurn(
      { trip, event: { type: "continue_booking" } },
      dependencies,
    );
    trip = reduce(trip, booked);
    const picked = await handleAgentTurn(
      {
        trip,
        sessionId: booked.sessionId,
        event: { type: "select_fare", fareBrandId: "premium_economy" },
      },
      dependencies,
    );
    trip = reduce(trip, picked);

    const resized = await handleAgentTurn(
      { trip, sessionId: picked.sessionId, message: "make it 3 adults" },
      dependencies,
    );
    trip = reduce(trip, resized);
    assert.equal(trip.fareBrandId, "premium_economy", "party size only re-totals");
    if (resized.centerContent.kind !== "booking") return assert.fail("expected booking");
    assert.equal(resized.centerContent.selectedFare?.travellers, 3);
    assert.equal(
      resized.centerContent.selectedFare?.totalAud,
      resized.centerContent.selectedFare!.fare.pricePerAdultAud * 3,
    );
  });

  it("changes the departure city after it was already set", async () => {
    const dependencies = deps();
    let trip = COMPLETE;
    const first = await handleAgentTurn({ trip, message: "ready to book" }, dependencies);
    trip = reduce(trip, first);

    const second = await handleAgentTurn(
      { trip, sessionId: first.sessionId, message: "actually I'll depart from Perth" },
      dependencies,
    );
    trip = reduce(trip, second);
    assert.equal(trip.originCity, "PER");
  });

  it("reads a full date range from free text so booking can complete", async () => {
    const dependencies = deps();
    let trip = guest({
      originCity: "SYD",
      travelStyle: "beach_relaxation",
      destinationLocalityId: "dad",
      destinationTitle: "Da Nang",
      gateway: "DAD",
      travellers: 2,
    });
    const response = await handleAgentTurn(
      { trip, message: "from 2027-04-12 to 2027-04-26" },
      dependencies,
    );
    trip = reduce(trip, response);
    assert.equal(trip.departDate, "2027-04-12");
    assert.equal(trip.returnDate, "2027-04-26");
  });

  it("resets the journey from a free-text request", async () => {
    const dependencies = deps();
    const response = await handleAgentTurn(
      { trip: COMPLETE, message: "let's start over" },
      dependencies,
    );
    assert.equal(response.resetTrip, true);
    assert.equal(response.stage, "pick_origin");
    assert.equal(reduce(COMPLETE, response).originCity, undefined);
  });
});

describe("handleAgentTurn — booking grid and fare memory", () => {
  async function reachBooking() {
    const dependencies = deps();
    let trip = COMPLETE;
    const response = await handleAgentTurn(
      { trip, event: { type: "continue_booking" } },
      dependencies,
    );
    trip = reduce(trip, response);
    return { dependencies, trip, response };
  }

  it("puts a branded fare grid in the centre panel at booking", async () => {
    const { response } = await reachBooking();
    assert.equal(response.stage, "booking");
    assert.equal(response.centerContent.kind, "booking");
    if (response.centerContent.kind !== "booking") return;

    const brandIds = response.centerContent.fareOptions.map((o) => o.brandId);
    assert.deepEqual(brandIds, [
      "economy_lite",
      "economy_classic",
      "economy_flex",
      "premium_economy",
      "business_classic",
      "business_flex",
    ]);
    assert.equal(
      response.centerContent.fareOptions.filter((o) => o.lowest).length,
      1,
      "exactly one column is flagged as the lowest fare",
    );
    assert.equal(response.centerContent.itineraries.length, 2, "outbound and inbound");
    assert.equal(response.centerContent.selectedFare, undefined);
  });

  it("prices the grid per traveller and totals it", async () => {
    const { response } = await reachBooking();
    if (response.centerContent.kind !== "booking") return assert.fail("expected booking");
    for (const option of response.centerContent.fareOptions) {
      assert.equal(option.totalAud, option.pricePerAdultAud * 2);
      assert.equal(option.currency, "AUD");
    }
  });

  it("remembers the chosen fare on later turns", async () => {
    const { dependencies, response } = await reachBooking();
    let trip = reduce(COMPLETE, response);

    const picked = await handleAgentTurn(
      {
        trip,
        sessionId: response.sessionId,
        event: { type: "select_fare", fareBrandId: "economy_flex" },
      },
      dependencies,
    );
    trip = reduce(trip, picked);
    assert.equal(trip.fareBrandId, "economy_flex");
    if (picked.centerContent.kind !== "booking") return assert.fail("expected booking");
    assert.equal(picked.centerContent.selectedFare?.fare.brandId, "economy_flex");
    assert.equal(picked.centerContent.selectedFare?.travellers, 2);

    // A later, unrelated turn must not lose the selection.
    const later = await handleAgentTurn(
      { trip, sessionId: picked.sessionId, message: "sounds good" },
      dependencies,
    );
    const after = reduce(trip, later);
    assert.equal(after.fareBrandId, "economy_flex");
    if (later.centerContent.kind !== "booking") return assert.fail("expected booking");
    assert.equal(later.centerContent.selectedFare?.fare.brandId, "economy_flex");
  });

  it("picks a fare from chat", async () => {
    const { dependencies, response } = await reachBooking();
    const trip = reduce(COMPLETE, response);
    const picked = await handleAgentTurn(
      { trip, sessionId: response.sessionId, message: "I'll take Business Flex" },
      dependencies,
    );
    assert.equal(picked.messageIntent, "select_fare");
    assert.equal(reduce(trip, picked).fareBrandId, "business_flex");
    assert.match(picked.agentMessage, /Business Flex/);
  });

  it("drops a stale fare when the route changes underneath it", async () => {
    const { dependencies, response } = await reachBooking();
    let trip = reduce(COMPLETE, response);
    const picked = await handleAgentTurn(
      {
        trip,
        sessionId: response.sessionId,
        event: { type: "select_fare", fareBrandId: "business_flex" },
      },
      dependencies,
    );
    trip = reduce(trip, picked);
    assert.equal(trip.fareBrandId, "business_flex");

    const rerouted = await handleAgentTurn(
      { trip, sessionId: picked.sessionId, message: "actually change it to Hanoi" },
      dependencies,
    );
    trip = reduce(trip, rerouted);
    assert.equal(trip.gateway, "HAN");
    assert.equal(trip.fareBrandId, undefined, "a re-priced route clears the old fare");
  });

  it("stays on the booking stage after a correction instead of demoting to season", async () => {
    const { dependencies, response } = await reachBooking();
    const trip = reduce(COMPLETE, response);
    const corrected = await handleAgentTurn(
      { trip, sessionId: response.sessionId, message: "make it 3 adults" },
      dependencies,
    );
    assert.equal(corrected.stage, "booking");
    if (corrected.centerContent.kind !== "booking") return assert.fail("expected booking");
    assert.equal(
      corrected.centerContent.fareOptions[0].totalAud,
      corrected.centerContent.fareOptions[0].pricePerAdultAud * 3,
    );
  });
});

describe("handleAgentTurn — policy questions", () => {
  it("marks a baggage question as a policy turn and keeps the stage", async () => {
    const dependencies = deps();
    const booked = await handleAgentTurn(
      { trip: COMPLETE, event: { type: "continue_booking" } },
      dependencies,
    );
    const trip = reduce(COMPLETE, booked);

    const asked = await handleAgentTurn(
      {
        trip,
        sessionId: booked.sessionId,
        message: "how much checked baggage do I get?",
      },
      dependencies,
    );
    assert.equal(asked.messageIntent, "policy_question");
    assert.equal(asked.stage, "booking", "asking a question must not rewind the journey");
    assert.ok(asked.policyAnswer, "a policy turn always reports an answer object");
    // No API key in the test environment, so it must decline rather than invent.
    if (!asked.policyAnswer?.answered) {
      assert.match(asked.agentMessage, /could not find|did not respond|rather not guess/i);
    }
  });

  it("separates a failed lookup from a genuinely uncovered question", async () => {
    const dependencies = deps();
    const booked = await handleAgentTurn(
      { trip: COMPLETE, event: { type: "continue_booking" } },
      dependencies,
    );
    const trip = reduce(COMPLETE, booked);
    const asked = await handleAgentTurn(
      { trip, sessionId: booked.sessionId, message: "is my ticket refundable?" },
      dependencies,
    );
    assert.equal(asked.policyAnswer?.answered, false);
    if (asked.policyAnswer?.lookupFailed) {
      // Provider unreachable: must not claim the corpus lacks the answer.
      assert.match(asked.agentMessage, /did not respond/i);
      assert.doesNotMatch(asked.agentMessage, /could not find that in the/i);
    } else {
      assert.match(asked.agentMessage, /could not find that in the/i);
    }
  });

  it("still routes curated overlay keywords to the overlay", async () => {
    const dependencies = deps();
    const response = await handleAgentTurn(
      { trip: COMPLETE, message: "show me the offer terms" },
      dependencies,
    );
    assert.equal(response.policyOverlay, "direct-decision-offer");
  });
});

describe("createApp", () => {
  it("registers the agent routes", () => {
    assert.ok(createApp());
  });
});
