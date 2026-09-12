# AI / agent context

When assisting on this repo, **read first:**

1. **[docs/TDD.md](./docs/TDD.md)** — scope, frozen flows, out-of-scope list
2. **[docs/STRUCTURE.md](./docs/STRUCTURE.md)** — folder ownership
3. **[docs/WORK_SPLIT.md](./docs/WORK_SPLIT.md)** — API & type contracts

## Hard rules

- Edit **only** the folder for the developer's role (see TDD §0).
- **Do not** add features listed in TDD §4 (Out of scope).
- **Do not** change `shared/types.ts` without an explicit contract-change request.
- **Do not** duplicate types outside `shared/types.ts`.
- Prefer extending existing files over new parallel implementations.

## Role → path

| Role | Path |
|------|------|
| A (UI) | `apps/web/` |
| B (Data) | `data/` |
| C (Intent) | `apps/api/src/intent/`, `fixtures/` |
| D (API) | `apps/api/`, `shared/` |
