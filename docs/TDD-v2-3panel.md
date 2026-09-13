# TDD v2.1 — Three-Panel Agent Workspace (UAVS Round 2)

> **Preferred layout** for Round 2 agent mode (extends [TDD-v2.md](./TDD-v2.md)).  
> Discovery offer, locality intelligence, member profile, and handoff contracts stay as in the parent TDD.  
> **Parent scope:** [TDD-v2.md](./TDD-v2.md) · **Contracts:** [WORK_SPLIT.md](./WORK_SPLIT.md) · **Folders:** [STRUCTURE.md](./STRUCTURE.md)

**Repo:** https://github.com/HoangHieuu/veya

---

## I. Summary (TL;DR)

Veya Agent becomes a **three-column workspace**, not chat + one canvas:

| Column | Role | Updates when |
|--------|------|----------------|
| **Left — Chat** | Conversational input; prompts only when a field is missing | User types or taps inline widgets |
| **Center — Discovery canvas** | Promoted destinations, rich context (image, gateway, hotels, season), then booking | Trip stage advances |
| **Right — Trip panel** | Live trip summary: profile (pre-filled), origin, destination, dates, pax, gateway, offer | **Every** chat/widget change — realtime |

**Default screen:** left = pick origin (SYD/MEL/PER); center = **suggested destinations** (VNA-promotable); right = field labels with empty values except **member profile**.

**Booking canvas** appears in the **center column only after** required trip fields are complete.

---

## II. Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Veya on vietnamairlines.com                    [Member profile toggle]        │
├──────────────┬───────────────────────────────┬───────────────────────────────┤
│ LEFT         │ CENTER                        │ RIGHT                          │
│ Chat         │ Discovery / Booking canvas    │ Trip panel (live summary)      │
│              │                               │                                │
│ · messages   │ Stage-driven content:         │ · Lotusmiles profile (filled)  │
│ · widgets    │   - origin picks (default)    │ · From: ___                    │
│   only when  │   - suggested destinations    │ · Vibe: ___                    │
│   needed     │   - destination detail        │ · Destination: ___             │
│ · policy     │   - gateway + map             │ · Gateway: ___                   │
│   action     │   - hotel partner cards       │ · Depart / return: ___         │
│   chips      │   - season / weather note     │ · Adults: ___                    │
│              │   - offer + route ticket      │ · Offer: ___                     │
│              │   - handoff / book CTA        │ · [empty → filled live]        │
│              │                               │                                │
│              │ [Policy popup overlay]        │                                │
└──────────────┴───────────────────────────────┴───────────────────────────────┘
```

**Responsive (demo minimum):** 1280px three columns; 768px stack order: trip panel collapsible header → center → chat.

---

## III. Trip build — field priority

Chat and widgets follow this **priority order** (ask next missing field only):

| Priority | Field | Left (chat) | Center | Right panel |
|----------|-------|-------------|--------|-------------|
| 0 | Member profile | Toggle in chrome (not chat) | — | Pre-filled demo profile |
| 1 | **Origin** (AU) | Default: origin picker or “Where from?” | Suggested destinations filtered/promoted by origin | `From: SYD` |
| 2 | **Vibe / intent** | “What kind of trip?” (chips: family, beach, food…) | Filter suggested destinations by vibe | `Vibe: beach` |
| 3 | **Destination** (locality) | Optional clarify if vague | Destination cards with image + short copy | `Destination: Da Nang` |
| 4 | **Gateway** (inferred) | Agent ack only | Map / hub diagram SGN/DAD/HAN | `Gateway: DAD` |
| 5 | **Travellers** | “How many adults?” | — | `Adults: 2` |
| 6 | **Dates** | “When roughly?” | Season / weather note for chosen month | `Depart: April 2026` |
| 7 | **Hotel partner** (optional P1) | “Want hotel ideas?” | Booking.com partner cards + Lotusmiles copy | `Stay: suggested` |
| 8 | **Book** | “Ready to continue on VNA” | Center → booking canvas: route, offer, handoff CTA | Offer + handoff summary |

User may **skip chat order** with a full brief (“Melbourne, beach, Da Nang, April, 2 adults”) — parser fills multiple fields; center jumps to appropriate stage; right panel updates all at once.

---

## IV. Center canvas — stages

```ts
type DiscoveryStage =
  | "pick_origin"           // default: AU city selection (may mirror left widget)
  | "suggested_destinations" // promoted locality cards for origin (+ vibe if known)
  | "destination_detail"    // image, blurb, gateway inference, map
  | "hotels"                // partner suggestions (Booking.com story)
  | "season"                // month → season / weather copy
  | "booking"               // route ticket, offer, handoff — terminal stage
  ;

