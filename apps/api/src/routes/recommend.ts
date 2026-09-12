import type { Express, Request } from "express";

import type {
  RecommendRequest,
  RouteRecord,
  TripIntent,
} from "../../../../shared/types.js";
import { buildHandoffParams } from "../handoff.js";
import type { DatasetSnapshot } from "../dataset/loader.js";
import { loadExperienceHighlights } from "../dataset/experiences.js";
import {
  buildNeedProfile,
  loadNeedPlaceMap,
  rankExperienceHighlights,
} from "../dataset/needPlaceMap.js";
import { tripOutlineConnectionPhrase } from "../../../../shared/routeLabels.js";
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
    const effectiveIntent = structuredClone(intent);
    if (input.priorityOverride) {
      effectiveIntent.priority = input.priorityOverride;
    }
    const candidates = filterCandidates(effectiveIntent, snapshot.routes);
    const ranked = rankRoutes(effectiveIntent, candidates, requestNow);
    const needMap = loadNeedPlaceMap();
    const needProfile = buildNeedProfile(effectiveIntent, needMap);
    const requestId = dependencies.idGenerator();
    const cards = ranked.slice(0, 3).map((scored, index) => ({
      rank: (index + 1) as 1 | 2 | 3,
      routeId: scored.route.id,
      route: structuredClone(scored.route),
      score: structuredClone(scored.score),
      tripOutline: buildTripOutline(effectiveIntent, scored.route),
      handoff: buildHandoffParams(effectiveIntent, scored.route),
      experienceHighlights: rankExperienceHighlights(
        loadExperienceHighlights(scored.route.destinationCity),
        needProfile,
      ),
    }));

    if (dependencies.enableDevScoring) {
      dependencies.auditStore.add({
        requestId,
        createdAt: requestNow.toISOString(),
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
    response.status(200).json({
      requestId,
      intent: effectiveIntent,
      cards,
      meta: {
        datasetVersion: snapshot.version,
        scoringVersion: SCORING_VERSION,
        usedIllustrativeData,
        disclaimer: buildDisclaimer(
          cards.length,
          ranked.length,
          usedIllustrativeData,
          snapshot,
          effectiveIntent.originCity,
        ),
      },
    });
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

function requireDataset(dependencies: AppDependencies): DatasetSnapshot {
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
  const connection = tripOutlineConnectionPhrase(
    route.connectionType,
    route.viaHub,
  );
  const confidenceClause =
    route.dataConfidence === "illustrative"
      ? "route and fare details are illustrative for this prototype"
      : "check final availability and fares on Vietnam Airlines";
  const gettingAroundClause = firstGroundedClause(route.gettingAround);
  return [
    `Start with ${route.destinationName} from ${route.originAirport} on ${intent.dateWindow.start} for about ${intent.tripDurationDays} days.`,
    `The curated option is ${connection}, with a typical journey of ${route.typicalDurationHours} hours.`,
    `Getting around: ${gettingAroundClause}; ${confidenceClause}.`,
  ].join(" ");
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

function parseBody<T>(
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
