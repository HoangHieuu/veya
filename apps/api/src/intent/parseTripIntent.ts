import type {
  IntentParseResult,
  RecommendRequest,
} from "../../../../shared/types.js";
import { parseBriefHeuristic } from "./briefHeuristic.js";
import { maybeFillWithLlm, shouldUseLlm } from "./llmAdapter.js";
import { mapQuizToTripIntent } from "./quizMapper.js";
import {
  quizAnswersSchema,
  recommendRequestSchema,
  validateTripIntent,
} from "./schema.js";

export interface ParseTripIntentOptions {
  /** Injected clock for deterministic date windows (tests / D). Default: now. */
  now?: Date;
}

export async function parseTripIntent(
  input: RecommendRequest,
  options: ParseTripIntentOptions = {},
): Promise<IntentParseResult> {
  try {
    return await parseTripIntentUnsafe(input, options);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Intent parse failed";
    return { ok: false, errorCode: "VALIDATION_FAILED", message };
  }
}

async function parseTripIntentUnsafe(
  input: RecommendRequest,
  options: ParseTripIntentOptions,
): Promise<IntentParseResult> {
  const requestParsed = recommendRequestSchema.safeParse(input);
  if (!requestParsed.success) {
    return {
      ok: false,
      errorCode: "VALIDATION_FAILED",
      message: requestParsed.error.message,
    };
  }

  const req = requestParsed.data;
  const now = options.now ?? new Date();

  if (req.mode === "quiz") {
    if (!req.quiz) {
      return {
        ok: false,
        errorCode: "EMPTY_INPUT",
        message: "mode=quiz requires quiz answers",
      };
    }

    const quizParsed = quizAnswersSchema.safeParse(req.quiz);
    if (!quizParsed.success) {
      return {
        ok: false,
        errorCode: "VALIDATION_FAILED",
        message: quizParsed.error.message,
      };
    }

    const intent = mapQuizToTripIntent(quizParsed.data, {
      now,
      priorityOverride: req.priorityOverride,
    });
    const validated = validateTripIntent(intent);
    if (!validated.ok) {
      return {
        ok: false,
        errorCode: "VALIDATION_FAILED",
        message: validated.issues,
      };
    }
    return { ok: true, intent: validated.intent };
  }

  if (req.mode === "brief") {
    const briefText = req.briefText?.trim() ?? "";
    if (!briefText) {
      return {
        ok: false,
        errorCode: "EMPTY_INPUT",
        message: "mode=brief requires briefText",
      };
    }

    const { intent, fieldHits } = parseBriefHeuristic(briefText, {
      now,
      originCity: req.originCity,
      priorityOverride: req.priorityOverride,
    });

    const coreHitCount = [
      fieldHits.originCity,
      fieldHits.travelStyles,
      fieldHits.travellers,
      fieldHits.priority,
      fieldHits.budgetBand,
    ].filter(Boolean).length;

    if (coreHitCount < 3) {
      return {
        ok: false,
        errorCode: "UNPARSEABLE",
        message: "Could not extract enough trip fields from briefText",
      };
    }

    const withLlm = await maybeFillWithLlm(intent, briefText, {
      enabled: shouldUseLlm(),
    });

    const validated = validateTripIntent(withLlm);
    if (!validated.ok) {
      return {
        ok: false,
        errorCode: "VALIDATION_FAILED",
        message: validated.issues,
      };
    }
    return { ok: true, intent: validated.intent };
  }

  return {
    ok: false,
    errorCode: "UNPARSEABLE",
    message: `Unsupported mode: ${String((input as { mode?: string }).mode)}`,
  };
}
