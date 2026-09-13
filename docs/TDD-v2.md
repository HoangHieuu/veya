# TDD v2 — Veya Agent Canvas (UAVS Round 2)

> **Round 2 scope** for Agent + Interactive Canvas (extends [TDD.md](./TDD.md)).  
> Wizard spine (`home → brief → results → handoff`) remains the Phase 1 baseline.  
> **Contract detail:** [WORK_SPLIT.md](./WORK_SPLIT.md) · **Folders:** [STRUCTURE.md](./STRUCTURE.md)  
> **Alignment:** [VNA_ALIGNMENT_PLAN.md](./VNA_ALIGNMENT_PLAN.md)

**Repo:** https://github.com/HoangHieuu/veya

> **Layout target:** Three-panel agent workspace (chat · discovery canvas · live trip panel) — see **[TDD-v2-3panel.md](./TDD-v2-3panel.md)**. Two-column diagram in §III is an optional fallback layout.

---

## I. Objectives

### Product one-liner

**Veya = Discovery service embedded on vietnamairlines.com** — Agent + Interactive Canvas (not a text chatbot). Helps AU-origin travellers who **genuinely have not locked a destination/gateway** decide where to fly into Vietnam, unlock a **direct-only limited-time offer**, and book on VNA without leaving for an OTA.

### What judges must see

1. **Destination ≠ airport** — e.g. “visit family in Cà Mau” → SGN gateway + onward note (locality intelligence).
2. **Intent-gated Direct Decision Offer** — illustrative **−5%** when `discoveryMode = discovery`, time-boxed on canvas.
3. **Generative UI** — conversational input left, **structured components** right (cards, map, offer, CTA); agent orchestrates actions, not wall-of-text replies.
4. **Identity-native value** — mock member profile unlocks offer layer OTA cannot replicate (production: VNA Identity + Offer Engine).

### MVP goals (Round 2)

- Ship **Agent Shell**: chat column + canvas column on top of existing recommend/handoff spine.
- Detect **discovery vs route-known** intent; offer only when eligible.
- **3 demo paths**: Nguyens (VFR/locality + offer), Olivia (leisure 3-gateway), James (budget).
- Preserve **persona one-click** and **3-step wizard** as fallback — agent mode is primary wow path, not a replacement that blocks demo reliability.
- All fares/offers **illustrative** with disclaimers; no live GDS.

---

## II. Background

### Problem (VNA official)

OTAs win the click **before** the traveller chooses destination or airline. vna.com offers From/To/Date search — fine when the user already knows the airport, useless when they say “Cà Mau”, “beach trip”, or “Hanoi vs Saigon?”. Veya intercepts that **pre-search discovery moment** on the direct channel.

### Round 2 builds on Phase 1 modules

| Layer | Phase 1 baseline (required first) | Round 2 addition |
|-------|-----------------------------------|------------------|
| **A — web** | Wizard flow + results + handoff | Agent shell / 3-panel workspace, canvas actions, member toggle |
| **B — data** | 9 routes + highlights | Geo localities, offer policies, illustrative fares, destination spotlight |
| **C — intent** | Quiz + brief → `TripIntent` | `discoveryMode` classifier, ack templates, trip-field helpers |
| **D — api** | `POST /api/recommend` + scoring | Canvas state / agent turn, offer quote, locality resolution |
| **shared** | Core `TripIntent` / `RankedResponse` | Optional Appendix E types (team-approved PR) |

### Gap vs Round 2 vision

| Gap | Owner |
|-----|-------|
| Agent shell (chat + canvas split) | **A** |
| Canvas action renderer (components, not markdown) | **A** |
| `discoveryMode` + eligibility rules | **C** (+ **D** expose) |
| `OfferQuote` (−5%, expiry, terms) | **B** data + **D** compute |
| Locality map + ruled-out gateways UI | **A** (+ **B** coords) |
| Mock member profile toggle | **A** (client demo state) |
| Policy snippets for offer T&C | **B** |
| `POST /api/agent/turn` or extend recommend response | **D** |

---

## III. Design Proposal

### High-level architecture