type PolicyOverlayId = "direct-decision-offer" | "lotusmiles" | "lotustudents" | string;
```

### Stage 1 — Default (`pick_origin` + `suggested_destinations`)

- **Left:** Welcome message; origin picker (SYD / MEL / PER) with confirm button.
- **Center:** Grid of **suggested destinations** — curated by VNA commercial intent.
  - Example promotion: push **Southern Vietnam / SGN** → cards for Saigon, Mekong, Cà Mau (via SGN), Phu Quoc story, etc.
  - Data-driven: `data/promotions/destination-spotlight.json` (B).
- **Right:** Labels visible; values empty except profile block.

### Stage 2 — Building trip

- **Left:** One missing-field prompt at a time (conversational, not wizard dump).
- **Center:** Updates to match last resolved segment:
  - After **beach** vibe → beach localities (Da Nang, Nha Trang, Phu Quoc…).
  - After user **picks destination** → detail card: hero image, gateway airport, onward note if locality ≠ gateway.
  - After **dates** → season panel (“April = dry season, 28–32°C…” — illustrative).
  - After **hotels** (P1) → 2–3 partner hotel cards with “Earn Lotusmiles on Booking.com” disclaimer.
- **Right:** Each resolution writes to trip panel immediately.

### Stage 3 — Booking (`booking`)

- Center shows: ranked route, Direct Decision Offer, member fare layer, **Continue on Vietnam Airlines →**.
- Left: short ack + optional policy action chips to reopen overlays.
- Right: full trip summary + offer row.

---

## V. Example flow — Beach

1. User lands → picks **MEL** (left + center origin).
2. Center: suggested destinations for MEL travellers (VNA can weight **DAD** coastal promo).
3. Left: “What vibe?” → user picks **Beach & relax**.
4. Center: beach destinations → user selects **Da Nang**.
5. System infers **gateway DAD**; center shows Da Nang image + “Fly into DAD”.
6. Right panel: `From MEL · Beach · Da Nang · Gateway DAD`.
7. Left: “How many adults?” → **2**.
8. Left: “When?” → **April**.
9. Center: season note for Da Nang in April.
10. Center (P1): Booking.com partner hotels near My Khe / Hoi An.
11. All required fields set → center transitions to **booking** (route card + offer + handoff).

---

## VI. Example flow — VFR (Nguyens)

1. Origin **MEL** → center may promote **SGN / Mekong delta** stories.
2. Vibe **Visit family** → center suggests southern localities (Cà Mau, Can Tho…).
3. User picks **Cà Mau** → gateway **SGN**, map SGN → Cà Mau, onward note.
4. Dates + pax → season less critical; optional family-oriented copy.
5. Booking canvas: MEL→SGN offer, member toggle, handoff with pre-fill.

---

## VII. Policy popup (center overlay)

When user asks about policy in chat (or taps a policy chip):

- **Center:** modal / drawer overlay on canvas — content from `data/policies/*.json` (B).
- **Left:** agent short reply + **persistent chip** e.g. “View offer terms” to reopen same overlay (`PolicyOverlayId`).
- **Right:** unchanged.

**Not in scope (default):** streaming live web RAG over arbitrary URLs.

**Allowed exception (hackathon / Round 2):** offline semantic search over a
**checked-in** VNA policy corpus (`data/policy-corpus/`) via
`POST /api/policy/ask` — embeddings are precomputed; live OpenAI is only used
to embed the user question and optionally synthesize a short cited answer.
If OpenAI is unavailable, the API must fail clearly (not pretend the corpus
missed). Keyword `data/policies/*.json` overlays remain the primary in-canvas path.

---

## VIII. VNA commercial hooks (why center exists)

| Hook | Center behaviour | Data owner |
|------|------------------|------------|
| **Destination promotion** | Spotlight cards per origin/vibe | **B** `destination-spotlight.json` |
| **Gateway steering** | Locality cards imply gateway | **B** locality-gateway + geo |
| **Direct Decision Offer** | Offer block on booking stage | **D** + **B** illustrative fares |
| **Booking.com partner** | Hotel cards + Lotusmiles earn copy | **B** `data/partners/booking-com.json` (P1) |
| **Member fares** | Right panel + offer strikethrough | **A** mock profile; prod = Identity |

---

## IX. State model (A owns UI; D may mirror for API)

```ts
interface TripSummary {
  memberProfile: "guest" | "lotusmiles_member" | "lotustudents_verified";
  originCity?: "SYD" | "MEL" | "PER";
  travelStyle?: TravelStyle;
  destinationLocalityId?: string;
  destinationTitle?: string;
  gateway?: "HAN" | "SGN" | "DAD";
  travellers?: number;
  departMonth?: string;       // e.g. "April"
  departDate?: string;        // ISO when known
  returnDate?: string;
  hotelInterest?: boolean;
}

interface AgentWorkspaceState {
  stage: DiscoveryStage;
  trip: TripSummary;
  chatMessages: ChatMessage[];
  policyOverlay?: PolicyOverlayId | null;
  discoveryMode?: "discovery" | "route_known";
  canvasPayload?: AgentCanvasState; // from API when booking stage
}
```

**Rule:** `trip` is the **single source of truth** for the right panel. Chat and center both write into `trip` via reducers — never duplicate fields in three places.

---

## X. API expectations (D / C)

### Option A — extend `POST /api/recommend`

Add optional blocks:

```ts
interface RecommendResponse {
  // existing RankedResponse fields…
  tripSuggestions?: DestinationSuggestion[];  // center spotlight cards
  seasonNote?: string;                        // after dates known
  hotelSuggestions?: HotelPartnerCard[];      // P1
  canvas?: AgentCanvasState;                  // booking stage
}
```

### Option B — `POST /api/agent/turn`

Request: `{ message, trip: TripSummary }`  
Response: `{ agentMessage, tripPatch, stage, centerContent, canvas?, policySnippet? }`

**C** provides: stage hints from intent (`travelStyle` → filter suggestions), short ack templates.  
**D** orchestrates: gateway inference, offer eligibility, action list for booking stage.

---

## XI. Role tasks (delta from TDD-v2)

### A — UI (`apps/web`)

| Task | Output |
|------|--------|
| **AgentWorkspaceShell** — 3-column layout | Replace / refactor `AgentShell.tsx` |
| **TripPanel** — right column live summary | `components/agent/TripPanel.tsx` |
| **DiscoveryCanvas** — stage router | `components/agent/DiscoveryCanvas.tsx` |
| **SuggestedDestinations** grid | promoted cards |
| **DestinationDetail** — image, gateway, map | reuse `LocalityMap`, `RouteDiagram` |
| **SeasonPanel** | illustrative month → season |
| **HotelPartnerCards** (P1) | Booking.com story |
| **PolicyOverlay** | modal on center |
| **AgentChat** | left; widgets on demand + policy chips |
| State reducer | `trip` + `stage` in `agentWorkspace.ts` |

**DoD:** Default 3-panel render; beach + Nguyens paths update right panel live; booking stage shows handoff.

### B — Data (`data/`)

| Deliverable | Used in |
|-------------|---------|
| `data/promotions/destination-spotlight.json` | Center suggested cards by origin/vibe |
| `data/geo/localities.json` | Gateway inference + map |
| `data/partners/booking-com.json` (P1) | Hotel cards |
| `data/seasons/*.json` or fields on localities | Season panel |
| `data/policies/*.json` | Policy overlay |
| Hero images meta | Destination detail cards |

### C — Intent (`apps/api/src/intent/`)

| Deliverable | Used in |
|-------------|---------|
| `classifyDiscoveryMode` | Offer eligibility |
| Partial brief → `TripSummary` patch | Full brief skip |
| Stage suggestion (`nextFieldPriority`) | Chat prompts |
| Policy intent → `PolicyOverlayId` | Popup routing |

### D — API (`apps/api/`, `shared/`)

| Deliverable | Used in |
|-------------|---------|
| `buildDestinationSuggestions(origin, vibe?)` | Center spotlight |
| `buildSeasonNote(locality, month)` | Center season |
| `buildAgentCanvasState` when stage = booking | Center booking |
| Contract PR: `TripSummary`, `DestinationSuggestion`, `DiscoveryStage` | All |

---

## XII. Feature flags (demo reliability)

- `VITE_AGENT_CANVAS=false` → legacy wizard only.
- `VITE_AGENT_CANVAS=true` + `VITE_AGENT_3PANEL=false` → optional two-column agent shell.
- `VITE_AGENT_3PANEL=true` → three-panel workspace (this doc).

---

## XIII. Out of scope (unchanged)

- Real Booking.com API / deep links with live availability
- Live weather API (illustrative season copy only)
- Real SSO / Lotusmiles login
- Live GDS pricing
- Unlimited chatbot (chat still orchestrates structured trip build)

---

## XIV. Demo script (3 min, updated)

1. **(15s)** Problem: OTA vs “where in Vietnam?”
2. **(30s)** Default: pick MEL → center shows promoted southern + central cards
3. **(45s)** Beach → Da Nang → gateway DAD → right panel fills live
4. **(30s)** Dates → season note; member toggle → offer on booking canvas
5. **(30s)** Policy chip → overlay terms → handoff VNA
6. **(30s)** Contrast: Nguyens VFR Cà Mau → SGN locality (same 3-panel chrome)

---

## Appendix — Vietnamese summary (cho team)

**Luồng 3 cột:** Trái chat · Giữa discovery/booking · Phải trip summary update realtime.

1. **Màn mặc định:** trái chọn SYD/MEL/PER; giữa gợi ý điểm đến (VNA promote được, vd. push SGN); phải chỉ có label, trừ profile member.
2. **Đang build trip:** chat hỏi từng thứ theo thứ tự ưu tiên (vibe → đích → gateway suy ra → số người → ngày); giữa đổi theo bước; phải cập nhật ngay mỗi lần chọn.
3. **Ví dụ beach:** vibe beach → gợi ý biển → chọn địa điểm → suy gateway → hotel partner (Booking.com + miles) → chọn ngày → mùa/thời tiết → đủ info thì giữa chuyển màn đặt vé.
4. **Policy:** popup trên canvas giữa; chat có nút mở lại popup.

---

*Parent: [TDD-v2.md](./TDD-v2.md). MVP baseline: [TDD.md](./TDD.md). Pitch map: [VNA_ALIGNMENT_PLAN.md](./VNA_ALIGNMENT_PLAN.md).*
