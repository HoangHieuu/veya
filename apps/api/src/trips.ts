import type {
  SaveTripRequest,
  SaveTripResponse,
  TripIntent,
} from "../../../shared/types.js";

interface SavedTrip extends SaveTripRequest {
  savedAt: string;
}

export class InMemoryTripStore {
  private readonly trips = new Map<string, SavedTrip>();

  constructor(private readonly limit = 1000) {}

  save(
    request: SaveTripRequest,
    savedAt: string,
    saveId: string,
  ): SaveTripResponse {
    if (this.trips.size >= this.limit) {
      const oldest = this.trips.keys().next().value;
      if (oldest) this.trips.delete(oldest);
    }

    this.trips.set(saveId, {
      ...structuredClone(request),
      savedAt,
    });

    return {
      saveId,
      remindAfterHours: 24,
      status: "saved",
    };
  }

  get(saveId: string): SavedTrip | undefined {
    const trip = this.trips.get(saveId);
    return trip ? structuredClone(trip) : undefined;
  }

  get size() {
    return this.trips.size;
  }
}

export function cloneIntent(intent: TripIntent): TripIntent {
  return structuredClone(intent);
}