> **See [TDD-v2-3panel.md](./TDD-v2-3panel.md)** for the target **three-column** layout (left chat · center discovery/booking · right live trip panel). Diagram below is an optional **two-column** layout if three columns are deferred.

Veya runs as an **embeddable module** on vna.com (demo: full-page or `/veya` route in `apps/web`).

```
┌─────────────────────────────────────────────────────────────┐
│ vietnamairlines.com (embed)                                  │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │ Agent Chat (A)  │  │ Interactive Canvas (A)            │  │
│  │ user messages   │  │ IntentChips, LocalityMap,         │  │
│  │ short agent ack │  │ RouteCard, OfferBlock, HandoffCTA │  │
│  └────────┬────────┘  └──────────────▲───────────────────┘  │
└───────────┼────────────────────────────┼──────────────────────┘
            │                            │
            ▼                            │
     POST /api/agent/turn ──────────────┘
     (or POST /api/recommend + canvas block)
            │
    ┌───────┴───────┐
    ▼               ▼
 parseIntent (C)   rank + offer (D)
    │               │
    └───────┬───────┘
            ▼
      data/ (B): routes, locality, policies, offer bands
```

**Agent behaviour:** After each user turn, backend returns **`AgentCanvasState`** — ordered list of **actions** that the canvas renders. Chat shows **≤2 short sentences**; heavy content lives in canvas only.

**Not a chatbot:** TDD explicitly allows conversational input; it forbids **full chatbot replacing wizard**. Agent mode coexists with wizard/personas.

### Discovery eligibility (core logic)

`discoveryMode: "discovery" | "route_known"`

| Signal | → discovery |
|--------|-------------|
| User compares gateways (“Hanoi or Saigon?”) | ✓ |
| Locality named without airport (Cà Mau, Huế, Mekong) | ✓ |
| Vibe trip, no fixed city (beach + food, no IATA) | ✓ |
| Explicit SYD→SGN + fixed dates | ✗ route_known |
| User only asks price on one known route | ✗ (no Veya offer) |

When `discovery` + session valid → attach **`OfferQuote`**: public illustrative fare, offer fare (−5%), `expiresAt` (e.g. +24h from turn).

### Canvas action types (A implements renderer)

| Action `type` | Component | Data source |
|---------------|-----------|-------------|
| `showIntent` | Intent chip row | `TripIntent` |
| `showLocality` | LocalityMap + ruled-out list | `LocalityResolution` |
| `showRoute` | RecommendedGatewayPanel (reuse) | `RankedCard` |
| `showExperiences` | AgentExperienceBento (reuse) | highlights / VFR “after landing” |
| `showOffer` | OfferBlock (new) | `OfferQuote` |
| `showDirectValue` | DirectBookingValueCard (reuse) | `RouteRecord` |
| `showEnrollment` | Lotusmiles signup guide (new) | `data/policies/` |
| `showHandoff` | HandoffCTA + countdown | `HandOffParams` |

### Member profile (demo — client mock)

**Out of scope:** real SSO/OAuth.

**In scope:** `MemberDemoProfile` in web state only:

```ts
type MemberDemoProfile = "guest" | "lotusmiles_member" | "lotustudents_verified";
```

- **guest:** sees public fare + “Sign in to unlock member fare” on canvas.
- **member / student:** sees strikethrough public → offer price; copy from `route.promotion` when eligible.

Production story (slide): VNA Identity Service + internal Offer Engine.

### Integration map (production — not built in hackathon)

| Integration | Demo | Production |
|-------------|------|------------|
| Route catalog | `data/routes/*.json` | VNA network feed |
| Locality/geo | `locality-gateway.json` + static coords | VNA CMS |
| Indicative pricing | fare band + snapshot AUD | Marketing fare module |
| Offer −5% | mock `OfferQuote` | VNA Offer Engine |
| Member promos | `route.promotion` | Loyalty + promo catalog |
| Policies / T&C | `data/policies/*.json` (+ optional offline corpus `data/policy-corpus/` via `POST /api/policy/ask`) | Approved RAG corpus |
| Flight inventory | handoff mock only | air-bounds session API |
| Identity | mock toggle | VNA SSO / Lotusmiles |

