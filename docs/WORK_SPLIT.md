# Veya — Chia việc 4 người + Contract nối hệ thống

**Mục tiêu:** Mỗi người làm module riêng, mock được độc lập. Khi ráp: chỉ nối theo contract dưới đây, không đụng logic nội bộ của người khác.

**Docs liên quan:** [TDD.md](./TDD.md) · [STRUCTURE.md](./STRUCTURE.md) · [VNA_ALIGNMENT_PLAN.md](./VNA_ALIGNMENT_PLAN.md) · [TDD-v2.md](./TDD-v2.md)

**Stack đề xuất (thống nhất trước khi code):**
- Monorepo hoặc 1 repo: `apps/web` (React + Tailwind) + `apps/api` (Node/Express hoặc Next.js API routes)
- Shared types: `packages/shared` hoặc `src/shared/types.ts` — **source of truth duy nhất**
- Dataset: JSON tĩnh trong `data/`
- LLM: 1 provider (OpenAI / Gemini) — **chỉ Person C** giữ API key và gọi model (D chỉ gọi `parseTripIntent`, không gọi LLM trực tiếp)

**Owner UI:** bạn (Person A). Ba người còn lại nhận B / C / D.

---

## 1. Tổng quan module

```
┌─────────────┐     POST /api/recommend      ┌──────────────────┐
│  A. UI      │ ───────────────────────────► │  D. API / Engine │
│  (React)    │ ◄─────────────────────────── │  (orchestrator)  │
└─────────────┘     RankedResponse JSON      └────────┬─────────┘
                                                      │
                         ┌────────────────────────────┼────────────────────────────┐
                         ▼                            ▼                            ▼
                ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
                │ C. Intent AI    │        │ B. Dataset      │        │ D. Scorer       │
                │ brief → TripIntent│      │ routes/*.json   │        │ rank(intent,    │
                └─────────────────┘        └─────────────────┘        │   candidates)   │
                                                                      └─────────────────┘
```

| Role | Phụ trách | Không đụng |
|------|-----------|------------|
| **A — UI** | Màn hình, state UI, gọi API, hand-off mock trên client nếu cần | Prompt LLM, công thức score, nội dung dataset |
| **B — Dataset & Content** | Schema + file JSON route/destination, ảnh meta, promo, label confirmed/illustrative | UI, LLM, công thức ranking |
| **C — Intent AI** | Parse free-text / quiz → `TripIntent` validated | UI, ranking weights, viết copy card |
| **D — Engine & API** | Orchestrate A↔C↔B, scoring, build card payload, hand-off URL, save stub | Styling UI, viết prompt dài ngoài interface đã chốt |

---

## 2. Shared types (mọi người import — không tự invent field)

File: `shared/types.ts` (Person D tạo skeleton ngày 1 giờ đầu; cả team review 15 phút rồi freeze).

