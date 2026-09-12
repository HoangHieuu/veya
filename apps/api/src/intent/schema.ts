import { z } from "zod";
import type { TripIntent } from "../../../../shared/types.js";
import {
  DESTINATION_CITIES,
  MAX_TRAVEL_STYLES,
  ORIGIN_CITIES,
} from "./constants.js";

const originCitySchema = z.enum(ORIGIN_CITIES);
const destinationCitySchema = z.enum(DESTINATION_CITIES);

const travelStyleSchema = z.enum([
  "beach_relaxation",
  "food_culture",
  "education",
  "family",
  "vfr",
  "mixed",
]);

const budgetBandSchema = z.enum(["budget", "standard", "premium"]);

const priorityPresetSchema = z.enum([
  "lowest_hassle",
  "best_for_family",
  "maximise_miles",
  "food_and_culture",
]);

const dateFlexibilitySchema = z.enum([
  "fixed",
  "flexible_±3",
  "flexible_month",
]);

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date YYYY-MM-DD");

export const tripIntentSchema = z.object({
  originCity: originCitySchema,
  travelStyles: z.array(travelStyleSchema).min(1).max(MAX_TRAVEL_STYLES),
  budgetBand: budgetBandSchema,
  travellers: z.number().int().min(1),
  priority: priorityPresetSchema,
  dateWindow: z.object({
    start: isoDateSchema,
    end: isoDateSchema,
    flexibility: dateFlexibilitySchema,
  }),
  tripDurationDays: z.number().int().positive(),
  goal: z.enum(["discover_destination", "choose_route"]),
  preferredDestination: destinationCitySchema.optional(),
  constraints: z.object({
    maxStops: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    mustIncludeTags: z.array(z.string()).optional(),
    avoidTags: z.array(z.string()).optional(),
  }),
  rawSummary: z.string().min(1),
  parseConfidence: z.number().min(0).max(1),
  missingFields: z.array(z.string()),
});

type ParsedIntent = z.infer<typeof tripIntentSchema>;

/** Bidirectional contract check — fails typecheck if schema drifts from shared TripIntent. */
export type IntentContractCheck = [
  ParsedIntent extends TripIntent ? true : never,
  TripIntent extends ParsedIntent ? true : never,
];

const _intentContractOk: IntentContractCheck = [true, true];
void _intentContractOk;

export const quizAnswersSchema = z.object({
  travelStyle: travelStyleSchema,
  dateFlexibility: dateFlexibilitySchema,
  budgetBand: budgetBandSchema,
  travellers: z.number().int().min(1),
  priority: priorityPresetSchema,
  originCity: originCitySchema,
  departAfter: z.string().optional(),
  departBefore: z.string().optional(),
});

/** Gate at parseTripIntent entry — cachedIntent is opaque (D may skip C). */
export const recommendRequestSchema = z.object({
  mode: z.enum(["brief", "quiz"]),
  briefText: z.string().optional(),
  originCity: originCitySchema.optional(),
  quiz: quizAnswersSchema.optional(),
  priorityOverride: priorityPresetSchema.optional(),
  locale: z.enum(["en", "vi"]).optional(),
  cachedIntent: z.unknown().optional(),
});

export function validateTripIntent(
  value: unknown,
):
  | { ok: true; intent: TripIntent }
  | { ok: false; issues: string } {
  const parsed = tripIntentSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.message };
  }
  return { ok: true, intent: parsed.data as TripIntent };
}