---

## IV. Backward Compatibility

- **Phase 1 flows stay available:** `home → brief → results → handoff` and personas remain the reliable demo path.
- **Agent mode:** new route/step or home entry — `step: "agent" | "home" | "brief" | "results" | "handoff"` (A adds `"agent"` only).
- **Mock mode:** `VITE_USE_MOCK=true` must return canvas actions from static JSON for offline demo.
- **Contract:** new fields on `RankedResponse` are **optional** until D PR merges (see Appendix E).
- **Rollback:** agent shell behind feature flag `VITE_AGENT_CANVAS=true` if needed.

---

## V. Action Plan (by role)

### Phase 3A — Agent spine (P0, ship first)

| # | Role | Task | Output |
|---|------|------|--------|
| 1 | **D** | Extend recommend response OR add `POST /api/agent/turn` returning `AgentCanvasState` | API + tests |
| 2 | **C** | `discoveryMode` classifier on `TripIntent` (+ locality signals) | `intent.discoveryMode` or derived field |
| 3 | **B** | `data/policies/direct-decision-offer.json` + `data/geo/localities.json` (Cà Mau, Huế, … lat + gateway distance note) | JSON |
| 4 | **B** | `data/offers/illustrative-fares.json` — AUD snapshot per route for strikethrough UI | JSON |
| 5 | **A** | **AgentShell** layout: chat column + canvas column | `AgentScreen.tsx` |
| 6 | **A** | **CanvasRenderer** maps `AgentAction[]` → components | `agent/canvas/` |
| 7 | **A** | Wire chat submit → API → render canvas | E2E agent path |
| 8 | **All** | Nguyens demo: brief → locality → SGN → offer countdown → handoff | DoD |

### Phase 3B — Offer + member layer (P0)

| # | Role | Task | Output |
|---|------|------|--------|
| 9 | **D** | `buildOfferQuote(intent, route, profile?)` — eligible if discovery | `OfferQuote` on response |
| 10 | **A** | **OfferBlock**: public price, offer price, countdown, terms link | component |
| 11 | **A** | **MemberDemoToggle** in canvas chrome (guest ↔ member) | local state |
| 12 | **A** | **EnrollmentCard** when guest + eligible offer | static copy from B |
| 13 | **B** | Lotusmiles / LotuStudents policy excerpts (3–5 bullets each) | `data/policies/` |

### Phase 3C — Polish + judge narrative (P1)

| # | Role | Task | Output |
|---|------|------|--------|
| 14 | **A** | **LocalityMap** SVG + pin (Cà Mau → SGN) | component |
| 15 | **A** | **RuledOutGateways** panel | component |
| 16 | **A** | Home reframe: “Vietnam Airlines · Direct discovery” embed story | copy |
| 17 | **A** | VFR bento: “After you land” chips (not tourist spots) | `experienceHighlights` filter |
| 18 | **C** | Agent ack messages: short templates per action (no long LLM prose) | templates |
| 19 | **All** | 3-min demo script: problem → Nguyens → member unlock → handoff | rehearsal |

### Phase 3D — Slides only (P2, no code)

- Cart abandonment Phase 2 (session context)
- MCP roadmap (routes + handoff as tools)
- Distribution economics slide (OTA commission → fund direct offer)

---

## VI. Person A (UI) — detailed scope

**Owner: T (you)** · Path: `apps/web/**` only

### New files / areas

```
apps/web/src/
├── screens/
│   └── AgentScreen.tsx          # primary Round 2 entry
├── components/agent/
│   ├── AgentShell.tsx           # two-column layout
│   ├── AgentChat.tsx            # message list + input
│   ├── CanvasRenderer.tsx       # action → component registry
│   ├── canvas/
│   │   ├── IntentChips.tsx
│   │   ├── LocalityMap.tsx
│   │   ├── RuledOutGateways.tsx
│   │   ├── OfferBlock.tsx
│   │   ├── EnrollmentCard.tsx
│   │   └── HandoffCTA.tsx
│   └── MemberDemoToggle.tsx
├── lib/
│   ├── agentState.ts            # canvas action reducer
│   └── memberDemo.ts            # guest | member | student
└── mocks/
    └── agentCanvas.nguyens.json # offline demo
```

