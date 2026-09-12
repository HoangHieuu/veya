import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

import assert from "node:assert/strict";
import test from "node:test";

import type {
  IntentParseResult,
  RouteRecord,
  TripIntent,
} from "../../../shared/types.js";
import { createApp } from "./app.js";
import {
  getMissingCombinations,
  loadDataset,
  type DatasetSnapshot,
} from "./dataset/loader.js";
import { addUtcDays } from "./handoff.js";
import { ScoringAuditStore } from "./scoring/audit.js";
import {
  rankRoutes,
  SCORE_WEIGHTS,
  scoreBudgetFit,
  scoreDateFit,
  scoreIntentMatch,
  scoreLoyaltyValue,
  scorePromotion,
  scoreRoute,
} from "./scoring/engine.js";
import { InMemoryTripStore } from "./trips.js";

test("health reports degraded partial data and recommend returns up to three cards", async () => {
  const routes = [
    makeRoute({ id: "SYD-HAN-direct", destinationCity: "HAN", destinationName: "Hanoi" }),
    makeRoute({
      id: "SYD-SGN-one-stop",
      destinationCity: "SGN",
      destinationName: "Ho Chi Minh City",
      connectionType: "one_stop",
      viaHub: "HAN",
    }),
    makeRoute({
      id: "SYD-DAD-two-stop",
      destinationCity: "DAD",
      destinationName: "Da Nang",
      connectionType: "two_stop",
      viaHub: "SGN",
      dataConfidence: "illustrative",
    }),
  ];
  const intent = makeIntent();
  let parserCalls = 0;

  await withApp(
    {
      dataset: snapshot(routes),
      parseTripIntent: async () => {
        parserCalls += 1;
        return { ok: true, intent };
      },
      idGenerator: () => "request-1",
      clock: () => new Date("2026-11-01T12:00:00.000Z"),
    },
    async (baseUrl) => {
      const health = await call(baseUrl, "/health");
      assert.equal(health.status, 200);
      assert.equal(health.body.status, "degraded");
      assert.equal(health.body.routeCount, 3);

      const recommendation = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: { mode: "quiz", quiz: makeQuiz() },
      });
      assert.equal(recommendation.status, 200);
      assert.equal(recommendation.body.cards.length, 3);
      assert.equal(recommendation.body.meta.datasetVersion, "test-1");
      assert.equal(recommendation.body.meta.usedIllustrativeData, true);
      assert.match(recommendation.body.meta.disclaimer, /missing curated coverage/);
      assert.equal(recommendation.body.cards[0].score.reasons.length, 4);
      assert.match(recommendation.body.cards[0].tripOutline, /Start with/);
      assert.equal(recommendation.body.cards[0].handoff.adults, 2);
      assert.equal(parserCalls, 1);
    },
  );
});

test("default C parser, scoring, promotion, and audit share one injected request clock", async () => {
  const requestNow = new Date("2030-01-02T03:04:05.000Z");
  let clockCalls = 0;
  const route = makeRoute({
    promotion: {
      id: "expired",
      title: "Expired offer",
      summary: "Only valid before the injected request date.",
      validUntil: "2029-12-31",
    },
  });

  await withApp(
    {
      dataset: snapshot([route]),
      clock: () => {
        clockCalls += 1;
        return requestNow;
      },
      idGenerator: () => "clock-request",
    },
    async (baseUrl) => {
      const recommendation = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: {
          mode: "quiz",
          quiz: {
            ...makeQuiz(),
            departAfter: undefined,
            departBefore: undefined,
          },
        },
      });
      assert.equal(recommendation.status, 200);
      assert.equal(recommendation.body.intent.dateWindow.start, "2030-01-02");
      assert.equal(recommendation.body.cards[0].score.promotionBoost, 0);

      const audit = await call(baseUrl, "/dev/scoring");
      assert.equal(audit.body.snapshots[0].createdAt, requestNow.toISOString());
      assert.equal(clockCalls, 1);
    },
  );
});

