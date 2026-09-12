import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QuizAnswers } from "../../../../shared/types.js";
import { daysBetweenUtc } from "./dateWindow.js";
import { parseTripIntent } from "./parseTripIntent.js";
import { mapQuizToTripIntent } from "./quizMapper.js";

const FIXED_NOW = new Date("2026-09-11T00:00:00.000Z");

const oliviaQuiz: QuizAnswers = {
  travelStyle: "beach_relaxation",
  dateFlexibility: "flexible_±3",
  budgetBand: "standard",
  travellers: 2,
  priority: "lowest_hassle",
  originCity: "SYD",
};

const vfrQuiz: QuizAnswers = {
  travelStyle: "vfr",
  dateFlexibility: "flexible_±3",
  budgetBand: "standard",
  travellers: 4,
  priority: "best_for_family",
  originCity: "MEL",
  departAfter: "2026-10-01",
  departBefore: "2026-10-08",
};

const studentQuiz: QuizAnswers = {
  travelStyle: "food_culture",
  dateFlexibility: "flexible_month",
  budgetBand: "budget",
  travellers: 1,
  priority: "food_and_culture",
  originCity: "PER",
};

describe("mapQuizToTripIntent", () => {
  it("maps Olivia-style quiz with companion styles and maxStops 1", () => {
    const intent = mapQuizToTripIntent(oliviaQuiz, { now: FIXED_NOW });
    assert.deepEqual(intent.travelStyles, [
      "beach_relaxation",
      "food_culture",
    ]);
    assert.equal(intent.constraints.maxStops, 1);
    assert.equal(intent.tripDurationDays, 7);
    assert.equal(intent.dateWindow.start, "2026-09-11");
    assert.equal(intent.dateWindow.end, "2026-09-18");
    assert.equal(intent.dateWindow.flexibility, "flexible_±3");
    assert.equal(
      daysBetweenUtc(intent.dateWindow.start, intent.dateWindow.end),
      intent.tripDurationDays,
    );
    assert.deepEqual(intent.missingFields, ["departAfter", "departBefore"]);
    assert.equal(intent.parseConfidence, 1);
  });

  it("uses depart window span for tripDurationDays", () => {
    const intent = mapQuizToTripIntent(vfrQuiz, { now: FIXED_NOW });
    assert.equal(intent.originCity, "MEL");
    assert.equal(intent.tripDurationDays, 7);
    assert.equal(intent.dateWindow.start, "2026-10-01");
    assert.equal(intent.dateWindow.end, "2026-10-08");
    assert.deepEqual(intent.travelStyles, ["vfr", "family"]);
    assert.equal(intent.constraints.maxStops, 1);
    assert.deepEqual(intent.missingFields, []);
  });

  it("maps student quiz with maxStops 2 and flexible_month", () => {
    const intent = mapQuizToTripIntent(studentQuiz, { now: FIXED_NOW });
    assert.equal(intent.originCity, "PER");
    assert.deepEqual(intent.travelStyles, ["food_culture"]);
    assert.equal(intent.constraints.maxStops, 2);
    assert.equal(intent.dateWindow.flexibility, "flexible_month");
    assert.equal(intent.budgetBand, "budget");
  });

  it("honours priorityOverride for priority and maxStops", () => {
    const intent = mapQuizToTripIntent(studentQuiz, {
      now: FIXED_NOW,
      priorityOverride: "lowest_hassle",
    });
    assert.equal(intent.priority, "lowest_hassle");
    assert.equal(intent.constraints.maxStops, 1);
  });

  it("back-calculates start when only departBefore is set", () => {
    const intent = mapQuizToTripIntent(
      {
        ...studentQuiz,
        departBefore: "2026-10-20",
      },
      { now: FIXED_NOW },
    );
    assert.equal(intent.dateWindow.end, "2026-10-20");
    assert.equal(intent.dateWindow.start, "2026-10-13");
    assert.ok(intent.missingFields.includes("departAfter"));
    assert.ok(!intent.missingFields.includes("departBefore"));
  });

  it("ignores invalid departAfter without throwing", () => {
    const intent = mapQuizToTripIntent(
      {
        ...oliviaQuiz,
        departAfter: "TBD",
      },
      { now: FIXED_NOW },
    );
    assert.equal(intent.dateWindow.start, "2026-09-11");
    assert.ok(intent.missingFields.includes("departAfter"));
  });

  it("marks inverted depart window as missing dates", () => {
    const intent = mapQuizToTripIntent(
      {
        ...vfrQuiz,
        departAfter: "2026-10-20",
        departBefore: "2026-10-01",
      },
      { now: FIXED_NOW },
    );
    assert.equal(intent.tripDurationDays, 7);
    assert.ok(intent.missingFields.includes("departAfter"));
    assert.ok(intent.missingFields.includes("departBefore"));
  });
});

describe("parseTripIntent quiz path", () => {
  it("returns validated intent for quiz mode", async () => {
    const result = await parseTripIntent({
      mode: "quiz",
      quiz: oliviaQuiz,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.originCity, "SYD");
      assert.equal(result.intent.dateWindow.flexibility, "flexible_±3");
    }
  });

  it("returns EMPTY_INPUT when quiz is missing", async () => {
    const result = await parseTripIntent({ mode: "quiz" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errorCode, "EMPTY_INPUT");
    }
  });

  it("round-trips flexible_±3 literal through JSON fixtures", async () => {
    const payload = JSON.parse(
      JSON.stringify({
        mode: "quiz",
        quiz: oliviaQuiz,
      }),
    );
    assert.equal(payload.quiz.dateFlexibility, "flexible_±3");
    const result = await parseTripIntent(payload);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.dateWindow.flexibility, "flexible_±3");
    }
  });
});
