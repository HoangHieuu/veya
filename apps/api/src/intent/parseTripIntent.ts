import type {
  IntentParseResult,
  RecommendRequest,
} from "../../../../shared/types.js";
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

/**
 * Person C — commit 06: deterministic quiz path.
 * Brief / LLM arrives in feat(intent) brief parser commit.
 */
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
    return {
      ok: false,
      errorCode: "UNPARSEABLE",
      message: "Brief parser not implemented yet (Person C follow-up commit)",
    };
  }

  return {
    ok: false,
    errorCode: "UNPARSEABLE",
    message: `Unsupported mode: ${String((input as { mode?: string }).mode)}`,
  };
}
