# Repository structure

Monorepo for **4 parallel developers**. Paths are split so each person commits mostly inside their own tree — fewer merge conflicts when everyone pushes to `main` or short-lived feature branches.

**Docs:** [TDD.md](./TDD.md) · [WORK_SPLIT.md](./WORK_SPLIT.md) · [VNA_ALIGNMENT_PLAN.md](./VNA_ALIGNMENT_PLAN.md) · [TDD-v2.md](./TDD-v2.md) · [TDD-v2-3panel.md](./TDD-v2-3panel.md)  
**Repo:** https://github.com/HoangHieuu/veya

## Directory map

```
veya/
├── apps/
    10|│   ├── web/                    ← Person A (UI)
│   │   ├── public/             static assets (sky.png, vnaplane.png, …)
│   │   ├── src/
│   │   │   ├── api/            HTTP client → /api/*
│   │   │   ├── components/     reusable UI
│   │   │   ├── screens/        Home, wizard, results, handoff
│   │   │   ├── lib/            wizard state, labels, helpers
│   │   │   ├── mocks/          mock RankedResponse (dev only)
│   │   │   └── context/        React context providers
│   │   └── .env.example
│   │
│   └── api/                    ← Person D (+ C subfolder)
│       └── src/
│           ├── index.ts        server entry, mounts routes
│           ├── routes/         POST /api/recommend, /api/trips/save, …
│           ├── scoring/        rank(intent, routes) — D only
│           ├── dataset/        load JSON from ../../data — D reads, B writes
│           └── intent/         ← Person C
│               └── parseTripIntent.ts
│
├── data/                       ← Person B (Dataset)
│   ├── version.json            datasetVersion (must match API meta)
│   ├── routes/                 one RouteRecord per file, e.g. SYD-SGN.json
│   ├── promotions/             optional promo records
│   ├── assets/                 image meta + license notes
│   └── fixtures/               sampleIntent + expectedTop3 for scorer tests
│
├── shared/                     ← Contract (Person D maintains; team reviews)
│   └── types.ts                TripIntent, RouteRecord, RankedResponse, …
│
├── fixtures/                   ← Person C (intent test inputs)
│   ├── briefs/                 olivia.json, vfr.json, …
│   └── quizzes/
│
└── docs/
    ├── TDD.md                  scope + out-of-scope (read before coding / AI)
    ├── STRUCTURE.md            this file
    └── WORK_SPLIT.md           full API + scoring contract
```

## Ownership rules

| Role | Edit freely | Read only | Do not edit |
|------|-------------|-----------|-------------|
| **A — UI** | `apps/web/**` | `shared/types.ts`, mock JSON shape | `data/`, `apps/api/src/scoring/`, intent prompts |
| **B — Data** | `data/**` | `shared/types.ts` (`RouteRecord`) | `apps/web/**`, scoring code |
| **C — Intent** | `apps/api/src/intent/**`, `fixtures/**` | `shared/types.ts` | UI, dataset files, scorer weights |
| **D — API** | `apps/api/**` (except coordinate with C on `intent/`), `shared/types.ts` | `data/**` | `apps/web/**` styling |

### Shared contract (`shared/types.ts`)

- **Single source of truth** for request/response shapes.
- Adding or renaming a field: open a PR, tag all four roles, update consumers in the same merge window if possible.
- **Never** duplicate types inside `apps/web` or `apps/api` — import via `@shared` (web) or relative path (api).

## How modules connect

```
┌─────────────┐   POST /api/recommend    ┌──────────────────┐
│  apps/web   │ ───────────────────────► │    apps/api      │
│  (Person A) │ ◄─────────────────────── │   (Person D)     │
└─────────────┘   RankedResponse JSON    └────────┬─────────┘
                                                    │
                    ┌───────────────────────────────┼───────────────────────────────┐
                    ▼                               ▼                               ▼
           apps/api/src/intent              data/routes/*.json              apps/api/src/scoring
              (Person C)                        (Person B)                      (Person D)
```

- **A** never calls the LLM; only `POST /api/recommend` and `POST /api/trips/save`.
- **D** reads **B**'s JSON from disk (`data/`), calls **C**'s `parseTripIntent`, runs scorer, returns cards.
- **B** does not run a server — only ships files under `data/`.

## Git workflow (reduce conflicts)

1. **Branch per role**: `feat/web/…`, `feat/data/…`, `feat/intent/…`, `feat/api/…`.
2. **Small PRs** scoped to one path when possible.
3. **Pull `main` before push** if others merged shared contract changes.
4. **CODEOWNERS** (`.github/CODEOWNERS`) — update GitHub usernames when the team is set.
5. Avoid drive-by edits across folders (e.g. A fixing copy inside `data/routes/` — ask B instead).

## Environment

| App | File | Key vars |
|-----|------|----------|
| Web | `apps/web/.env` | `VITE_USE_MOCK`, `VITE_API_BASE` |
| API | `apps/api/.env` | `PORT`, `OPENAI_API_KEY` (C/D only — never commit) |

Copy from each app's `.env.example`. Root `.gitignore` blocks all `.env` files.

## Local ports

| Service | Port | Command |
|---------|------|---------|
| UI | 5173 | `cd apps/web && npm run dev` |
| API | 3001 | `cd apps/api && npm run dev` |

Vite proxies `/api` → `localhost:3001` (see `apps/web/vite.config.ts`).

## Definition of done (per role)

- **A**: Brief → results → handoff click-through; mock **and** live API modes.
- **B**: 9 routes (SYD/MEL/PER × HAN/SGN/DAD), `version.json`, license notes on images.
- **C**: `parseTripIntent()` + fixtures; quiz path works without LLM.
- **D**: `curl` to `/api/recommend` returns valid `RankedResponse`; README for wiring UI.

Details and scoring weights: [WORK_SPLIT.md](./WORK_SPLIT.md). Product scope: [TDD.md](./TDD.md).