test("cached intent bypasses parser and priority override does not mutate it", async () => {
  const intent = makeIntent({
    priority: "lowest_hassle",
    constraints: {
      maxStops: 1,
      mustIncludeTags: ["food_culture"],
      avoidTags: ["education"],
    },
  });
  let parserCalls = 0;
  await withApp(
    {
      dataset: snapshot([makeRoute()]),
      parseTripIntent: async () => {
        parserCalls += 1;
        return { ok: true, intent };
      },
      idGenerator: () => "request-2",
    },
    async (baseUrl) => {
      const result = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: {
          mode: "quiz",
          cachedIntent: intent,
          priorityOverride: "maximise_miles",
        },
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.intent.priority, "maximise_miles");
      assert.deepEqual(result.body.intent.constraints, intent.constraints);
      assert.equal(intent.priority, "lowest_hassle");
      assert.equal(parserCalls, 0);

      const audit = await call(baseUrl, "/dev/scoring");
      assert.equal(audit.status, 200);
      assert.equal(audit.body.snapshots.length, 1);
      assert.equal(audit.body.snapshots[0].weights.loyaltyValue, 0.35);
      assert.deepEqual(audit.body.snapshots[0].tieBreak, [
        "routeConvenience",
        "intentMatch",
        "routeId",
      ]);

      const directOnlyIntent = makeIntent({
        constraints: { maxStops: 0 },
      });
      const directOnly = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: {
          mode: "quiz",
          cachedIntent: directOnlyIntent,
          priorityOverride: "maximise_miles",
        },
      });
      assert.equal(directOnly.status, 200);
      assert.equal(directOnly.body.intent.constraints.maxStops, 0);
      assert.equal(parserCalls, 0);
    },
  );
});

test("complete coverage does not add a coverage warning and confirmed cards are not illustrative", async () => {
  const completeDataset = snapshot(makeCompleteRoutes());
  completeDataset.errors = ["ROUTE_INVALID"];
  completeDataset.status = "degraded";
  await withApp(
    {
      dataset: completeDataset,
      parseTripIntent: async () => ({ ok: true, intent: makeIntent() }),
    },
    async (baseUrl) => {
      const result = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: { mode: "quiz", cachedIntent: makeIntent() },
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.cards.length, 3);
      assert.equal(result.body.meta.usedIllustrativeData, false);
      assert.doesNotMatch(result.body.meta.disclaimer, /missing curated coverage/);
      assert.match(result.body.meta.disclaimer, /validation warnings/);
    },
  );
});

test("recommendation cardinality is zero, one, three, or never more than three", async () => {
  for (const count of [1, 3, 4]) {
    const routes = Array.from({ length: count }, (_, index) =>
      makeRoute({ id: `SYD-HAN-direct-${index + 1}` }),
    );
    await withApp(
      { dataset: snapshot(routes), parseTripIntent: async () => ({ ok: true, intent: makeIntent() }) },
      async (baseUrl) => {
        const result = await call(baseUrl, "/api/recommend", {
          method: "POST",
          body: { mode: "quiz", cachedIntent: makeIntent() },
        });
        assert.equal(result.status, 200);
        assert.equal(result.body.cards.length, Math.min(count, 3));
      },
    );
  }
});

