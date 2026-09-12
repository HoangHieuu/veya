# Intent AI (Person C)

Parse free-text briefs and quiz answers into `TripIntent` (`shared/types.ts`).

## Entry point

Implement:

```ts
import type { RecommendRequest, IntentParseResult } from "../../../../shared/types.js";

export async function parseTripIntent(
  input: RecommendRequest,
): Promise<IntentParseResult> {
  // ...
}
```

**Person D** calls this from `POST /api/recommend` — do not expose LLM keys to the web app.

## Fixtures

Add sample inputs under repo root [`fixtures/`](../../../fixtures/) (briefs, quizzes) and expected `TripIntent` outputs for tests.

## Rules

- Validate with zod (or equivalent) against `TripIntent`.
- Quiz path may be deterministic (no LLM).
- Default missing origin to `SYD` + record in `missingFields`.
- Do not pick routes — only emit intent.

See [docs/WORK_SPLIT.md](../../../docs/WORK_SPLIT.md) §6.