### Reuse (do not rewrite)

- `RecommendedGatewayPanel`, `AgentExperienceBento`, `DirectBookingValueCard`, `RouteTicket`, `HandoffScreen`, `handoff-mock.html`

### UI state machine (A owns)

```ts
step: "home" | "agent" | "brief" | "results" | "handoff"
agentStatus: "idle" | "typing" | "canvas_ready" | "error"
memberProfile: "guest" | "lotusmiles_member" | "lotustudents_verified"
```

### A — Definition of Done

- [ ] Agent shell renders chat + canvas at 1280px and usable at 768px
- [ ] User message → canvas shows ≥3 action types (intent, route, offer)
- [ ] Nguyens path: 1 gateway, locality map, offer countdown
- [ ] Member toggle changes OfferBlock without new API call
- [ ] Handoff opens mock VNA with promo param
- [ ] Persona / wizard still work when `VITE_AGENT_CANVAS=false`
- [ ] All prices show illustrative disclaimer

### A — Do not

- Call LLM from browser
- Edit `data/`, `apps/api/`, `shared/types.ts` (request contract PR from D)
- Build real login or live fare fetch

---

## VII. Person B (Data) — detailed scope

Path: `data/**`

| Deliverable | Description |
|-------------|-------------|
| `data/geo/localities.json` | id, title, gateway, lat, lng, distanceToGatewayKm, onwardNote |
| `data/policies/direct-decision-offer.json` | −5% terms, eligibility, expiry hours, disclaimer |
| `data/policies/lotusmiles-enrollment.json` | 4–6 bullets + link label for enrollment card |
| `data/offers/illustrative-fares.json` | `{ routeId, publicFareAud, sourceDocument }` per 9 routes |
| VFR highlight overrides | optional `data/highlights/VFR-SGN.json` — Mekong, bus, family |
| `data/version.json` bump | minor version when shipped |

**DoD:** Every offer/policy claim has `sourceDocument`; validator passes.

---

## VIII. Person C (Intent) — detailed scope

Path: `apps/api/src/intent/**`, `fixtures/**`

| Deliverable | Description |
|-------------|-------------|
| `classifyDiscoveryMode(intent, briefText)` | returns `"discovery" \| "route_known"` |
| Extend brief heuristic | locality + compare-phrases (“or”, “vs”, “either”) |
| Fixtures | `fixtures/briefs/nguyens-discovery.json`, `olivia-discovery.json`, `james-route-known.json` |
| Agent ack templates | 1-line messages keyed by action type (deterministic) |
| Tests | discovery vs route_known cases |

**DoD:** Nguyens + Olivia → discovery; explicit SYD-SGN date → route_known.

---

## IX. Person D (API) — detailed scope

Path: `apps/api/**`, `shared/**` (contract PR)

| Deliverable | Description |
|-------------|-------------|
| `buildAgentCanvasState(intent, cards, offer?)` | ordered `AgentAction[]` |
| `buildOfferQuote(...)` | uses B illustrative fares + discovery flag |
| `buildLocalityResolution(brief, intent)` | wraps shared localityGateway |
| Extend `POST /api/recommend` **or** `POST /api/agent/turn` | returns canvas block |
| Unit tests | offer eligibility, action list for Nguyens fixture |
| `/dev/scoring` | optional: show discovery flag |

**DoD:** curl agent turn → JSON with actions + offer for Nguyens brief.

---

## X. Assumptions & Open Questions

### Assumptions

- Judges accept **mock member login** + **illustrative −5%** with policy disclaimer.
- One killer demo path (Nguyens) beats showing every feature.
- Agent canvas can ship as new home entry; old wizard remains fallback.

### Open questions (team vote)

