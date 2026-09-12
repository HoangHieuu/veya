# Intent AI (Person C)

Parse quiz answers into validated `TripIntent` (`shared/types.ts`).

## Entry point

```ts
import { parseTripIntent } from "./parseTripIntent.js";

await parseTripIntent(recommendRequest);
await parseTripIntent(recommendRequest, { now: new Date("2026-09-11T00:00:00Z") });
```

**Person D** calls this from `POST /api/recommend` — do not expose LLM keys to the web app.

## Behaviour (this commit)

| Mode | Path | LLM? |
|------|------|------|
| `quiz` | Deterministic `quizMapper` | No |
| `brief` | Not yet — returns `UNPARSEABLE` until brief/LLM commit | — |

Rules:

- Request gate: `recommendRequestSchema`
- Quiz path never calls an LLM
- Supports origins SYD / MEL / PER
- Priority, goal, destination windows, and `maxStops` from priority table
- Do not pick routes or scorer weights

## Fixtures

Repo root `fixtures/quizzes/*` — each file is `{ request, expectedIntent, notes? }`.
Quiz expectations assume `now = 2026-09-11T00:00:00.000Z`.

## Tests

```bash
cd apps/api
npm test
```

## Layout

```
intent/
├── parseTripIntent.ts
├── schema.ts / constants.ts
├── quizMapper.ts / dateWindow.ts
└── *.test.ts
```
