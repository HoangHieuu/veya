import type { Express, Request } from "express";

import type {
  PriorityPreset,
  DestinationCity,
  ExperienceHighlight,
  RecommendRequest,
  RankedResponse,
  RouteRecord,
  TripIntent,
} from "../../../../shared/types.js";
import { buildHandoffParams } from "../handoff.js";
import type { DatasetSnapshot } from "../dataset/loader.js";
import {
  extractMentionedLocalities,
  loadLocalityGateway,
} from "../dataset/localityGateway.js";
import { httpError } from "../errors.js";
import {
  SCORE_WEIGHTS,
  SCORING_VERSION,
  rankRoutes,
} from "../scoring/engine.js";
import {
  formatValidationIssues,
  handoffPreviewRequestSchema,
  recommendRequestSchema,
  saveTripRequestSchema,
} from "../validation.js";
import type { AppDependencies } from "../app.js";
import type { ScoringAuditStore } from "../scoring/audit.js";

const VALID_ORIGINS = new Set(["SYD", "MEL", "PER"]);

export function registerRecommendRoutes(
  app: Express,
  dependencies: AppDependencies,
) {
  app.post("/api/recommend", async (request, response) => {
    const input = parseBody(recommendRequestSchema, request.body, "recommendation request");
    const snapshot = requireDataset(dependencies);
    const requestNow = dependencies.clock();
    const intent = await resolveIntent(input, dependencies, requestNow);
    const requestId = dependencies.idGenerator();
    response.status(200).json(
      recommendFromIntent(intent, {
        dataset: snapshot,
        now: requestNow,
        requestId,
        priorityOverride: input.priorityOverride,
        auditStore: dependencies.enableDevScoring ? dependencies.auditStore : undefined,
        experienceHighlightsFor: dependencies.experienceHighlightsFor,
      }),
    );
  });

  app.get("/api/routes", (request, response) => {
    const snapshot = requireDataset(dependencies);
    const origin = readOriginQuery(request);
    const routes = origin
      ? snapshot.routes.filter((route) => route.originCity === origin)
      : snapshot.routes;
    response.status(200).json({
      version: snapshot.version,
      routes: structuredClone(routes),
    });
  });

  app.post("/api/handoff/preview", (request, response) => {
    const input = parseBody(
      handoffPreviewRequestSchema,
      request.body,
      "handoff preview request",
    );
    const snapshot = requireDataset(dependencies);
    const route = snapshot.routes.find((candidate) => candidate.id === input.routeId);
    if (!route) {
      throw httpError(404, "ROUTE_NOT_FOUND", `Route '${input.routeId}' was not found.`);
    }
    if (route.originCity !== input.intent.originCity) {
      throw httpError(
        400,
        "ROUTE_ORIGIN_MISMATCH",
        "The selected route does not belong to the intent origin.",
      );
    }
    response.status(200).json(buildHandoffParams(input.intent, route));
  });

  app.post("/api/trips/save", (request, response) => {
    const input = parseBody(saveTripRequestSchema, request.body, "save trip request");
    const snapshot = requireDataset(dependencies);
    const route = snapshot.routes.find((candidate) => candidate.id === input.routeId);
    if (!route) {
      throw httpError(404, "ROUTE_NOT_FOUND", `Route '${input.routeId}' was not found.`);
    }
    if (route.originCity !== input.intent.originCity) {
      throw httpError(
        400,
        "ROUTE_ORIGIN_MISMATCH",
        "The selected route does not belong to the intent origin.",
      );
    }

    const saved = dependencies.tripStore.save(
      input,
      dependencies.clock().toISOString(),
      dependencies.idGenerator(),
    );
    response.status(200).json(saved);
  });

  app.get("/dev/scoring", (_request, response) => {
    if (!dependencies.enableDevScoring) {
      throw httpError(404, "NOT_FOUND", "The scoring audit view is disabled.");
    }
    response.status(200).json({
      scoringVersion: SCORING_VERSION,
      snapshots: dependencies.auditStore.list(),
    });
  });
}

export interface RecommendFromIntentOptions {
  dataset: DatasetSnapshot;
  now: Date;
  requestId: string;
  priorityOverride?: PriorityPreset;
  auditStore?: ScoringAuditStore;
  experienceHighlightsFor: (gateway: DestinationCity) => ExperienceHighlight[];
}