test("trip outlines stay at exactly three grounded sentences", async () => {
  const intent = makeIntent();
  const route = makeRoute({
    typicalDurationHours: 8.83,
    gettingAround: "Airport is 8.83 km from the centre. This second sentence must not leak.",
    dataConfidence: "illustrative",
  });

  await withApp({ dataset: snapshot([route]) }, async (baseUrl) => {
    const result = await call(baseUrl, "/api/recommend", {
      method: "POST",
      body: { mode: "quiz", cachedIntent: intent },
    });
    assert.equal(result.status, 200);
    const outline = result.body.cards[0].tripOutline as string;
    assert.equal(outline.split(/(?<=[.!?])\s+/).length, 3);
    assert.match(outline, /Getting around: Airport is 8\.83 km from the centre; route and fare details/);
    assert.doesNotMatch(outline, /This second sentence must not leak/);
  });

  await withApp(
    {
      dataset: snapshot([
        makeRoute({
          gettingAround: "Airport transfer is simple. Confirm local traffic on arrival?",
          dataConfidence: "confirmed",
        }),
      ]),
    },
    async (baseUrl) => {
      const result = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: { mode: "quiz", cachedIntent: intent },
      });
      const outline = result.body.cards[0].tripOutline as string;
      assert.equal(outline.split(/(?<=[.!?])\s+/).length, 3);
      assert.match(outline, /Getting around: Airport transfer is simple; check final availability/);
    },
  );
});

test("hard filters known destination, stops, and tags", async () => {
  const intent = makeIntent({
    goal: "choose_route",
    preferredDestination: "DAD",
    constraints: {
      maxStops: 1,
      mustIncludeTags: ["beach_relaxation"],
      avoidTags: ["family"],
    },
  });
  const routes = [
    makeRoute({
      id: "SYD-DAD-one-stop",
      destinationCity: "DAD",
      destinationName: "Da Nang",
      connectionType: "one_stop",
      viaHub: "SGN",
      tripArchetypes: ["beach_relaxation"],
    }),
    makeRoute({
      id: "SYD-DAD-two-stop",
      destinationCity: "DAD",
      destinationName: "Da Nang",
      connectionType: "two_stop",
      viaHub: "SGN",
      tripArchetypes: ["beach_relaxation"],
    }),
    makeRoute({
      id: "SYD-SGN-direct",
      destinationCity: "SGN",
      destinationName: "Ho Chi Minh City",
      tripArchetypes: ["beach_relaxation"],
    }),
    makeRoute({
      id: "SYD-DAD-direct-family",
      destinationCity: "DAD",
      destinationName: "Da Nang",
      tripArchetypes: ["beach_relaxation", "family"],
    }),
  ];

  await withApp(
    {
      dataset: snapshot(routes),
      parseTripIntent: async () => ({ ok: true, intent }),
    },
    async (baseUrl) => {
      const result = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: { mode: "brief", briefText: "Da Nang beach", originCity: "SYD" },
      });
      assert.equal(result.status, 200);
      assert.deepEqual(result.body.cards.map((card: { routeId: string }) => card.routeId), [
        "SYD-DAD-one-stop",
      ]);
    },
  );
});

test("no candidate is a successful empty response with a clear disclaimer", async () => {
  const intent = makeIntent({
    constraints: { maxStops: 0, mustIncludeTags: ["education"] },
  });
  await withApp(
    {
      dataset: snapshot([makeRoute({ connectionType: "one_stop", viaHub: "HAN" })]),
      parseTripIntent: async () => ({ ok: true, intent }),
    },
    async (baseUrl) => {
      const result = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: { mode: "quiz", quiz: makeQuiz() },
      });
      assert.equal(result.status, 200);
      assert.deepEqual(result.body.cards, []);
      assert.match(result.body.meta.disclaimer, /No curated route matches/);
    },
  );
});

test("parser errors map to stable responses and C-successful intents are not revalidated by D", async () => {
  await withApp(
    {
      dataset: snapshot([makeRoute()]),
      parseTripIntent: async (): Promise<IntentParseResult> => ({
        ok: false,
        errorCode: "LLM_ERROR",
        message: "LLM unavailable",
      }),
    },
    async (baseUrl) => {
      const result = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: { mode: "brief", briefText: "A trip" },
      });
      assert.equal(result.status, 503);
      assert.deepEqual(result.body, {
        errorCode: "LLM_ERROR",
        message: "LLM unavailable",
      });
    },
  );

  await withApp(
    {
      dataset: snapshot([makeRoute()]),
      parseTripIntent: async () => ({
        ok: true,
        intent: {
          ...makeIntent(),
          tripDurationDays: 400,
        },
      }),
    },
    async (baseUrl) => {
      const result = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: { mode: "brief", briefText: "A trip" },
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.intent.tripDurationDays, 400);
    },
  );
});