```ts
/** --- Input từ UI --- */
export type InputMode = "brief" | "quiz";

export type PriorityPreset =
  | "lowest_hassle"
  | "best_for_family"
  | "maximise_miles"
  | "food_and_culture";

export type BudgetBand = "budget" | "standard" | "premium";

export type TravelStyle =
  | "beach_relaxation"
  | "food_culture"
  | "education"
  | "family"
  | "vfr"
  | "mixed";

export interface QuizAnswers {
  travelStyle: TravelStyle;
  dateFlexibility: "fixed" | "flexible_±3" | "flexible_month";
  budgetBand: BudgetBand;
  travellers: number; // >= 1
  priority: PriorityPreset;
  /** ISO date YYYY-MM-DD; optional nếu flexible */
  departAfter?: string;
  departBefore?: string;
  originCity: "SYD" | "MEL" | "PER";
}

export interface RecommendRequest {
  mode: InputMode;
  /** mode=brief */
  briefText?: string;
  originCity?: "SYD" | "MEL" | "PER"; // brief có thể thiếu → C phải extract hoặc default SYD
  /** mode=quiz */
  quiz?: QuizAnswers;
  /**
   * Khi user đổi preset trên màn results: A gửi lại full RecommendRequest
   * + priorityOverride. D re-rank trên cùng intent (C có thể skip LLM nếu
   * client gửi kèm intent đã parse — xem `cachedIntent` dưới).
   */
  priorityOverride?: PriorityPreset;
  /** Optional: tránh gọi LLM lần 2 khi chỉ đổi preset */
  cachedIntent?: TripIntent;
  locale?: "en" | "vi";
}

/** Error body thống nhất cho mọi 4xx/5xx */
export interface ApiError {
  errorCode: string;
  message: string;
}

/** --- Output của Person C --- */
export interface TripIntent {
  originCity: "SYD" | "MEL" | "PER";
  travelStyles: TravelStyle[]; // 1–3
  budgetBand: BudgetBand;
  travellers: number;
  priority: PriorityPreset;
  dateWindow: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
    flexibility: "fixed" | "flexible_±3" | "flexible_month";
  };
  /** Số ngày rảnh ước lượng — dùng để suy returnDate khi handoff */
  tripDurationDays: number; // e.g. Olivia 8–10 → lấy 9
  /**
   * Discovery vs route-selection (đúng 2 pilot scenario trong proposal).
   * known → C điền preferredDestination; D vẫn rank nhưng boost mạnh route khớp.
   */
  goal: "discover_destination" | "choose_route";
  preferredDestination?: "HAN" | "SGN" | "DAD";
  constraints: {
    maxStops: 0 | 1 | 2; // từ "few connections" / lowest hassle
    mustIncludeTags?: string[];
    avoidTags?: string[];
  };
  rawSummary: string; // 1 câu paraphrase intent, dùng cho card explanation
  parseConfidence: number; // 0–1
  missingFields: string[]; // field C không lấy được → UI có thể hỏi lại (MVP: chỉ log)
}

export type IntentParseResult =
  | { ok: true; intent: TripIntent }
  | {
      ok: false;
      errorCode: "EMPTY_INPUT" | "UNPARSEABLE" | "VALIDATION_FAILED" | "LLM_ERROR";
      message: string;
    };

/** --- Dataset Person B --- */
export type DataConfidence = "confirmed" | "illustrative";

export type ConnectionType = "direct" | "one_stop" | "two_stop";

export interface RouteRecord {
  id: string; // e.g. "SYD-SGN-direct"
  originCity: "SYD" | "MEL" | "PER";
  originAirport: string; // SYD
  destinationCity: "HAN" | "SGN" | "DAD";
  destinationAirport: string;
  destinationName: string; // "Ho Chi Minh City"
  connectionType: ConnectionType;
  viaHub?: "HAN" | "SGN" | null;
  typicalDurationHours: number;
  seasonalityNotes: string;
  gettingAround: string; // airport → city centre
  tripArchetypes: TravelStyle[];
  /**
   * Bắt buộc để D tính budgetFit (MVP không có giá live).
   * So khớp với TripIntent.budgetBand — lệch 0 bậc = 100, 1 bậc = 60, 2 bậc = 20.
   */
  indicativeFareBand: BudgetBand;
  /**
   * Tháng đẹp / nên tránh — để D tính dateFit có cấu trúc (không chỉ đọc prose).
   * 1–12; để trống = trung lập.
   */
  bestMonths: number[];
  shoulderMonths?: number[];
  backgroundImage: {
    url: string; // /assets/... hoặc URL licensed
    archetype: TravelStyle;
    source: string;
    owner: string;
    licenseNote: string;
  };
  promotion?: {
    id: string;
    title: string;
    summary: string;
    validUntil?: string;
  } | null;
  lotusmilesIndicative?: {
    earnBand: "low" | "mid" | "high";
    note: string;
  } | null;
  dataConfidence: DataConfidence;
  sourceDocument: string;
  sourceOwner: string;
}

/** --- Scoring Person D --- */
export interface ScoreBreakdown {
  intentMatch: number;    // 0–100
  dateFit: number;
  routeConvenience: number;
  budgetFit: number;      // illustrative band only
  loyaltyValue: number;
  promotionBoost: number;
  weightedTotal: number;  // 0–100
  weightsUsed: Record<keyof Omit<ScoreBreakdown, "weightedTotal" | "weightsUsed" | "reasons">, number>;
  reasons: string[];      // 2–4 bullet "why this fits" (English MVP)
}

export interface RankedCard {
  rank: 1 | 2 | 3;
  routeId: string;
  route: RouteRecord;     // snapshot từ dataset (không mutate file gốc)
  score: ScoreBreakdown;
  tripOutline: string;    // 2–3 câu illustrative itinerary
  handoff: HandOffParams;
}

export interface HandOffParams {
  origin: string;      // airport code
  destination: string;
  departDate: string;  // YYYY-MM-DD = intent.dateWindow.start
  /** start + tripDurationDays (inclusive/exclusive: D chốt = start + duration) */
  returnDate: string;
  /** MVP: map 1-1 từ intent.travellers (không tách children) */
  adults: number;
  /** Mock deep-link; không đụng production booking */
  searchUrl: string;
}

export interface RankedResponse {
  requestId: string;
  intent: TripIntent;
  cards: RankedCard[]; // length === 3 (hoặc <3 nếu dataset thiếu — ghi rõ)
  meta: {
    datasetVersion: string;
    scoringVersion: string;
    usedIllustrativeData: boolean;
    disclaimer: string;
  };
}

export interface SaveTripRequest {
  requestId: string;
  routeId: string;
  intent: TripIntent;
  consentReminder: boolean;
}

export interface SaveTripResponse {
  saveId: string;
  remindAfterHours: number; // e.g. 24
  status: "saved";
}
```

