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

## Repo layout

Each role owns a **separate top-level path** so parallel work rarely touches the same files. See **[docs/STRUCTURE.md](./docs/STRUCTURE.md)** for ownership, merge rules, and API contracts.

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
| `npm run dev` | `apps/api` | API dev server (:3001) — stub until D wires routes |

## Branch naming (avoid merge pain)

```
feat/web/<topic>      # Person A
feat/data/<topic>     # Person B
feat/intent/<topic>   # Person C
feat/api/<topic>      # Person D
```

Do **not** edit another role’s root folder in the same PR unless coordinating a contract change in `shared/`.
