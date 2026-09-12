# Dataset (Person B)

Curated route records for scoring. **Person D** loads these files at runtime — B does not host an API.

## Layout

```
data/
├── version.json          { "datasetVersion": "0.1.0", "updatedAt": "..." }
├── routes/
│   ├── SYD-HAN.json      one RouteRecord per file
│   ├── SYD-SGN.json
│   └── …                 minimum 9: 3 origins × 3 destinations
├── promotions/           optional, referenced by route id
├── assets/meta.json      archetype → image path + license
└── fixtures/
    ├── sampleIntent.json
    └── expectedTop3.json scorer smoke test for D
```

## Schema

Each route file must match `RouteRecord` in [`shared/types.ts`](../shared/types.ts).

Required for MVP: `indicativeFareBand`, `bestMonths`, `gettingAround`, `dataConfidence`, `backgroundImage.licenseNote`.

## Versioning

When you change routes, bump `datasetVersion` in `version.json`. D must echo the same value in `RankedResponse.meta.datasetVersion`.
