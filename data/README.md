# Dataset (Person B)

Curated route records for scoring. **Person D** loads these files at runtime — B does not host an API.

## Layout

```
data/
├── version.json          { "datasetVersion": "0.1.0", "updatedAt": "..." }
├── routes/               9 files, one RouteRecord each: 3 origins × 3 gateways
│   ├── SYD-HAN.json
│   └── …
├── promotions/           empty — promotions are inline on each RouteRecord
├── assets/
│   ├── *.jpg             one hero image per gateway (1920px)
│   └── meta.json         every image → source, owner, licence, attribution line
├── fixtures/
│   ├── sampleIntent.json a TripIntent for D's scorer tests
│   └── expectedTop3.json the ranking that intent must produce
└── tools/
    └── validate-dataset.mts  pre-merge gate
```

## Schema

Each route file must match `RouteRecord` in [`shared/types.ts`](../shared/types.ts). Nothing here
duplicates that contract.

## Versioning

When you change routes or assets, bump `datasetVersion` in `version.json` and regenerate
`fixtures/expectedTop3.json` in the same commit. D must echo the same value in
`RankedResponse.meta.datasetVersion`.

## Topology, and why

Derived from the Lotusmiles published sector table, which lists only sectors Vietnam Airlines
actually operates. The Australia sectors present are SYD–HAN, SYD–SGN, MEL–HAN, MEL–SGN and
PER–SGN. There is no Australia–Da Nang sector, and no PER–HAN or PER–DAD. The VNA Melbourne to Da
Nang page says so in words: *"nonstop flights are not available… connecting options, often via
major transit hubs in Hanoi or Ho Chi Minh City."*

| | HAN | SGN | DAD |
|---|---|---|---|
| **SYD** | direct | direct | one stop via SGN |
| **MEL** | direct | direct | one stop via SGN |
| **PER** | one stop via SGN | direct | one stop via SGN |

Every origin therefore has three routes at one stop or fewer, so all three return three cards for
every priority preset. `maxStops: 0` only fires on a literal "direct only" brief, so the candidate
filter needs no special case to keep the card list full.

## Field provenance

| Field | Basis |
|---|---|
| `connectionType`, `viaHub` | Lotusmiles sector table plus VNA route-page wording |
| `typicalDurationHours` | VNA route pages for SYD-SGN, MEL-HAN, MEL-SGN, MEL-DAD and PER-SGN. **Derived** for SYD-HAN, SYD-DAD, PER-HAN and PER-DAD — VNA publishes no figure for those, and each record says so in `sourceDocument`. |
| `indicativeFareBand` | Tercile of a nine-route AUD snapshot captured 2026-09-12 from the VNA `/en-au` route pages. **Relative within this curated set, not a live price.** |
| `lotusmilesIndicative` | Lotusmiles published sector distances. `low`/`mid`/`high` is a **Veya internal signal, not a Lotusmiles tier**; accrual depends on booking class, so the note never promises a mileage figure. |
| `promotion` | LotuStudents, verified on both the `/au/en/` and `/in/en/` pages. Tier 1 (20% off Economy Lite, ticketing to 2026-10-31) on the five direct AU→HAN/SGN routes; tier 2 (10% off, to 2026-12-31) on the four connecting routes, since tier 1 excludes multi-segment itineraries. |
| `bestMonths`, `shoulderMonths`, `seasonalityNotes`, `gettingAround` | Regional climate and airport-transfer facts, not VNA claims. |

`dataConfidence` is `illustrative` on all nine: confirming schedules with Vietnam Airlines is still
an open question in the proposal, so nothing here claims to be confirmed.

## Scorer fixtures

`expectedTop3.json` covers three personas, each embedding its own intent so D needs no second file.
Every case was produced by POSTing that intent to a working `/api/recommend` as `cachedIntent`,
against scoring engine 0.1.0 and this exact dataset — nothing is hand-written.

| Persona | Intent | Cards | Result |
|---|---|---|---|
| `olivia` | mirrors `fixtures/sampleIntent.json` | 3 | SYD-HAN 81.5, SYD-SGN 81.3, SYD-DAD 74.5 |
| `student` | budget solo food trip from Perth | 3 | PER-SGN 90.8, PER-DAD 86.3, PER-HAN 85.8 |
| `vfr` | family of four visiting Hanoi | **1** | MEL-HAN 83 |

The VFR case returning one card is **correct, not a bug**: `goal: "choose_route"` with
`preferredDestination: "HAN"` filters to that destination. `meta.disclaimer` should explain the
short list rather than stay silent.

## Known consequences, deliberately not tuned away

- **Olivia ranks Hanoi first and Da Nang third.** She wants beach and food in mid-November, and
  November is Da Nang's wet season, so `dateFit` scores 40 there despite a perfect `intentMatch`
  of 100. The dataset is not bent to make a particular gateway win.
- **`promotionBoost` does not discriminate.** All nine routes carry a real, in-date LotuStudents
  tier, and a binary in-date check scores every one of them 100. The factor is accurate but
  contributes nothing to ranking — a scoring-engine question, not a dataset one.

## Imagery

Three gateway hero images at 1920px, sourced from Wikimedia Commons because its API returns the
author, licence name and licence URL as structured data — so `meta.json` is generated from the API
response rather than retyped.

| File | Gateway | Licence | Author | Attribution |
|---|---|---|---|---|
| `saigon-food.jpg` | SGN | **CC0 1.0** | Hiep Nguyen | not required |
| `hanoi-food.jpg` | HAN | CC BY 4.0 | Jakub Hałun | **required** |
| `da-nang-beach.jpg` | DAD | CC BY 2.0 | . Ray in Manila | **required** |

**Two things the web app must do:**

1. **Serve the files.** Route records reference `/assets/<file>.jpg`, but the files live in
   `data/assets/`. Serve `data/assets` at `/assets`, or copy it into `apps/web/public/assets` at
   build time — otherwise every card shows a broken image.
2. **Show the attribution.** The two CC BY photos require a visible credit wherever they appear.
   `meta.json` supplies the exact line to render.

## Validating before merge

```bash
cd apps/api && npm ci                                       # once: provides tsx
apps/api/node_modules/.bin/tsx data/tools/validate-dataset.mts
```

The gate runs in two modes and prints which one it used:

- **full** — once `apps/api/src/validation.ts` exists, the gate imports Person D's real
  `routeRecordSchema` and validates every record against it, so it cannot drift from what the API
  enforces at runtime.
- **shallow** — until then, structural checks only. It does **not** restate the schema here, so
  there is never a second source of truth to keep in sync.

In both modes it checks what a schema cannot:

- **`maxStops` is a hard filter, not a penalty.** The recommendation endpoint drops any route with
  more stops than the intent allows, so each origin needs three routes within the cap to fill three
  cards. A shortfall at `maxStops: 0` is only a warning — a "direct only" brief genuinely has fewer
  options.
- **A constant field is a dead scoring factor.** If all nine routes share one
  `indicativeFareBand`, `budgetFit` returns the same number for every one of them and stops ranking
  anything. Same for an all-`null` `promotion` or `lotusmilesIndicative`.
- **Every `backgroundImage` has a committed file and a licence note.**
- **`expectedTop3.json` matches the current `datasetVersion`**, so a stale lock cannot pass.

A dataset loader that silently skips a malformed route file turns a broken record into a missing
card rather than an error, which is why this gate exists at all.
