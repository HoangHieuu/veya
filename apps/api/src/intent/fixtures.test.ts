import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { RecommendRequest, TripIntent } from "../../../../shared/types.js";
import { parseBriefHeuristic } from "./briefHeuristic.js";
import { mapQuizToTripIntent } from "./quizMapper.js";

const FIXTURES_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures",
);
const FIXED_NOW = new Date("2026-09-11T00:00:00.000Z");

interface FixtureFile {
  request: RecommendRequest;
  expectedIntent: TripIntent;
}

function loadFixtures(subdir: string): Array<{ name: string; data: FixtureFile }> {
  const dir = join(FIXTURES_ROOT, subdir);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => ({
      name,
      data: JSON.parse(readFileSync(join(dir, name), "utf8")) as FixtureFile,
    }));
}

function assertCoreIntent(actual: TripIntent, expected: TripIntent) {
  assert.equal(actual.originCity, expected.originCity);
  assert.deepEqual(actual.travelStyles, expected.travelStyles);
  assert.equal(actual.budgetBand, expected.budgetBand);
  assert.equal(actual.travellers, expected.travellers);
  assert.equal(actual.priority, expected.priority);
  assert.equal(actual.tripDurationDays, expected.tripDurationDays);
  assert.equal(actual.goal, expected.goal);
  assert.equal(actual.preferredDestination, expected.preferredDestination);
  assert.equal(actual.constraints.maxStops, expected.constraints.maxStops);
  assert.deepEqual(actual.dateWindow, expected.dateWindow);
  assert.equal(actual.parseConfidence, expected.parseConfidence);
  assert.deepEqual(actual.missingFields, expected.missingFields);
}

describe("fixtures golden files", () => {
  for (const { name, data } of loadFixtures("briefs")) {
    it(`brief fixture ${name} matches heuristic at fixed now`, () => {
      assert.equal(data.request.mode, "brief");
      const { intent } = parseBriefHeuristic(data.request.briefText ?? "", {
        now: FIXED_NOW,
        originCity: data.request.originCity,
        priorityOverride: data.request.priorityOverride,
      });
      assertCoreIntent(intent, data.expectedIntent);
    });
  }

  for (const { name, data } of loadFixtures("quizzes")) {
    it(`quiz fixture ${name} matches mapper at fixed now`, () => {
      assert.equal(data.request.mode, "quiz");
      assert.ok(data.request.quiz);
      const intent = mapQuizToTripIntent(data.request.quiz!, {
        now: FIXED_NOW,
        priorityOverride: data.request.priorityOverride,
      });
      assertCoreIntent(intent, data.expectedIntent);
    });
  }
});