/** Shared Phase 1 recommendation service used by both legacy and Agent routes. */
export function recommendFromIntent(
  intent: TripIntent,
  options: RecommendFromIntentOptions,
): RankedResponse {
  const effectiveIntent = structuredClone(intent);
  if (options.priorityOverride) {
    effectiveIntent.priority = options.priorityOverride;
  }

  const candidates = filterCandidates(effectiveIntent, options.dataset.routes);
  const ranked = rankRoutes(effectiveIntent, candidates, options.now);
  const cards = ranked.slice(0, 3).map((scored, index) => ({
    rank: (index + 1) as 1 | 2 | 3,
    routeId: scored.route.id,
    route: structuredClone(scored.route),
    score: structuredClone(scored.score),
    tripOutline: buildTripOutline(effectiveIntent, scored.route),
    handoff: buildHandoffParams(effectiveIntent, scored.route),
    experienceHighlights: structuredClone(
      options.experienceHighlightsFor(scored.route.destinationCity),
    ),
  }));

  if (options.auditStore) {
    options.auditStore.add({
      requestId: options.requestId,
      createdAt: options.now.toISOString(),
      intent: structuredClone(effectiveIntent),
      weights: ranked[0]
        ? structuredClone(ranked[0].score.weightsUsed)
        : { ...SCORE_WEIGHTS[effectiveIntent.priority] },
      tieBreak: ["routeConvenience", "intentMatch", "routeId"],
      candidateCount: ranked.length,
      candidates: ranked.map((item, index) => ({
        routeId: item.route.id,
        weightedTotal: item.score.weightedTotal,
        rank: index + 1,
        factors: structuredClone(item.score),
        reasonTraces: structuredClone(item.reasonTraces),
      })),
    });
  }

  const usedIllustrativeData = cards.some(
    (card) => card.route.dataConfidence === "illustrative",
  );
  return {
    requestId: options.requestId,
    intent: effectiveIntent,
    cards,
    meta: {
      datasetVersion: options.dataset.version,
      scoringVersion: SCORING_VERSION,
      usedIllustrativeData,
      disclaimer: buildDisclaimer(
        cards.length,
        ranked.length,
        usedIllustrativeData,
        options.dataset,
        effectiveIntent.originCity,
      ),
    },
  };
}

async function resolveIntent(
  input: RecommendRequest,
  dependencies: AppDependencies,
  now: Date,
): Promise<TripIntent> {
  if (input.cachedIntent !== undefined) {
    return structuredClone(input.cachedIntent);
  }

  let parsed;
  try {
    parsed = await dependencies.parseTripIntent(input, { now });
  } catch {
    throw httpError(500, "INTERNAL_ERROR", "The intent parser failed unexpectedly.");
  }

  if (!parsed.ok) {
    const status = parsed.errorCode === "LLM_ERROR" ? 503 : 400;
    throw httpError(status, parsed.errorCode, parsed.message);
  }

  return structuredClone(parsed.intent);
}

export function requireDataset(dependencies: AppDependencies): DatasetSnapshot {
  const snapshot = dependencies.dataset.getSnapshot();
  if (snapshot.version === "unavailable" || snapshot.routes.length === 0) {
    throw httpError(
      503,
      "DATASET_UNAVAILABLE",
      "The curated route dataset is not ready yet.",
    );
  }
  return snapshot;
}

function filterCandidates(intent: TripIntent, routes: RouteRecord[]): RouteRecord[] {
  const mustInclude = intent.constraints.mustIncludeTags ?? [];
  const avoid = intent.constraints.avoidTags ?? [];
  const maxStops = intent.constraints.maxStops;

  return routes.filter((route) => {
    if (route.originCity !== intent.originCity) return false;
    if (intent.goal === "choose_route" && route.destinationCity !== intent.preferredDestination) {
      return false;
    }
    if (stopCount(route) > maxStops) return false;
    if (!mustInclude.every((tag) => route.tripArchetypes.includes(tag as RouteRecord["tripArchetypes"][number]))) {
      return false;
    }
    if (avoid.some((tag) => route.tripArchetypes.includes(tag as RouteRecord["tripArchetypes"][number]))) {
      return false;
    }
    return true;
  });
}

function stopCount(route: RouteRecord): number {
  switch (route.connectionType) {
    case "direct":
      return 0;
    case "one_stop":
      return 1;
    case "two_stop":
      return 2;
  }
}

