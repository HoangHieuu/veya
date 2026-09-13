# Intent AI (Person C)

Parse free-text briefs and quiz answers into validated `TripIntent` (`shared/types.ts`).

## Entry points

```ts
import { parseTripIntent } from "./parseTripIntent.js";
import { parseIntentRequest } from "./parseIntentRequest.js";

// In-process (Person D recommend orchestration)
await parseTripIntent(recommendRequest);
// Optional injected clock for deterministic date windows:
await parseTripIntent(recommendRequest, { now: new Date("2026-09-11T00:00:00Z") });

// Optional debug HTTP body helper — D mounts POST /api/intent/parse
await parseIntentRequest(req.body);
```

## Behaviour

| Mode | Path | LLM? |
|------|------|------|
| `quiz` | Deterministic `quizMapper` | No |
| `brief` | Heuristic lexicon parser; optional LLM fill | Only if `INTENT_LLM_ENABLED=true` **and** `OPENAI_API_KEY` set |

Rules:

- Request gate: `recommendRequestSchema` (invalid `originCity` / mode → `VALIDATION_FAILED`)
- Missing origin → `SYD` + `missingFields` includes `originCity`
- `tripDurationDays` default **7**; `dateWindow.end = start + tripDurationDays` (UTC)
- Destinations only HAN / SGN / DAD — never invent others
- `priorityOverride` on the request overwrites inferred priority (and `maxStops` via priority table)
- Brief success requires **≥ 3** core field hits (origin / styles / travellers / priority / budget) — thin briefs like `"Sydney beach"` → `UNPARSEABLE`
- `locale` is ignored (EN MVP only)
- Do not pick routes or scorer weights
- Do **not** invent `mustIncludeTags` / `avoidTags` (dataset tag vocab is Person B)

### maxStops policy

| Signal | maxStops |
|--------|----------|
| Brief says "direct only" / "nonstop only" | 0 |
| "few connections" / "one stop" | 1 |
| Priority `lowest_hassle` / `best_for_family` | 1 |
| Other priorities | 2 |

### Lexicon notes

- `maximise_miles` needs `maximise miles` / `lotusmiles` — bare `miles` (distance) is ignored
- `food_culture` style needs `food` / cooking / `food and culture` — bare `culture` is ignored

## Env (do not commit keys)

Documented here instead of editing Person D's `.env.example`:

| Var | Purpose |
|-----|---------|
| `OPENAI_API_KEY` | Required for live LLM fill |
| `INTENT_LLM_ENABLED` | Must be `"true"` to call LLM; default off |
| `OPENAI_MODEL` | Optional; default `gpt-4.1-nano` (or set `gpt-5-nano`) |

Heuristic path works with no env vars. LLM uses OpenAI **Structured Outputs** (`json_schema` strict) for gap fields only; timeout/abort → silent heuristic fallback (never emits `LLM_ERROR`).

## Fixtures

Repo root `fixtures/briefs/*` and `fixtures/quizzes/*` — each file is `{ request, expectedIntent, notes? }`. Quiz expectations assume `now = 2026-09-11T00:00:00.000Z` (pass `{ now }` in tests).

Accuracy gate (heuristic unit tests): ≥90% per-brief pass and per-field accuracy on 8 briefs.

## Tests

```bash
cd apps/api
npm test
```

## Discovery mode (TDD-v2 §VIII)

```ts
import { classifyDiscoveryMode } from "./discoveryMode.js";

const mode = classifyDiscoveryMode(intent, briefText);
// "discovery" | "route_known" — derived classifier (optional on TripIntent later)
```

- Locality without airport IATA (Cà Mau → SGN) still sets `preferredDestination` for scoring, but `classifyDiscoveryMode` returns `"discovery"`.
- Gateway compare (`Hanoi or Saigon`) leaves `preferredDestination` unset so ranking can return 3 cards.
- Explicit SYD→SGN + ISO/`fixed dates` or price ask → `"route_known"` (no Direct Decision Offer).

## Layout

```
intent/
├── parseTripIntent.ts
├── parseIntentRequest.ts
├── schema.ts / constants.ts
├── quizMapper.ts / dateWindow.ts
├── briefHeuristic.ts / lexicon.ts
├── discoveryMode.ts       # classifyDiscoveryMode
├── agentAckTemplates.ts   # short canvas ack lines
├── tripOrchestration.ts   # 3-panel field/policy helpers
└── llmAdapter.ts          # optional, AbortController, json_schema gaps
```

### 3-panel helpers (TDD-v2-3panel §XI C)

```ts
import {
  suggestNextField,
  patchTripSummary,
  classifyPolicyIntent,
} from "./tripOrchestration.js";
import { buildAgentAck } from "./agentAckTemplates.js";

suggestNextField({}); // → "originCity"
patchTripSummary("Melbourne, beach, Da Nang, April, 2 adults");
classifyPolicyIntent("offer terms"); // → "direct-decision-offer"
buildAgentAck("showLocality", { localityTitle: "Cà Mau", gateway: "SGN" });
```

`LocalTripSummary` / `PolicyOverlayId` live in intent until mirrored in `shared/types.ts`.