1. Single endpoint (`recommend` + `canvas`) vs dedicated `/api/agent/turn`?
2. Approve Appendix E contract additions in one PR?
3. `VITE_AGENT_CANVAS=true` default for Round 2 demo?

---

## Appendix A — Out of scope (unchanged + clarifications)

- Real SSO, OAuth, Lotusmiles API
- Live GDS, scraping `api-des.vietnamairlines.com`
- Payment, ticketing, seat hold
- **Full chatbot replacing wizard** (agent canvas ≠ unlimited chat)
- Cart abandonment product build (slide only)
- MCP server build (slide only)
- Vector DB / streaming SSE to UI (exception: checked-in `data/policy-corpus/` + `POST /api/policy/ask` — see `TDD.md` §2)
- Multi-language UI (EN only)

---

## Appendix B — Role boundaries

| Role | Path | Branch |
|------|------|--------|
| **A — UI (T)** | `apps/web/**` | `feat/web/agent-canvas` |
| **B — Data** | `data/**` | `feat/data/agent-canvas` |
| **C — Intent** | `apps/api/src/intent/**`, `fixtures/**` | `feat/intent/discovery-mode` |
| **D — API** | `apps/api/**`, `shared/**` | `feat/api/agent-canvas` |

One PR per role folder. Contract changes: D opens PR, all four review.

---

## Appendix C — Definition of Done (Round 2)

| Role | Done when |
|------|-----------|
| **A** | Agent shell + canvas renderer + OfferBlock + member toggle + Nguyens E2E |
| **B** | geo + policies + illustrative fares shipped, version bumped |
| **C** | discoveryMode classifier + fixtures green |
| **D** | API returns canvas actions + offer quote + tests pass |
| **All** | 3-min demo rehearsed; mock + live API paths work |

---

## Appendix D — Demo script (3 min)

1. **(15s)** OTA vs vna.com — cannot search “Cà Mau”
2. **(45s)** Agent: Nguyens brief → canvas: locality map, SGN, ruled-out gateways
3. **(20s)** Guest sees public fare → toggle member → −5% countdown
4. **(20s)** Handoff mock VNA pre-filled
5. **(20s)** Slide: production = Identity + Offer Engine; OTA cannot copy
6. **(20s)** Optional: Olivia leisure 3-gateway contrast

---

## Appendix E — Proposed contract additions (D PR — team approval required)

Add to `shared/types.ts` when Phase 3A starts:

```ts
export type DiscoveryMode = "discovery" | "route_known";

export interface OfferQuote {
  eligible: boolean;
  ineligibleReason?: string;
  publicFareAud: number;
  offerFareAud: number;
  discountPct: number;
  expiresAt: string; // ISO8601
  termsId: string;
  illustrative: true;
}

export interface RuledOutGateway {
  gateway: DestinationCity;
  reason: string;
}

export interface LocalityResolution {
  localityId: string;
  localityTitle: string;
  gateway: DestinationCity;
  ruledOut: RuledOutGateway[];
  onwardNote?: string;
}

export type AgentAction =
  | { type: "showIntent"; summary: string }
  | { type: "showLocality"; resolution: LocalityResolution }
  | { type: "showRoute"; cardIndex: number }
  | { type: "showExperiences"; cardIndex: number }
  | { type: "showOffer"; offer: OfferQuote }
  | { type: "showDirectValue"; cardIndex: number }
  | { type: "showEnrollment"; policyId: string }
  | { type: "showHandoff"; cardIndex: number };

export interface AgentCanvasState {
  discoveryMode: DiscoveryMode;
  agentMessage: string;
  actions: AgentAction[];
  offer?: OfferQuote;
  locality?: LocalityResolution;
}

// Extend RankedResponse:
// canvas?: AgentCanvasState;
```

**A** may use local TypeScript duplicates in `apps/web/src/lib/agentTypes.ts` until D merges — delete duplicates after contract lands.

---

*Parent MVP scope: [TDD.md](./TDD.md). Layout detail: [TDD-v2-3panel.md](./TDD-v2-3panel.md). Pitch map: [VNA_ALIGNMENT_PLAN.md](./VNA_ALIGNMENT_PLAN.md).*
