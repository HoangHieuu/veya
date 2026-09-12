# Intent fixtures (Person C)

Sample briefs and quizzes for unit tests and Postman. Pair each input with an expected `TripIntent` JSON.

## Layout

```
fixtures/
├── briefs/
│   ├── olivia.json
│   ├── vfr.json
│   └── student.json
└── quizzes/
    └── *.json
```

Target: ≥90% parse accuracy on 5–8 briefs (see docs/WORK_SPLIT.md §6.3).

Do not put route data here — that lives in [`data/`](../data/).
