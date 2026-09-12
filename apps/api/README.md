# Veya API (Person D — Engine)

Orchestrates intent parsing (C), dataset (B), and scoring. Exposes endpoints for the UI (A).

## Run (stub)

```bash
cd apps/api
npm install
cp .env.example .env
npm run dev
```

Listens on **http://localhost:3001** (see `PORT` in `.env`).

## Layout

| Path | Owner | Responsibility |
|------|-------|----------------|
| `src/index.ts` | D | Express app, mount routes, CORS |
| `src/routes/` | D | `POST /api/recommend`, `/api/trips/save`, … |
| `src/scoring/` | D | Weights, rank, card copy (RAG-lite) |
| `src/dataset/` | D | Load `../../data` — **read only** |
| `src/intent/` | **C** | `parseTripIntent()` — see [intent/README.md](./src/intent/README.md) |

## Endpoints (contract)

See [docs/WORK_SPLIT.md](../../docs/WORK_SPLIT.md) §3.

- `POST /api/recommend` — main flow
- `POST /api/trips/save` — save stub
- `GET /api/routes?origin=SYD` — optional debug

Person C's `POST /api/intent/parse` is optional (internal/debug only).
