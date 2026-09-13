# Veya Web (Person A — UI)

React + Vite + Tailwind UI for Veya. Consumes `POST /api/recommend` and `POST /api/trips/save` per [docs/WORK_SPLIT.md](../../docs/WORK_SPLIT.md).

**Ownership:** Person A — edit only under `apps/web/`. See [docs/STRUCTURE.md](../../docs/STRUCTURE.md).

## Run

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:5173

## Env

| Variable | Default | Meaning |
|----------|---------|---------|
| `VITE_USE_MOCK` | `true` | Use `src/mocks/rankedResponse.olivia.json` (no API) |
| `VITE_API_BASE` | empty | Prefix for API; with Vite proxy, leave empty and set `VITE_USE_MOCK=false` |

When Person D’s API is up on `:3001`:

```env
VITE_USE_MOCK=false
VITE_API_BASE=
```

Dev server proxies `/api` → `http://localhost:3001`.

## Screens

1. **Trip brief / Quick quiz** → submit  
2. **Results** — 3 cards, priority preset re-rank (`cachedIntent`), judge score toggle, save toast  
3. **Handoff** — pre-filled params + open mock search URL  

Shared types: `../../shared/types.ts` (alias `@shared/*`).
