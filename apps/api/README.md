# Veya API (Person D — Engine)

The API orchestrates Person C's intent parser, Person B's curated dataset, and the explainable ranking engine. It returns up to three VNA-compatible route cards and builds the mock handoff link used by the web app.

## Run

```bash
cd apps/api
npm ci
cp .env.example .env
npm run dev
```

The server listens on `http://localhost:3001` by default. `index.ts` only starts the server; `createApp()` in `src/app.ts` is the injectable app factory used by tests.

## Environment

| Variable | Meaning |
|----------|---------|
| `PORT` | API port, default `3001` |
| `NODE_ENV` | Production disables `/dev/scoring` by default |
| `ENABLE_DEV_SCORING=true` | Explicitly enable `/dev/scoring` in production |
| `OPENAI_API_KEY` | Server-only. Used by Person C intent gap-fill; also by opt-in `POST /api/policy/ask` |
| `INTENT_LLM_ENABLED` | Must be `"true"` for brief LLM gap-fill (default off unless set) |
| `POLICY_RAG_ENABLED` | Must be `"true"` for `/api/policy/ask` (default off — prevents open CORS from burning the key) |
| `OPENAI_MODEL` | Chat model for gap-fill / policy synthesize (default `gpt-4.1-nano`) |

The API starts even when B's dataset is absent. `/health` remains available with `status: degraded`; data-dependent endpoints return `503 DATASET_UNAVAILABLE` until at least one valid versioned route is available. Partial valid data is retained so missing coverage is visible in health and recommendation disclaimers.

## Endpoints

- `GET /health` — liveness, dataset status, route count, version, and loader errors.
- `POST /api/recommend` — validate request, resolve intent, filter, score, build cards, reasons, outlines, handoff, and metadata.
- `GET /api/routes?origin=SYD` — inspect valid curated records; omit `origin` to list all records.
- `POST /api/handoff/preview` — rebuild a mock handoff from `{ routeId, intent }`.
- `POST /api/trips/save` — bounded in-memory save; no database, email, or reminder delivery.
- `POST /api/agent/turn` — agent canvas turn handler.
- `POST /api/policy/ask` — opt-in semantic search over `data/policy-corpus/` (`POLICY_RAG_ENABLED=true` + `OPENAI_API_KEY`).

Malformed JSON and schema failures return `400`; bodies over the 64 KiB JSON limit return `413 PAYLOAD_TOO_LARGE`; route mismatches/not-found return `400`/`404`; parser `LLM_ERROR` and unavailable datasets return `503`. Dataset diagnostics exposed by `/health` are stable codes without filesystem paths, while detailed loader context is kept in the injectable server logger.

## Example request

```bash
curl -X POST http://localhost:3001/api/recommend \
  -H 'content-type: application/json' \
  -d '{
    "mode": "quiz",
    "quiz": {
      "originCity": "SYD",
      "travelStyle": "food_culture",
      "dateFlexibility": "flexible_±3",
      "budgetBand": "standard",
      "travellers": 2,
      "priority": "lowest_hassle"
    }
  }'
```

For a priority re-rank, send the previous response's `intent` as `cachedIntent` plus `priorityOverride`; Person C is then skipped completely.

## Implementation boundaries

- `src/scoring/` owns only deterministic scoring and grounded RAG-lite copy.
- `src/dataset/` reads `data/version.json` and `data/routes/*.json`; it never edits B's files.
- `src/intent/` remains Person C's module. D calls `parseTripIntent()` and maps `LLM_ERROR` to `503` for uncached briefs.
- `shared/types.ts` remains the contract source of truth and is unchanged for Phase 1.
- Destination preview / `experienceHighlights` is intentionally gated behind a separate contract PR, as required by the plan.

## Test

```bash
npm run typecheck
npm test
```

Tests use the app factory to inject parser, dataset, clock, ID generator, save store, and audit store. They cover scoring factors and weights, hard filters, cached re-ranking, loader failures, UTC return dates, API errors, save limits, and audit retention.