**Freeze rule:** Sau khi team chốt `shared/types.ts`, thêm field phải PR + báo cả nhóm. Không đổi tên field giữa chừng.

---

## 3. API connectors (Person D expose; A gọi; C/B bị gọi nội bộ)

Base URL local: `http://localhost:3001` (hoặc cùng origin `/api` nếu Next).

### 3.1 `POST /api/recommend`

**Caller:** A (UI)  
**Implement:** D  
**Internal:** D → C.parse() → B.loadRoutes() → D.rank() → response

Request body: `RecommendRequest`  
Response `200`: `RankedResponse`  
Errors:

| HTTP | body |
|------|------|
| 400 | `ApiError` từ IntentParseResult fail hoặc validation |
| 503 | LLM down — nếu `mode=quiz` hoặc có `cachedIntent`: D vẫn rank; nếu `mode=brief` không cache: trả 503 `ApiError` **hoặc** heuristic intent tối thiểu + `meta.disclaimer` (D chọn 1 cách và ghi README) |

**Contract thời gian:** P95 < 8s (có cache). UI hiện skeleton sau 300ms.

**Orchestration chi tiết (D):**
1. Nếu `cachedIntent` hợp lệ → skip C; apply `priorityOverride` lên copy intent.
2. Else → `C.parseTripIntent(req)`.
3. `routes = B.getRoutesForOrigin(intent.originCity)`.
4. Nếu `intent.goal === "choose_route"` và có `preferredDestination` → filter/boost route khớp destination.
5. Score + sort → lấy **min(3, routes.length)** cards.
6. Mỗi card: `reasons` + `tripOutline` theo §4.1 (RAG-lite); `handoff` theo công thức returnDate; `requestId` = uuid do D tạo.

### 3.2 `POST /api/intent/parse` (internal / optional debug)

**Caller:** D (và C tự test)  
**Implement:** C  

Request:
```ts
{ mode: InputMode; briefText?: string; quiz?: QuizAnswers; originCity?: string; locale?: string }
```
Response: `IntentParseResult`

A **không** gọi endpoint này trực tiếp ở MVP (tránh double-parse). Chỉ dùng cho Postman/unit test của C.

### 3.3 `GET /api/routes?origin=SYD`

**Caller:** D (runtime) và B (self-test)  
**Implement:** **D đọc file JSON của B** (B không host server riêng). B chỉ ship `data/**` + helper `loadDataset` nếu dùng TypeScript shared.  
Response: `{ version: string; routes: RouteRecord[] }`

### 3.4 `POST /api/handoff/preview`

**Caller:** A (khi user bấm CTA trên card; có thể bỏ nếu card đã có `handoff`)  
**Implement:** D  

Request: `{ routeId: string; intent: TripIntent }`  
Response: `HandOffParams`

MVP: field `handoff` đã nằm trong mỗi `RankedCard` → A có thể **không cần** gọi 3.4; giữ endpoint cho demo “rebuild link”.

### 3.5 `POST /api/trips/save`

**Caller:** A  
**Implement:** D (in-memory / JSON file; không cần DB thật)

Request: `SaveTripRequest`  
Response: `SaveTripResponse`

Reminder thật (email) **out of MVP** — chỉ trả `remindAfterHours` + log console là đủ.

---

## 4. Scoring contract (Person D) — weights theo preset

Preset → trọng số (tổng = 1.0). **Ẩn trên UI traveller**; hiện ở `/dev/scoring` (judge view) nếu kịp.

