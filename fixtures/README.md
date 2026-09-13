# Intent fixtures (Person C)

Sample briefs and quizzes paired with expected `TripIntent` outputs.

## Layout

```
fixtures/
├── briefs/
│   ├── olivia.json              # Phase 1 leisure
│   ├── vfr.json                 # Phase 1 VFR / Hanoi
│   ├── student.json             # Phase 1 budget (James)
│   ├── nguyens-discovery.json   # Cà Mau → discovery
│   ├── olivia-discovery.json    # Hanoi or Saigon → discovery
│   └── james-route-known.json   # SYD→SGN fixed → route_known
└── quizzes/
    ├── olivia-quiz.json
    ├── vfr-quiz.json
    └── student-quiz.json
```

Each file shape:

```json
{
  "request": { "mode": "brief|quiz", "...": "..." },
  "expectedIntent": { "...TripIntent...": "..." },
  "expectedDiscoveryMode": "discovery|route_known",
  "notes": "optional"
}
```

`expectedDiscoveryMode` is optional — golden `fixtures.test.ts` ignores unknown keys; `discoveryMode.test.ts` asserts it.

Quiz date windows assume fixed `now = 2026-09-11T00:00:00.000Z`.

Target: ≥90% parse on 5–8 briefs (see `apps/api/src/intent/briefHeuristic.test.ts`).

Do not put route data here — that lives in `data/`.
