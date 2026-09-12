# Intent fixtures (Person C)

Sample briefs and quizzes paired with expected `TripIntent` outputs.

## Layout

```
fixtures/
├── briefs/
│   ├── olivia.json
│   ├── vfr.json
│   └── student.json
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
  "notes": "optional"
}
```

Quiz date windows assume fixed `now = 2026-09-11T00:00:00.000Z`.

Target: ≥90% parse on 5–8 briefs (see `apps/api/src/intent/briefHeuristic.test.ts`).

Do not put route data here — that lives in `data/`.
