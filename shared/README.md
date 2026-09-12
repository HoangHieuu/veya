# Shared types

**Person D** owns this folder. Everyone imports from here — do not redefine types in `apps/web` or `apps/api`.

## Usage

```ts
// apps/web (Vite alias @shared)
import type { RankedResponse } from "@shared/types";

// apps/api
import type { TripIntent } from "../../../shared/types";
```

## Changing the contract

1. Propose change in PR with description of impact on A/B/C/D.
2. Get ack from all roles (or merge in a pairing session).
3. Update mocks/fixtures in the same PR when fields are required.

See [docs/WORK_SPLIT.md](../docs/WORK_SPLIT.md) §2 for the full schema reference.