| Factor | lowest_hassle | best_for_family | maximise_miles | food_and_culture |
|--------|---------------|-----------------|----------------|------------------|
| intentMatch | 0.25 | 0.25 | 0.20 | 0.35 |
| dateFit | 0.15 | 0.15 | 0.10 | 0.10 |
| routeConvenience | 0.35 | 0.25 | 0.15 | 0.15 |
| budgetFit | 0.15 | 0.15 | 0.10 | 0.10 |
| loyaltyValue | 0.05 | 0.05 | 0.35 | 0.05 |
| promotionBoost | 0.05 | 0.15 | 0.10 | 0.25 |

**Rule thiếu data:** field null (promo / lotusmiles) → score factor = 0, không throw.  
**Rule dataset:** chỉ rank route có trong curated set; không hallucinate destination.  
**Illustrative:** vẫn rank được nhưng `dataConfidence` và `meta.usedIllustrativeData` phải đúng; UI hiện Badge + Alert.

**Cardinality:** `cards.length === min(3, candidateCount)`. Nếu `< 3`, `meta.disclaimer` phải nói rõ (không được im lặng). Không yêu cầu “luôn đúng 3” khi dataset origin đó thiếu route.

Tie-break: `routeConvenience` → `intentMatch` → `routeId` alpha.

### 4.1 RAG-lite cho card copy (chốt scope MVP — khớp proposal “RAG-grounded” ở mức hackathon)

Proposal ghi RAG cho destination cards. **MVP không dựng vector DB.** Thay bằng grounded templates (vẫn gọi là RAG-lite trong README/pitch):

| Field | Owner | Rule |
|-------|-------|------|
| `score.reasons[]` | **D** | 2–4 câu; mỗi câu phải paraphrase từ field có thật trên `RouteRecord` + `TripIntent` (archetype, connection, seasonality, promo, gettingAround). Cấm bịa số liệu ngoài record. |
| `tripOutline` | **D** | 2–3 câu template: ngày đi / gợi ý nhịp chuyến / note illustrative. Có thể nhờ C export `buildOutline(intent, route)` nếu D quá tải — signature chốt trong shared. |

Judge view `/dev/scoring`: hiện weights + breakdown + **source field tags** cạnh mỗi reason (traceability 100%).

---

## 5. Dataset contract (Person B)

### 5.1 Files

```
data/
  version.json          # { "datasetVersion": "0.1.0", "updatedAt": "..." }
  routes/
    SYD-HAN.json
    SYD-SGN.json
    SYD-DAD.json
    MEL-HAN.json
    ... (đủ 3 origins × 3 destinations = 9 records tối thiểu)
  promotions/           # optional, referenced by id từ route
  assets/meta.json      # map archetype → image path + license
```

Mỗi file route = 1 `RouteRecord`.  
**Bắt buộc đủ 9 routes** cho MVP (SYD/MEL/PER × HAN/SGN/DAD).

### 5.2 Nội dung tối thiểu mỗi route

- connection đúng network (ví dụ DAD = one_stop via HAN hoặc SGN, **không** ghi direct nếu không confirmed)
- `indicativeFareBand`, `bestMonths` (để scoring không đoán mò)
- `gettingAround` 1–2 câu
- `seasonalityNotes` 1 câu
- `backgroundImage` licensed / placeholder có `licenseNote`
- `dataConfidence` + `sourceDocument`

### 5.3 Connector cho D

```ts
// B export (hoặc D đọc JSON)
function loadDataset(): { version: string; routes: RouteRecord[] }
function getRoutesForOrigin(origin: "SYD" | "MEL" | "PER"): RouteRecord[]
function getRouteById(id: string): RouteRecord | undefined
```

B ship kèm `data/fixtures/sampleIntent.json` + `expectedTop3.json` để D test scorer không cần LLM.

---

## 6. Intent AI contract (Person C)

### 6.1 Function signature (D gọi in-process hoặc HTTP)

```ts
async function parseTripIntent(input: RecommendRequest): Promise<IntentParseResult>
```

### 6.2 Trách nhiệm C

1. Brief → LLM → JSON đúng schema `TripIntent`
2. Quiz → map **deterministic** sang `TripIntent` (không bắt buộc LLM; được phép LLM để `rawSummary`)
3. Validate bằng zod/io-ts (cùng shape `shared/types`)
4. Nếu thiếu `originCity` trong brief → default `SYD` + đẩy vào `missingFields`
5. Extract `tripDurationDays` (default 7 nếu không nói); `goal` + `preferredDestination` nếu user đã nêu điểm đến
6. Không bịa destination ngoài bộ HAN/SGN/DAD; C **không** chọn route — chỉ emit intent

