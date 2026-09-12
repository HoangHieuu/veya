import type {
  IntentParseResult,
  RecommendRequest,
} from "../../../../shared/types.js";
import { parseTripIntent } from "./parseTripIntent.js";

/**
 * Framework-agnostic entry for Person D to mount POST /api/intent/parse.
 * Validates shape lightly then delegates to parseTripIntent.
 */
export async function parseIntentRequest(
  body: unknown,
): Promise<IntentParseResult> {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      errorCode: "EMPTY_INPUT",
      message: "Request body must be a JSON object",
    };
  }

  const candidate = body as Partial<RecommendRequest>;
  if (candidate.mode !== "brief" && candidate.mode !== "quiz") {
    return {
      ok: false,
      errorCode: "UNPARSEABLE",
      message: "mode must be brief or quiz",
    };
  }

  return parseTripIntent(candidate as RecommendRequest);
}