test("routes, handoff preview, save, and injected IDs work together", async () => {
  const intent = makeIntent({ dateWindow: { start: "2024-02-28", end: "2024-03-02", flexibility: "fixed" }, tripDurationDays: 2 });
  const route = makeRoute();
  let nextId = 0;
  const tripStore = new InMemoryTripStore();

  await withApp(
    {
      dataset: snapshot([route]),
      tripStore,
      parseTripIntent: async () => ({ ok: true, intent }),
      idGenerator: () => `id-${++nextId}`,
      clock: () => new Date("2024-01-01T00:00:00.000Z"),
    },
    async (baseUrl) => {
      const routes = await call(baseUrl, "/api/routes?origin=SYD");
      assert.equal(routes.status, 200);
      assert.equal(routes.body.version, "test-1");
      assert.equal(routes.body.routes.length, 1);

      const handoff = await call(baseUrl, "/api/handoff/preview", {
        method: "POST",
        body: { routeId: route.id, intent },
      });
      assert.equal(handoff.status, 200);
      assert.equal(handoff.body.returnDate, "2024-03-01");
      assert.match(handoff.body.searchUrl, /adults=2/);

      const unknownHandoff = await call(baseUrl, "/api/handoff/preview", {
        method: "POST",
        body: { routeId: "missing-route", intent },
      });
      assert.equal(unknownHandoff.status, 404);
      assert.equal(unknownHandoff.body.errorCode, "ROUTE_NOT_FOUND");

      const mismatchedHandoff = await call(baseUrl, "/api/handoff/preview", {
        method: "POST",
        body: { routeId: route.id, intent: makeIntent({ originCity: "MEL" }) },
      });
      assert.equal(mismatchedHandoff.status, 400);
      assert.equal(mismatchedHandoff.body.errorCode, "ROUTE_ORIGIN_MISMATCH");

      const saved = await call(baseUrl, "/api/trips/save", {
        method: "POST",
        body: {
          requestId: "request-1",
          routeId: route.id,
          intent,
          consentReminder: false,
        },
      });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.saveId, "id-1");
      assert.equal(saved.body.remindAfterHours, 24);
      assert.equal(tripStore.size, 1);
      assert.equal(tripStore.get("id-1")?.consentReminder, false);

      const unknownSave = await call(baseUrl, "/api/trips/save", {
        method: "POST",
        body: {
          requestId: "request-2",
          routeId: "missing-route",
          intent,
          consentReminder: false,
        },
      });
      assert.equal(unknownSave.status, 404);
      assert.equal(unknownSave.body.errorCode, "ROUTE_NOT_FOUND");

      const whitespaceSave = await call(baseUrl, "/api/trips/save", {
        method: "POST",
        body: {
          requestId: "request-3",
          routeId: "   ",
          intent,
          consentReminder: false,
        },
      });
      assert.equal(whitespaceSave.status, 400);
    },
  );
});

test("dataset unavailable keeps health alive and protects data endpoints", async () => {
  const unavailable: DatasetSnapshot = {
    version: "unavailable",
    routes: [],
    errors: ["ROUTES_UNAVAILABLE"],
    status: "degraded",
    isComplete: false,
    missingCombinations: getMissingCombinations([]),
  };
  await withApp(
    {
      dataset: unavailable,
      parseTripIntent: async () => {
        throw new Error("parser should not be called when dataset is unavailable");
      },
    },
    async (baseUrl) => {
      const health = await call(baseUrl, "/health");
      assert.equal(health.status, 200);
      const recommend = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: { mode: "quiz", quiz: makeQuiz() },
      });
      assert.equal(recommend.status, 503);
      assert.equal(recommend.body.errorCode, "DATASET_UNAVAILABLE");
    },
  );
});

