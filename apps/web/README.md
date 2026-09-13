# Veya Web

React + Vite + Tailwind UI for **Veya** — Vietnam Airlines direct-channel discovery (UAVS Hackathon 2026).

## Quick start (mock — no API)

```bash
cd apps/web
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173

Default `.env`:

```env
VITE_USE_MOCK=true
VITE_AGENT_CANVAS=true
```

## Live API (ranking + RAG-lite copy from dataset)

Terminal 1 — API on `:3001`:

```bash
cd apps/api
npm ci && npm run dev
```

Terminal 2 — UI:

```env
VITE_USE_MOCK=false
VITE_AGENT_CANVAS=true
```

```bash
cd apps/web
npm run dev
```

Vite proxies `/api` and `/assets` to the API server.

## Demo paths (Round 2)

| Path | Flow |
|------|------|
| **Talk to Veya** | Home → profile picker → 3-panel agent (chat · discovery · trip) |
| **Guest** | Beach escape from Sydney → central coast discovery |
| **Minh Nguyen** | Gold member · VFR Cà Mau → SGN gateway + miles |
| **Alex Tran** | LotuStudents · food & culture city break |
| **Wizard fallback** | Start planning → 3-step quiz → results → handoff |

## Build & lint

```bash
npm run build
npm run lint
```

Shared types: `../../shared/types.ts` (alias `@shared/*`).