### 6.3 Fixture C phải giao cho A/D ngày 1

| File | Mục đích |
|------|----------|
| `fixtures/briefs/olivia.json` | Pilot persona Olivia |
| `fixtures/briefs/vfr.json` | VFR |
| `fixtures/briefs/student.json` | Student |
| `fixtures/quizzes/*.json` | 3 quiz samples |
| Output mẫu `TripIntent` tương ứng | A mock UI khi API chưa sẵn |

Target validation: ≥90% parse đúng trên 5–8 briefs (đúng proposal).

---

## 7. UI contract (Person A — bạn)

### 7.1 Màn hình & state máy

`step` và `status` là hai trục độc lập (không dùng thêm state ẩn kiểu idle/editing/submitting):

```
step:   brief ──► results ──► handoff
status: idle | loading | success | error
```

- Đang gõ brief/quiz: `step=brief`, `status=idle`
- Bấm submit: `status=loading` (giữ `step=brief` hoặc chuyển `results` kèm skeleton — A chọn 1 và giữ nhất quán)
- OK: `step=results`, `status=success`, gắn `response`
- Fail: `status=error`, `errorMessage` từ `ApiError.message`
- Đổi priority preset trên results: gửi lại `/api/recommend` với `cachedIntent` + `priorityOverride` → `status=loading` ngắn
- CTA search: `step=handoff` hoặc mở `searchUrl` tab mới (chốt 1 cách trước Day 2)
- Save OK: gắn `saveId` (không bắt buộc đổi step)

**Client state (React):**

```ts
interface UIState {
  step: "brief" | "results" | "handoff";
  mode: InputMode;
  briefText: string;
  quiz: Partial<QuizAnswers>;
  priorityOverride?: PriorityPreset;
  status: "idle" | "loading" | "success" | "error";
  errorMessage?: string;
  response?: RankedResponse;
  selectedRouteId?: string;
  saveId?: string;
}
```

### 7.2 Chỉ gọi

- `POST /api/recommend` khi Submit
- `POST /api/trips/save` khi Save
- Dùng `card.handoff.searchUrl` cho CTA “Search on Vietnam Airlines” (mở tab / mock page)

### 7.3 UI phải hiện từ contract (không hardcode nội dung route)

- Rank, destinationName, reasons[], gettingAround, tripOutline
- Badge: `connectionType`, `dataConfidence`
- Alert nếu `dataConfidence === "illustrative"` hoặc `meta.usedIllustrativeData`
- Skeleton 3 card slots khi `status === "loading"`
- Dev/judge toggle (optional): hiện `score.weightsUsed` + breakdown

### 7.4 Mock song song (A không bị block)

A tạo `mocks/rankedResponse.olivia.json` theo `RankedResponse`.  
Feature flag `VITE_USE_MOCK=true` → bỏ qua API.  
Khi D sẵn `/api/recommend`, tắt flag là ráp xong.

---

## 8. Thứ tự giao hàng (để ráp được sớm)

### Giờ 0–1 (cả team)

1. Person D tạo repo skeleton + `shared/types.ts`
2. Freeze types (15 phút)
3. Chốt port, env keys (`OPENAI_API_KEY` / Gemini key **chỉ trên máy chạy Person C**; D không cần key nếu gọi C in-process trên cùng service — nếu tách process thì key chỉ nằm service C)

### Song song sau freeze

| Person | Deliverable Day 1 (giờ 1–8) | Done when |
|--------|----------------------------|-----------|
| **A** | 2 màn Brief + Results (mock JSON), design tokens, loading/error | Submit với mock ra 3 cards đúng layout |
| **B** | 9 `RouteRecord` + version + 3 ảnh archetype placeholder có license note | `GET` routes trả đủ 9; D load được |
| **C** | `parseTripIntent` + zod + 3 fixture briefs | Postman/unit: brief Olivia → TripIntent hợp lệ |
| **D** | `/api/recommend` wire C+B + scorer top-3 + handoff URL builder | Curl brief → 3 cards; UI A trỏ thật được |

### Day 2