function buildTripOutline(intent: TripIntent, route: RouteRecord): string {
  const connection = buildConnectionPhrase(route.connectionType, route.viaHub);
  const confidenceClause =
    route.dataConfidence === "illustrative"
      ? "route and fare details are illustrative for this prototype"
      : "check final availability and fares on Vietnam Airlines";

  const localities = extractMentionedLocalities(
    intent.rawSummary,
    loadLocalityGateway(),
  );
  const vfrTrip =
    intent.travelStyles.includes("vfr") || localities.length > 0;

  if (vfrTrip) {
    const place = localities[0];
    const visitTarget = place
      ? `visiting family in ${place}`
      : "visiting family in Vietnam";
    const gatewayNote = place
      ? `${route.destinationName} (${route.destinationAirport}) is the nearest VNA gateway to ${place} — plan an onward leg after your international flight.`
      : `${route.destinationName} (${route.destinationAirport}) is your VNA gateway — plan onward travel to where your relatives live.`;
    return [
      `Fly ${route.originAirport} → ${route.destinationAirport} on ${intent.dateWindow.start} for about ${intent.tripDurationDays} days, ${visitTarget}.`,
      gatewayNote,
      `This route is ${connection}, typically ${route.typicalDurationHours} hours; ${confidenceClause}.`,
    ].join(" ");
  }

  const gettingAroundClause = firstGroundedClause(route.gettingAround);
  return [
    `Start with ${route.destinationName} from ${route.originAirport} on ${intent.dateWindow.start} for about ${intent.tripDurationDays} days.`,
    `The curated option is ${connection}, with a typical journey of ${route.typicalDurationHours} hours.`,
    `Getting around: ${gettingAroundClause}; ${confidenceClause}.`,
  ].join(" ");
}

function buildConnectionPhrase(
  connectionType: RouteRecord["connectionType"],
  viaHub: RouteRecord["viaHub"],
): string {
  switch (connectionType) {
    case "direct":
      return "a direct flight";
    case "one_stop":
      return `a one-stop itinerary via ${viaHub ?? "a connecting hub"}`;
    case "two_stop":
      return `a two-stop itinerary via ${viaHub ?? "connecting hubs"}`;
  }
}

function firstGroundedClause(value: string): string {
  const text = value.trim();
  for (let index = 0; index < text.length; index += 1) {
    const punctuation = text[index];
    const next = text[index + 1];
    if (
      (punctuation === "." || punctuation === "!" || punctuation === "?") &&
      (next === undefined || /\s/.test(next))
    ) {
      return text.slice(0, index).trim().replace(/[.!?]+$/, "");
    }
  }
  return text.replace(/[.!?]+$/, "").trim();
}

function buildDisclaimer(
  cardCount: number,
  candidateCount: number,
  usedIllustrativeData: boolean,
  snapshot: DatasetSnapshot,
  origin: TripIntent["originCity"],
): string {
  const messages = [
    "Veya is a discovery layer; live fares, seats, and final availability are checked on Vietnam Airlines.",
  ];
  if (usedIllustrativeData) {
    messages.push("Some route, duration, or fare-band details are illustrative and require final confirmation.");
  }
  if (cardCount < 3) {
    messages.push(
      candidateCount === 0
        ? "No curated route matches all of the supplied constraints."
        : `Only ${candidateCount} curated route${candidateCount === 1 ? "" : "s"} matched the supplied constraints.`,
    );
  }
  const missingForOrigin = snapshot.missingCombinations.filter((combination) =>
    combination.startsWith(`${origin}-`),
  );
  const missingForOtherOrigins = snapshot.missingCombinations.filter(
    (combination) => !combination.startsWith(`${origin}-`),
  );
  if (missingForOrigin.length > 0) {
    messages.push(
      `Curated coverage is incomplete for ${origin}; some routes from this origin may be missing.`,
    );
  }
  if (missingForOtherOrigins.length > 0) {
    messages.push("The dataset is missing curated coverage for other origin and gateway combinations.");
  }
  if (snapshot.errors.some((error) => !error.startsWith("ROUTE_COVERAGE_INCOMPLETE"))) {
    messages.push("The dataset contains validation warnings; verify final availability on Vietnam Airlines.");
  }
  return messages.join(" ");
}

export function parseBody<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } },
  body: unknown,
  name: string,
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw httpError(400, "VALIDATION_FAILED", `Invalid ${name}: ${formatValidationIssues(parsed.error)}`);
  }
  return parsed.data;
}

function readOriginQuery(request: Request): "SYD" | "MEL" | "PER" | undefined {
  const raw = request.query.origin;
  if (raw === undefined) return undefined;
  if (typeof raw !== "string" || !VALID_ORIGINS.has(raw)) {
    throw httpError(400, "INVALID_ORIGIN", "origin must be one of SYD, MEL, or PER.");
  }
  return raw as "SYD" | "MEL" | "PER";
}
