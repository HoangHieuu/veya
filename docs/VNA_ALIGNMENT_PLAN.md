# VNA alignment plan — Veya

> **Source:** VNA Problem Statement (UAVS 2026) — *Winning Back the Click: Driving Travellers to Our Direct Channels*  
> **Repo:** https://github.com/HoangHieuu/veya  
> **Related:** [TDD.md](./TDD.md) · [TDD-v2.md](./TDD-v2.md) · [WORK_SPLIT.md](./WORK_SPLIT.md) · [STRUCTURE.md](./STRUCTURE.md)

Product strategy: how Veya maps to the official VNA brief. Scope and contracts live in the TDD / WORK_SPLIT docs.

---

## What VNA is asking for

**Core challenge:** Merchant-side solution so **vietnamairlines.com + app** beat OTAs on **relevance, trust, and reward** — not just price.

**Evaluation priorities (VNA doc, in order):**

1. Conversion impact — browser/OTA → complete booking on direct channel  
2. Personalisation intelligence — loyalty context, offers OTAs cannot match  
3. Technical viability — APIs, data, LLM where appropriate, **RAG grounded** (no invented policy/fare)  
4. Business value — distribution cost savings, ancillary upsell, loyalty enrollment  

**In scope:** personalisation, Lotusmiles, conversion assist, budget/inspiration discovery, direct-value messaging, agent surfaces (MCP optional).  
**Out of scope:** live PSS/GDS, real payment/ticket issuance, consumer OTA, pure price war.

---

## How Veya maps (primary + secondary story)

| VNA illustrative direction | Veya fit | Role in pitch |
|----------------------------|----------|---------------|
| **#3 “Where Can I Go?” inspiration recommender** | AU origins → HAN/SGN/DAD + vibe + budget band + agent board | **PRIMARY** |
| **#4 Direct channel value proof** | Direct vs OTA value card on results/handoff | **SECONDARY** |
| **#1 Personalised booking concierge** | Wizard + brief LLM + agent bubble (not full chat) | Supporting |
| **#2 Cart abandonment** | Session context story | Roadmap slide only |
| **#5 MCP server** | Routes + handoff as tools | Architecture slide only |

**One-liner for judges:**

> **Veya** is VNA’s **Direct Discovery Concierge**: intercept travellers before they open an OTA, recommend the right Vietnam **gateway** for their trip, and hand off to **vietnamairlines.com** with context — plus clear **why book direct** (Lotusmiles, ancillaries, relationship).

---

## Product gaps to close (vs VNA story)

| Gap | Target |
|-----|--------|
| Narrative | Hero / home copy framed as **Winning Back the Click** / OTA loss moment |
| Lotusmiles | Badges + value card + demo `maximise_miles` re-rank |
| Direct value proof | **DirectBookingValueCard** (direct vs OTA comparison, illustrative) |
| Conversion story | Demo script: OTA moment → VNA prefill |
| RAG / explainability | Grounded reasons from `RouteRecord` + optional `/dev/scoring` in demo |

---

## Implementation plan (priority order)

### P0 — Narrative & copy (**Person A**)

- Home hero: eyebrow *“Vietnam Airlines · Direct channel”*; gateway discovery on VNA  
- Home block: *“The moment we lose you to an OTA”* (wrong gateway / no miles / no ancillaries)  
- FAQ: *“Why not use an OTA?”*  
- Wizard step copy: emphasise **book direct on vietnamairlines.com**

### P0 — Direct channel value proof (**A** + fields from **B**)

- Component **`DirectBookingValueCard`** on Results + Handoff  
- Content from `route.lotusmilesIndicative`, `route.promotion`; Direct vs OTA (illustrative + disclaimer)

### P0 — Surface loyalty in UX (**A**)

- Badge when `earnBand === "high"` or priority `maximise_miles`  
- Demo: switch priority → Maximise miles → re-rank via `cachedIntent` (no LLM)  
- Agent bubble miles note (template copy only)

### P1 — Agent board as concierge (**A**)

- Agent intro: gateway + experience + book-direct benefit  
- Optional chip: **Member perks**

### P1 — Persona / demo (**A** + **All**)

- Lotusmiles member path (demo toggle, no real login)  
- Rehearse **3 min demo** mapped to VNA’s 4 evaluation priorities

### P1 — Live E2E (**A**)

- `VITE_USE_MOCK=false` against live `POST /api/recommend`  
- Verify Olivia / VFR / James paths

### P2 — Slides only (no code required)

- MCP roadmap (routes + handoff as tools)  
- Cart-abandonment Phase 2 with session context  
- Proxy metrics: handoff CTR, direct search starts

### Do not build

- Consumer OTA, live GDS, real payment, full chatbot replacing wizard, price-undercutting

---

## Dataset fields that support this story (**Person B**)

Required on routes for loyalty / trust narrative:

- `lotusmilesIndicative` (earn band + note)  
- `promotion` where applicable (e.g. LotuStudents)  
- `sourceDocument` / `dataConfidence` for RAG/trust copy  
- Licensed `backgroundImage` metadata  

See [WORK_SPLIT.md](./WORK_SPLIT.md) §5 and [STRUCTURE.md](./STRUCTURE.md) for `data/` ownership.

---

## Demo script outline (3 min)

1. **Problem (15s):** OTAs win the click; travellers don’t know HAN vs SGN vs DAD.  
2. **Olivia (45s):** persona → Results → gateway pills → experience highlights.  
3. **Personalisation (30s):** priority **Maximise miles** → re-rank; Lotusmiles badge.  
4. **Direct value (30s):** DirectBookingValueCard → Handoff prefill.  
5. **Tech (30s):** quiz no LLM; optional brief; `/dev/scoring`; RAG from `RouteRecord`.  
6. **Close (20s):** distribution, loyalty, ancillaries; partnership with VNA AU.

Round 2 agent-canvas demo variants: see [TDD-v2.md](./TDD-v2.md) Appendix D and [TDD-v2-3panel.md](./TDD-v2-3panel.md) §XIV.

---

## TEKO rubric quick map

| Criteria | Evidence |
|----------|----------|
| UX (20) | Personas, 3-step wizard, agent board, consistent route cards |
| Technical (25) | Monorepo, one-command dev, C+D+B path, mock fallback |
| Deploy & scale (20) | Stateless API, versioned JSON dataset, no PSS in MVP |
| Market (25) | Direct channel vs OTA, AU→VN segment, VNA partnership GTM |
| Adaptation (10) | Official problem statement + agent board + handoff |

---

## Team ownership (summary)

| Role | Alignment work |
|------|----------------|
| **A** | Narrative, DirectBookingValueCard, miles UI, demo polish |
| **B** | Loyalty / promo / confidence fields on routes |
| **C** | Intent parse (quiz + brief); Round 2 `discoveryMode` when agent canvas ships |
| **D** | Recommend orchestration, scoring, handoff, `/dev/scoring` |
| **All** | Rehearse demo in VNA evaluation order |

Full contracts: [WORK_SPLIT.md](./WORK_SPLIT.md). Full MVP plan: [TDD.md](./TDD.md). Agent canvas: [TDD-v2.md](./TDD-v2.md).