test("request validation and unknown routes use the shared ApiError shape", async () => {
  await withApp(
    {
      dataset: snapshot([makeRoute()]),
      parseTripIntent: async () => ({ ok: true, intent: makeIntent() }),
    },
    async (baseUrl) => {
      const invalid = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: { mode: "quiz" },
      });
      assert.equal(invalid.status, 400);
      assert.equal(invalid.body.errorCode, "VALIDATION_FAILED");

      const unknown = await call(baseUrl, "/api/does-not-exist");
      assert.equal(unknown.status, 404);
      assert.deepEqual(Object.keys(unknown.body).sort(), ["errorCode", "message"]);

      const invalidOrigin = await call(baseUrl, "/api/routes?origin=LAX");
      assert.equal(invalidOrigin.status, 400);
      assert.equal(invalidOrigin.body.errorCode, "INVALID_ORIGIN");

      const malformedResponse = await fetch(`${baseUrl}/api/recommend`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      });
      assert.equal(malformedResponse.status, 400);
      assert.deepEqual(await malformedResponse.json(), {
        errorCode: "INVALID_JSON",
        message: "Request body must be valid JSON.",
      });
    },
  );
});

test("payload limits, whitespace validation, and production audit toggle are explicit", async () => {
  const intent = makeIntent();
  await withApp(
    {
      dataset: snapshot([makeRoute()]),
      enableDevScoring: false,
      parseTripIntent: async () => ({ ok: true, intent }),
    },
    async (baseUrl) => {
      const invalidCachedIntent = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: { mode: "quiz", cachedIntent: { ...intent, travelStyles: [] } },
      });
      assert.equal(invalidCachedIntent.status, 400);

      const whitespaceBrief = await call(baseUrl, "/api/recommend", {
        method: "POST",
        body: { mode: "brief", briefText: "   " },
      });
      assert.equal(whitespaceBrief.status, 400);

      const oversized = await fetch(`${baseUrl}/api/recommend`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "brief", briefText: "x".repeat(70_000) }),
      });
      assert.equal(oversized.status, 413);
      assert.deepEqual(await oversized.json(), {
        errorCode: "PAYLOAD_TOO_LARGE",
        message: "Request body is too large.",
      });

      const disabledAudit = await call(baseUrl, "/dev/scoring");
      assert.equal(disabledAudit.status, 404);
    },
  );

  await withApp(
    {
      dataset: snapshot([makeRoute()]),
      enableDevScoring: true,
      parseTripIntent: async () => ({ ok: true, intent }),
    },
    async (baseUrl) => {
      const enabledAudit = await call(baseUrl, "/dev/scoring");
      assert.equal(enabledAudit.status, 200);
    },
  );
});

