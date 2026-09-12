import { z } from "zod";

import type {
  IntentParseResult,
  RecommendRequest,
  RouteRecord,
} from "../../../shared/types.js";
import {
  quizAnswersSchema,
  tripIntentSchema as intentSchema,
} from "./intent/schema.js";

/** D owns the HTTP boundary; C owns the TripIntent runtime contract. */
export { tripIntentSchema } from "./intent/schema.js";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const nonBlankString = z.string().trim().min(1);

function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

const isoDate = z.string().refine(isIsoDate, "must be a valid ISO date (YYYY-MM-DD)");
const originCity = z.enum(["SYD", "MEL", "PER"]);
const destinationCity = z.enum(["HAN", "SGN", "DAD"]);
const travelStyle = z.enum([
  "beach_relaxation",
  "food_culture",
  "education",
  "family",
  "vfr",
  "mixed",
]);
const budgetBand = z.enum(["budget", "standard", "premium"]);

const backgroundImage = z.object({
  url: nonBlankString,
  archetype: travelStyle,
  source: nonBlankString,
  owner: nonBlankString,
  licenseNote: nonBlankString,
});

const promotion = z
  .object({
    id: nonBlankString,
    title: nonBlankString,
    summary: nonBlankString,
    validUntil: isoDate.optional(),
  })
  .nullable()
  .optional();

const lotusmilesIndicative = z
  .object({
    earnBand: z.enum(["low", "mid", "high"]),
    note: nonBlankString,
  })
  .nullable()
  .optional();

/**
 * Request validation is intentionally separate from TripIntent validation:
 * it only owns transport concerns and mode-specific required fields.
 */
export const recommendRequestSchema = z
  .object({
    mode: z.enum(["brief", "quiz"]),
    briefText: z.string().trim().max(4000).optional(),
    originCity: originCity.optional(),
    quiz: quizAnswersSchema.optional(),
    priorityOverride: z
      .enum(["lowest_hassle", "best_for_family", "maximise_miles", "food_and_culture"])
      .optional(),
    cachedIntent: intentSchema.optional(),
    locale: z.enum(["en", "vi"]).optional(),
  })
  .superRefine((value, context) => {
    if (value.mode === "brief" && !value.briefText && !value.cachedIntent) {
      context.addIssue({
        code: "custom",
        path: ["briefText"],
        message: "is required for mode=brief unless cachedIntent is supplied",
      });
    }

    if (value.mode === "quiz" && !value.quiz && !value.cachedIntent) {
      context.addIssue({
        code: "custom",
        path: ["quiz"],
        message: "is required for mode=quiz unless cachedIntent is supplied",
      });
    }
  });

export const routeRecordSchema = z
  .object({
    id: nonBlankString,
    originCity,
    originAirport: nonBlankString,
    destinationCity,
    destinationAirport: nonBlankString,
    destinationName: nonBlankString,
    connectionType: z.enum(["direct", "one_stop", "two_stop"]),
    viaHub: destinationCity.nullable().optional(),
    typicalDurationHours: z.number().finite().positive(),
    seasonalityNotes: nonBlankString,
    gettingAround: nonBlankString,
    tripArchetypes: z.array(travelStyle).min(1),
    indicativeFareBand: budgetBand,
    bestMonths: z.array(z.number().int().min(1).max(12)),
    shoulderMonths: z.array(z.number().int().min(1).max(12)).optional(),
    backgroundImage,
    promotion,
    lotusmilesIndicative,
    dataConfidence: z.enum(["confirmed", "illustrative"]),
    sourceDocument: nonBlankString,
    sourceOwner: nonBlankString,
  })
  .superRefine((route, context) => {
    if (route.originAirport !== route.originCity) {
      context.addIssue({
        code: "custom",
        path: ["originAirport"],
        message: "must match originCity",
      });
    }

    if (route.destinationAirport !== route.destinationCity) {
      context.addIssue({
        code: "custom",
        path: ["destinationAirport"],
        message: "must match destinationCity",
      });
    }

    if (route.connectionType === "direct" && route.viaHub) {
      context.addIssue({
        code: "custom",
        path: ["viaHub"],
        message: "must be null or omitted for direct routes",
      });
    }

    if (route.connectionType !== "direct" && !route.viaHub) {
      context.addIssue({
        code: "custom",
        path: ["viaHub"],
        message: "is required for connecting routes",
      });
    }

    if (route.viaHub === route.destinationCity) {
      context.addIssue({
        code: "custom",
        path: ["viaHub"],
        message: "must differ from destinationCity",
      });
    }
  });

export const handoffPreviewRequestSchema = z.object({
  routeId: nonBlankString,
  intent: intentSchema,
});

export const saveTripRequestSchema = z.object({
  requestId: nonBlankString,
  routeId: nonBlankString,
  intent: intentSchema,
  consentReminder: z.boolean(),
});

export type ValidatedRecommendRequest = RecommendRequest;

export function formatValidationIssues(error: {
  issues: { path: readonly PropertyKey[]; message: string }[];
}): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("; ");
}

export function isIntentParseFailure(
  result: IntentParseResult,
): result is Extract<IntentParseResult, { ok: false }> {
  return !result.ok;
}

export type ValidatedRouteRecord = RouteRecord;
