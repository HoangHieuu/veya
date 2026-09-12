import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TripIntent } from "../../../../shared/types.js";
import { tripIntentSchema, validateTripIntent } from "./schema.js";

/** Snapshot of apps/web mock Olivia intent — kept local to avoid depending on Person A paths. */
const oliviaIntent: TripIntent = {
  originCity: "SYD",
  travelStyles: ["beach_relaxation", "food_culture"],
  budgetBand: "standard",
  travellers: 2,
  priority: "lowest_hassle",
  dateWindow: {
    start: "2026-11-10",
    end: "2026-11-19",
    flexibility: "flexible_±3",
  },
  tripDurationDays: 9,
  goal: "discover_destination",
  constraints: {
    maxStops: 1,
  },
  rawSummary:
    "Beach-and-food trip from Sydney for two friends in mid-November, preferring few connections.",
  parseConfidence: 0.92,
  missingFields: [],
};

describe("tripIntentSchema", () => {
  it("accepts the Olivia mock intent", () => {
    const result = validateTripIntent(oliviaIntent);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.originCity, "SYD");
      assert.equal(result.intent.dateWindow.flexibility, "flexible_±3");
      assert.equal(result.intent.tripDurationDays, 9);
    }
  });

  it("rejects empty travelStyles", () => {
    const result = tripIntentSchema.safeParse({
      ...oliviaIntent,
      travelStyles: [],
    });
    assert.equal(result.success, false);
  });

  it("rejects more than 3 travelStyles", () => {
    const result = tripIntentSchema.safeParse({
      ...oliviaIntent,
      travelStyles: [
        "beach_relaxation",
        "food_culture",
        "education",
        "family",
      ],
    });
    assert.equal(result.success, false);
  });

  it("rejects destination outside HAN/SGN/DAD", () => {
    const result = tripIntentSchema.safeParse({
      ...oliviaIntent,
      preferredDestination: "CXR",
    });
    assert.equal(result.success, false);
  });

  it("rejects parseConfidence above 1", () => {
    const result = tripIntentSchema.safeParse({
      ...oliviaIntent,
      parseConfidence: 1.2,
    });
    assert.equal(result.success, false);
  });
});