| Person | Focus |
|--------|--------|
| **A** | Handoff screen, save CTA, illustrative alert, polish, EN copy |
| **B** | Promo/lotusmiles fields, getting-around final, confirmed vs illustrative labels |
| **C** | Quiz path, confidence/missingFields, harden prompt, cache |
| **D** | `/api/trips/save`, error 503 fallback, `/dev/scoring`, README integration |

### Ráp cuối (1–2h cả team)

1. A tắt mock → trỏ API D  
2. Chạy 3 scenario: leisure (Olivia), VFR, student  
3. Checklist validation metrics (proposal §Validation metrics)

---

## 9. Checklist “ráp vào là chạy”

- [ ] `shared/types.ts` identical trên mọi máy  
- [ ] B: `datasetVersion` khớp `RankedResponse.meta.datasetVersion`  
- [ ] C: mọi success path trả đủ field required của `TripIntent`  
- [ ] D: `cards.length === min(3, n)` và nếu `< 3` thì có `meta.disclaimer`  
- [ ] A: không đọc field ngoài type; không parse LLM ở client  
- [ ] Mọi illustrative route có Badge + không claim giá live  
- [ ] Handoff URL chỉ pre-fill origin/destination/dates/adults — không fake payment  
- [ ] `returnDate` luôn có mặt và = f(dateWindow.start, tripDurationDays)  
- [ ] Đổi preset trên UI dùng `cachedIntent` (không double-bill LLM)

---

## 10. Phân công tên (điền trước khi code)

| Role | Tên | Git path chính | Contact |
|------|-----|----------------|---------|
| **A — UI** | *(bạn)* | `apps/web/**` | |
| **B — Dataset** | | `data/**` | |
| **C — Intent AI** | | `apps/api/intent/**` | |
| **D — Engine & API** | | `apps/api/**`, `shared/**` | |

> **Lưu ý tải:** D là critical path (types + API + scorer + handoff). Nếu D nghẽn: C nhận thêm `buildOutline()`; B nhận thêm fixture `expectedTop3.json` sớm giờ 2.

---

## 11. Định nghĩa “xong” từng người (Definition of Done)

**A:** Demo click-through Brief → 3 cards → mở handoff URL; mock và live mode đều chạy.  
**B:** 9 routes review được (đủ `indicativeFareBand` + `bestMonths`); mỗi claim trên card map được về 1 field trong JSON.  
**C:** 5–8 briefs test ≥90% parse; quiz path không cần LLM vẫn ra intent; có case `goal=choose_route`.  
**D:** Một lệnh `curl` ra `RankedResponse` hợp lệ; README ghi env + cách nối UI; reasons grounded (RAG-lite).

---

## 12. Review log (đã kiểm vs proposal)

| # | Vấn đề tìm thấy | Mức | Cách chốt trong doc |
|---|-----------------|-----|---------------------|
| 1 | `IntentParseResult` viết kiểu `interface` + union → TS invalid | Critical | Đổi thành `type` union |
| 2 | `budgetFit` / `dateFit` không có field dataset để chấm | Critical | Thêm `indicativeFareBand`, `bestMonths` |
| 3 | Proposal RAG cards nhưng chưa ai own | High | §4.1 RAG-lite templates, owner D |
| 4 | Thiếu pilot “known destination / choose route” | High | `goal` + `preferredDestination` trên intent |
| 5 | `returnDate` optional / không có công thức | High | Bắt buộc; = start + tripDurationDays |
| 6 | “Luôn 3 cards” vs “được <3” mâu thuẫn | Medium | `min(3, n)` + disclaimer |
| 7 | `GET /api/routes` owner B hay D mơ hồ | Medium | D đọc file; B chỉ data |
| 8 | `priorityOverride` chưa nói re-fetch | Medium | `cachedIntent` + re-rank |
| 9 | State machine chữ ≠ `UIState` | Low | Chuẩn hoá step × status |
| 10 | API key ghi C/D lệch với “chỉ C gọi LLM” | Low | Key chỉ service C |
| 11 | Thiếu `ApiError` shared | Low | Thêm interface |
| 12 | `travellers` → `adults` im lặng | Low | Map 1-1, ghi chú MVP |

**Verdict:** Doc **đủ dùng để chia việc** sau các chốt trên. Chưa thay proposal; chỉ làm rõ connector để 16h ráp được.

---

*Tài liệu này căn theo proposal Veya (UAVS Hackathon 2026 Round 1). Mọi thay đổi scope MVP phải cập nhật section 3–4 trước khi code.*