test("scoring factors, weights, rounding, and UTC date arithmetic follow the contract", () => {
  assert.deepEqual(SCORE_WEIGHTS, {
    lowest_hassle: {
      intentMatch: 0.25,
      dateFit: 0.15,
      routeConvenience: 0.35,
      budgetFit: 0.15,
      loyaltyValue: 0.05,
      promotionBoost: 0.05,
    },
    best_for_family: {
      intentMatch: 0.25,
      dateFit: 0.15,
      routeConvenience: 0.25,
      budgetFit: 0.15,
      loyaltyValue: 0.05,
      promotionBoost: 0.15,
    },
    maximise_miles: {
      intentMatch: 0.2,
      dateFit: 0.1,
      routeConvenience: 0.15,
      budgetFit: 0.1,
      loyaltyValue: 0.35,
      promotionBoost: 0.1,
    },
    food_and_culture: {
      intentMatch: 0.35,
      dateFit: 0.1,
      routeConvenience: 0.15,
      budgetFit: 0.1,
      loyaltyValue: 0.05,
      promotionBoost: 0.25,
    },
  });

  for (const weights of Object.values(SCORE_WEIGHTS)) {
    assert.equal(Object.values(weights).reduce((sum, value) => sum + value, 0), 1);
  }

  const route = makeRoute({
    bestMonths: [11],
    shoulderMonths: [10],
    indicativeFareBand: "standard",
    lotusmilesIndicative: { earnBand: "high", note: "test" },
    promotion: { id: "promo", title: "Test offer", summary: "Test", validUntil: "2026-12-31" },
  });
  const scored = scoreRoute(makeIntent(), route, new Date("2026-11-01T00:00:00.000Z"));
  assert.deepEqual(
    {
      intentMatch: scored.score.intentMatch,
      dateFit: scored.score.dateFit,
      routeConvenience: scored.score.routeConvenience,
      budgetFit: scored.score.budgetFit,
      loyaltyValue: scored.score.loyaltyValue,
      promotionBoost: scored.score.promotionBoost,
    },
    {
      intentMatch: 100,
      dateFit: 100,
      routeConvenience: 100,
      budgetFit: 100,
      loyaltyValue: 100,
      promotionBoost: 100,
    },
  );
  assert.equal(scored.score.weightedTotal, 100);
  assert.equal(scoreIntentMatch(["food_culture", "family"], ["food_culture"]), 50);
  assert.equal(scoreDateFit("2026-10-10", "2026-10-12", route), 70);
  assert.equal(scoreDateFit("2026-01-10", "2026-01-12", route), 40);
  assert.equal(scoreDateFit("2026-01-10", "2026-01-12", { bestMonths: [], shoulderMonths: [1] }), 50);
  assert.equal(scoreBudgetFit("budget", "premium"), 20);
  assert.equal(scoreLoyaltyValue(undefined), 0);
  assert.equal(scoreLoyaltyValue("low"), 35);
  assert.equal(scoreLoyaltyValue("mid"), 65);
  assert.equal(scoreLoyaltyValue("high"), 100);
  assert.equal(scorePromotion(route.promotion, new Date("2027-01-01T00:00:00.000Z")), 0);

  const tieRoutes = rankRoutes(makeIntent(), [
    makeRoute({ id: "SYD-AAA-direct" }),
    makeRoute({ id: "SYD-ZZZ-direct" }),
  ]);
  assert.deepEqual(tieRoutes.map((item) => item.route.id), ["SYD-AAA-direct", "SYD-ZZZ-direct"]);
  assert.equal(addUtcDays("2024-02-28", 2), "2024-03-01");
  assert.equal(addUtcDays("2024-12-31", 1), "2025-01-01");
  assert.equal(addUtcDays("2026-02-28", 1), "2026-03-01");
});

test("style reasons distinguish full, partial, mixed, and zero matches", () => {
  const route = makeRoute({ tripArchetypes: ["food_culture"] });
  const full = scoreRoute(makeIntent({ travelStyles: ["food_culture"] }), route);
  const partial = scoreRoute(
    makeIntent({ travelStyles: ["food_culture", "family"] }),
    route,
  );
  const mixed = scoreRoute(makeIntent({ travelStyles: ["mixed"] }), route);
  const zero = scoreRoute(makeIntent({ travelStyles: ["education"] }), route);

  assert.match(full.reasonTraces[0].text, /matches all requested trip styles/);
  assert.match(partial.reasonTraces[0].text, /not every requested trip style/);
  assert.match(mixed.reasonTraces[0].text, /neutral 70-point style fit/);
  assert.match(zero.reasonTraces[0].text, /weak style fit|none of the requested trip styles/);
  assert.equal(zero.score.intentMatch, 0);

  for (const destination of ["HAN", "SGN", "DAD"] as const) {
    const mixedRoute = makeRoute({
      destinationCity: destination,
      destinationAirport: destination,
    });
    assert.equal(
      scoreRoute(makeIntent({ travelStyles: ["mixed"] }), mixedRoute).score.intentMatch,
      70,
    );
  }

  const withoutPlace = scoreRoute(
    makeIntent({ rawSummary: "Food and culture trip from Sydney." }),
    route,
  );
  const withPlace = scoreRoute(
    makeIntent({ rawSummary: "Food and culture trip from Sydney, including Hoi An." }),
    route,
  );
  assert.equal(withPlace.score.intentMatch, withoutPlace.score.intentMatch);

  for (const trace of full.reasonTraces) {
    assert.ok(trace.sourceFields.length > 0);
  }
  assert.deepEqual(full.reasonTraces[0].sourceFields, [
    "route.tripArchetypes",
    "intent.travelStyles",
  ]);
  assert.deepEqual(full.reasonTraces[1].sourceFields, [
    "route.connectionType",
    "route.viaHub",
  ]);
  assert.deepEqual(full.reasonTraces[2].sourceFields, [
    "route.bestMonths",
    "route.shoulderMonths",
    "intent.dateWindow",
  ]);
  assert.match(full.reasonTraces[0].text, /matches all requested trip styles/);
  assert.match(full.reasonTraces[1].text, /Direct service/);
  assert.match(full.reasonTraces[2].text, /best travel months/);
  assert.match(full.reasonTraces[3].text, /destination record notes/);
});

