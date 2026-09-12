import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTripIntent } from "./parseTripIntent.js";

describe("parseTripIntent hardening", () => {
  it("returns UNPARSEABLE for gibberish brief", async () => {
    const result = await parseTripIntent({
      mode: "brief",
      briefText: "asdf qwer zxcv",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errorCode, "UNPARSEABLE");
    }
  });

  it("returns VALIDATION_FAILED for unsupported mode", async () => {
    const result = await parseTripIntent({
      mode: "chat" as "brief",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errorCode, "VALIDATION_FAILED");
    }
  });

  it("clamps travellers to at least 1 via quiz validation path", async () => {
    const result = await parseTripIntent({
      mode: "quiz",
      quiz: {
        travelStyle: "mixed",
        dateFlexibility: "fixed",
        budgetBand: "standard",
        travellers: 0,
        priority: "lowest_hassle",
        originCity: "SYD",
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errorCode, "VALIDATION_FAILED");
    }
  });

  it("honours priorityOverride on brief path", async () => {
    const result = await parseTripIntent({
      mode: "brief",
      briefText:
        "Trip from Sydney (SYD). 2 adults. 7 days beach trip. Budget band: Standard. Priority: Lowest hassle.",
      priorityOverride: "maximise_miles",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.priority, "maximise_miles");
      assert.equal(result.intent.constraints.maxStops, 2);
    }
  });

  it("does not throw on invalid calendar date in brief", async () => {
    const result = await parseTripIntent({
      mode: "brief",
      briefText:
        "From Sydney 2 adults beach trip on 2026-13-40, 7 days, Budget band: Standard.",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.originCity, "SYD");
      assert.ok(result.intent.missingFields.includes("dateWindow.start"));
    }
  });

  it("returns VALIDATION_FAILED for malformed quiz instead of throwing", async () => {
    const result = await parseTripIntent({
      mode: "quiz",
      quiz: { originCity: "SYD" } as never,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errorCode, "VALIDATION_FAILED");
    }
  });

  it("rejects invalid originCity on request gate", async () => {
    const result = await parseTripIntent({
      mode: "brief",
      originCity: "BNE" as "SYD",
      briefText:
        "From Brisbane 2 adults beach trip, 7 days, Budget band: Standard.",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errorCode, "VALIDATION_FAILED");
    }
  });

  it("uses injected now for quiz dateWindow", async () => {
    const result = await parseTripIntent(
      {
        mode: "quiz",
        quiz: {
          travelStyle: "beach_relaxation",
          dateFlexibility: "flexible_±3",
          budgetBand: "standard",
          travellers: 2,
          priority: "lowest_hassle",
          originCity: "SYD",
        },
      },
      { now: new Date("2026-09-11T00:00:00.000Z") },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.dateWindow.start, "2026-09-11");
      assert.equal(result.intent.dateWindow.end, "2026-09-18");
    }
  });

  it("does not treat distance miles as maximise_miles", async () => {
    const result = await parseTripIntent({
      mode: "brief",
      briefText:
        "Trip from Sydney (SYD). 2 adults. 7 days beach trip. Budget band: Standard. Priority: Lowest hassle. We are 200 miles from the airport.",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.priority, "lowest_hassle");
      assert.notEqual(result.intent.priority, "maximise_miles");
    }
  });

  it("does not treat bare culture as food_culture style", async () => {
    const result = await parseTripIntent({
      mode: "brief",
      briefText:
        "Trip from Perth (PER). 1 adult. Long weekend. Local culture museums. Budget band: Budget. Priority: Lowest hassle.",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(!result.intent.travelStyles.includes("food_culture"));
    }
  });

  it("rejects thin Sydney beach brief as UNPARSEABLE", async () => {
    const result = await parseTripIntent({
      mode: "brief",
      briefText: "Sydney beach",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errorCode, "UNPARSEABLE");
    }
  });
});
