# Veya (UAVS Hackathon)

Discovery layer for Vietnam Airlines — Australia travellers describe a trip, get ranked VNA routes, then hand off to the official booking site.

## Quick start (UI)

```bash
cd apps/web
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173 — mock mode is on by default (`VITE_USE_MOCK=true`).

**Agent workspace (Round 2 primary demo):** set `VITE_AGENT_CANVAS=true` in `apps/web/.env`, then **Talk to Veya** from home.

The agent workspace is **server-driven and has no mock path** — start the API first
(see *Full stack* below). Every chat message and every click goes through
`POST /api/agent/turn`, which returns the stage and the centre-panel content, so
the conversation and the canvas cannot drift apart. Correcting yourself works:
"actually from Perth", "change it to Hanoi", "make it 4 adults" all re-render the
centre panel on the same round trip. At the fare step the centre shows a branded
fare grid (Economy Lite/Classic/Flex, Premium Economy, Business Classic/Flex);
the fare you pick is remembered on the trip and stays on screen. Asking about
baggage, changes or refunds answers from the embedded VNA policy corpus, scoped
to your route and selected fare, with citations — and declines when the corpus
does not cover it (see `data/policy-corpus/README.md`).

### Demo script (~3 min)

1. **Problem (15s):** OTAs win before the traveller picks Hanoi vs Saigon vs Da Nang.
2. **Minh (45s):** Talk to Veya → Gold member → VFR Cà Mau → SGN gateway + offer + handoff.
3. **Alex (30s):** LotuStudents → food & culture → direct value vs OTA.
4. **Direct value (30s):** member profile → miles offer; why book direct vs OTA.
5. **Tech (30s):** intent + scoring API; RAG-lite reasons grounded in route dataset.

## Full stack (live API + dataset)

```bash
# Terminal 1 — API
cd apps/api
npm ci
cp .env.example .env   # add OPENAI_API_KEY; INTENT_LLM_ENABLED=true for brief LLM
npm run dev

# Terminal 2 — UI
cd apps/web
npm ci
cp .env.example .env
# Set VITE_USE_MOCK=false for live ranking
npm run dev
```

API serves curated route images at `/assets` (proxied by Vite in dev).

## Repo layout

Each role owns a **separate top-level path** so parallel work rarely touches the same files.

**Start here:** **[docs/TDD.md](./docs/TDD.md)** — scope, frozen flows, out-of-scope (use as AI context too).  
Also: [STRUCTURE.md](./docs/STRUCTURE.md) · [WORK_SPLIT.md](./docs/WORK_SPLIT.md) · [AGENTS.md](./AGENTS.md)

| Path | Owner | Purpose |
|------|-------|---------|
| `apps/web/` | **A — UI** | React + Vite frontend |
| `apps/api/` | **D — Engine** | Express API, scoring, orchestration |
| `apps/api/src/intent/` | **C — Intent AI** | Brief/quiz → `TripIntent` |
| `data/` | **B — Dataset** | Route JSON, images meta, version |
| `shared/` | **D + team** | Shared TypeScript types (frozen contract) |
| `fixtures/` | **C** | Sample briefs/quizzes for intent tests |
| `docs/` | Team | Structure, work split, contracts |

## Integration

1. **Freeze** `shared/types.ts` before feature work (changes = PR + ping whole team).
2. **B** ships `data/routes/*.json` → **D** loads via `apps/api/src/dataset/`.
3. **C** implements `parseTripIntent()` under `apps/api/src/intent/`.
4. **D** exposes `POST /api/recommend` on port **3001**.
5. **A** sets `VITE_USE_MOCK=false` in `apps/web/.env` to hit the live API (Vite proxies `/api`).

Full API & scoring contract: [docs/WORK_SPLIT.md](./docs/WORK_SPLIT.md).

## Scripts

| Command | Where | What |
|---------|-------|------|
| `npm run dev` | `apps/web` | UI dev server (:5173) |
| `npm run build` | `apps/web` | Production build |
| `npm run dev` | `apps/api` | API dev server (:3001) |
| `npm test` | `apps/api` | API + intent + scoring tests |

## Branch naming (avoid merge pain)

```
feat/web/<topic>      # Person A
feat/data/<topic>     # Person B
feat/intent/<topic>   # Person C
feat/api/<topic>      # Person D
```

Do **not** edit another role’s root folder in the same PR unless coordinating a contract change in `shared/`.
