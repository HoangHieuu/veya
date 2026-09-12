import type { IntentParseResult, RecommendRequest } from "../../../../shared/types.js";

/** Person C: replace stub with LLM + validation. */
export async function parseTripIntent(
  _input: RecommendRequest,
): Promise<IntentParseResult> {
  return {
    ok: false,
    errorCode: "LLM_ERROR",
    message: "Intent parser not implemented — Person C owns apps/api/src/intent/",
  };
}