test("dataset loader rejects invalid records and duplicate IDs while keeping valid records", () => {
  const root = mkdtempSync(path.join(tmpdir(), "veya-dataset-"));
  mkdirSync(path.join(root, "routes"));
  writeFileSync(path.join(root, "version.json"), JSON.stringify({ datasetVersion: "test-2" }));
  writeFileSync(path.join(root, "routes", "valid.json"), JSON.stringify(makeRoute({ id: "same-id" })));
  writeFileSync(path.join(root, "routes", "duplicate.json"), JSON.stringify(makeRoute({ id: "same-id" })));
  writeFileSync(path.join(root, "routes", "invalid.json"), JSON.stringify(makeRoute({ id: " ", bestMonths: [13] })));

  try {
    const snapshot = loadDataset(root, () => {});
    assert.equal(snapshot.routes.length, 1);
    assert.equal(snapshot.status, "degraded");
    assert.ok(snapshot.errors.some((error) => error.includes("ROUTE_DUPLICATE_ID")));
    assert.ok(snapshot.errors.some((error) => error.includes("ROUTE_INVALID")));
    assert.ok(snapshot.errors.some((error) => error.includes("ROUTE_COVERAGE_INCOMPLETE")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dataset diagnostics are stable for clients while detailed exceptions stay in injected logs", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "veya-missing-dataset-"));
  const logEntries: string[] = [];
  try {
    const dataset = loadDataset(root, (message, detail) => {
      logEntries.push(`${message} ${JSON.stringify(detail)}`);
    });
    assert.ok(dataset.errors.includes("VERSION_NOT_FOUND"));
    assert.ok(dataset.errors.includes("ROUTES_NOT_FOUND"));
    assert.ok(dataset.errors.every((error) => !error.includes(root)));
    const normPath = (value: string) => value.replaceAll("\\", "/").replace(/\/+/g, "/");
    assert.ok(logEntries.some((entry) => normPath(entry).includes(normPath(root))));

    await withApp({ dataset }, async (baseUrl) => {
      const health = await call(baseUrl, "/health");
      assert.equal(health.status, 200);
      assert.ok(JSON.stringify(health.body).includes("VERSION_NOT_FOUND"));
      assert.ok(!JSON.stringify(health.body).includes(root));
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("audit and save stores enforce their bounded in-memory limits", () => {
  const audit = new ScoringAuditStore(20);
  for (let index = 0; index < 21; index += 1) {
    audit.add({
      requestId: String(index),
      createdAt: "2026-01-01T00:00:00.000Z",
      intent: makeIntent(),
      weights: { ...SCORE_WEIGHTS.lowest_hassle },
      tieBreak: ["routeConvenience", "intentMatch", "routeId"],
      candidateCount: 0,
      candidates: [],
    });
  }
  assert.equal(audit.list().length, 20);
  assert.equal(audit.list()[0].requestId, "20");

  const trips = new InMemoryTripStore(2);
  const request = {
    requestId: "request",
    routeId: "route",
    intent: makeIntent(),
    consentReminder: false,
  };
  trips.save(request, "2026-01-01T00:00:00.000Z", "one");
  trips.save(request, "2026-01-01T00:00:00.000Z", "two");
  trips.save(request, "2026-01-01T00:00:00.000Z", "three");
  assert.equal(trips.size, 2);
  assert.equal(trips.get("one"), undefined);
});

interface CallResult {
  status: number;
  body: any;
}

async function withApp(
  overrides: Parameters<typeof createApp>[0],
  callback: (baseUrl: string) => Promise<void>,
) {
  const server = createServer(createApp(overrides));
  await listen(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
}

async function call(
  baseUrl: string,
  route: string,
  options: { method?: string; body?: unknown } = {},
): Promise<CallResult> {
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method ?? "GET",
    headers: options.body === undefined ? undefined : { "content-type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, body: await response.json() };
}

function snapshot(routes: RouteRecord[]): DatasetSnapshot {
  const missingCombinations = getMissingCombinations(routes);
  return {
    version: "test-1",
    routes,
    errors: [],
    status: missingCombinations.length === 0 ? "ready" : "degraded",
    isComplete: missingCombinations.length === 0,
    missingCombinations,
  };
}

function makeCompleteRoutes(): RouteRecord[] {
  const origins = ["SYD", "MEL", "PER"] as const;
  const destinations = [
    ["HAN", "Hanoi"],
    ["SGN", "Ho Chi Minh City"],
    ["DAD", "Da Nang"],
  ] as const;
  return origins.flatMap((origin) =>
    destinations.map(([destination, destinationName]) =>
      makeRoute({
        id: `${origin}-${destination}-direct`,
        originCity: origin,
        originAirport: origin,
        destinationCity: destination,
        destinationAirport: destination,
        destinationName,
      }),
    ),
  );
}

function makeQuiz() {
  return {
    travelStyle: "food_culture" as const,
    dateFlexibility: "fixed" as const,
    budgetBand: "standard" as const,
    travellers: 2,
    priority: "lowest_hassle" as const,
    originCity: "SYD" as const,
    departAfter: "2026-11-10",
    departBefore: "2026-11-19",
  };
}

function makeIntent(overrides: Partial<TripIntent> = {}): TripIntent {
  return {
    originCity: "SYD",
    travelStyles: ["food_culture"],
    budgetBand: "standard",
    travellers: 2,
    priority: "lowest_hassle",
    dateWindow: {
      start: "2026-11-10",
      end: "2026-11-19",
      flexibility: "fixed",
    },
    tripDurationDays: 9,
    goal: "discover_destination",
    constraints: { maxStops: 2 },
    rawSummary: "A food and culture trip from Sydney.",
    parseConfidence: 1,
    missingFields: [],
    ...overrides,
  };
}

function makeRoute(overrides: Partial<RouteRecord> = {}): RouteRecord {
  return {
    id: "SYD-HAN-direct",
    originCity: "SYD",
    originAirport: "SYD",
    destinationCity: "HAN",
    destinationAirport: "HAN",
    destinationName: "Hanoi",
    connectionType: "direct",
    viaHub: null,
    typicalDurationHours: 9,
    seasonalityNotes: "November is a good month for the destination.",
    gettingAround: "Taxi or airport bus to the city centre takes about 40 minutes.",
    tripArchetypes: ["food_culture"],
    indicativeFareBand: "standard",
    bestMonths: [11],
    shoulderMonths: [10],
    backgroundImage: {
      url: "https://example.com/hanoi.jpg",
      archetype: "food_culture",
      source: "Test source",
      owner: "Test owner",
      licenseNote: "Licensed for testing.",
    },
    promotion: null,
    lotusmilesIndicative: null,
    dataConfidence: "confirmed",
    sourceDocument: "Test document",
    sourceOwner: "Test owner",
    ...overrides,
  };
}
