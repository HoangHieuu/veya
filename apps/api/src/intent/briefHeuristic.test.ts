import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBriefHeuristic } from "./briefHeuristic.js";
import { daysBetweenUtc } from "./dateWindow.js";
import { parseTripIntent } from "./parseTripIntent.js";

const FIXED_NOW = new Date("2026-09-11T00:00:00.000Z");

const OLIVIA_BRIEF =
  "Trip from Sydney (SYD). 2 adults. Dates: 8–10 days in mid-November. Trip vibe: Beach-and-food trip with a friend — low hassle, few connections. Budget band: Standard. Priority: Lowest hassle.";

const VFR_BRIEF =
  "Trip from Melbourne (MEL). 4 adults. Dates: Visiting family in Hanoi, ±3 days flexible. Trip vibe: Family visit with kids — one stop max, prefer direct if possible. Budget band: Standard. Priority: Best for family. Need stroller-friendly airports where possible.";

const STUDENT_BRIEF =
  "Trip from Perth (PER). 1 adult. Dates: Long weekend in the next month. Trip vibe: Food-focused solo trip, budget-conscious, happy with one stop. Budget band: Budget. Priority: Food and culture.";

interface CoreExpectation {
  name: string;
  brief: string;
  originCity: "SYD" | "MEL" | "PER";
  stylesInclude: string;
  travellers: number;
  durationMin: number;
  durationMax: number;
  goal: "discover_destination" | "choose_route";
  preferredDestination?: "HAN" | "SGN" | "DAD";
}

const CASES: CoreExpectation[] = [
  {
    name: "olivia",
    brief: OLIVIA_BRIEF,
    originCity: "SYD",
    stylesInclude: "beach_relaxation",
    travellers: 2,
    durationMin: 8,
    durationMax: 10,
    goal: "discover_destination",
  },
  {
    name: "vfr",
    brief: VFR_BRIEF,
    originCity: "MEL",
    stylesInclude: "vfr",
    travellers: 4,
    durationMin: 6,
    durationMax: 8,
    goal: "choose_route",
    preferredDestination: "HAN",
  },
  {
    name: "student",
    brief: STUDENT_BRIEF,
    originCity: "PER",
    stylesInclude: "food_culture",
    travellers: 1,
    durationMin: 2,
    durationMax: 4,
    goal: "discover_destination",
  },
  {
    name: "missing-origin-defaults-syd",
    brief:
      "Beach holiday for 2 adults, 7 days, budget standard, lowest hassle.",
    originCity: "SYD",
    stylesInclude: "beach_relaxation",
    travellers: 2,
    durationMin: 6,
    durationMax: 8,
    goal: "discover_destination",
  },
  {
    name: "known-danang",
    brief:
      "From Sydney, fly into Da Nang for 9 days beach and food, 2 adults, standard budget, lowest hassle.",
    originCity: "SYD",
    stylesInclude: "beach_relaxation",
    travellers: 2,
    durationMin: 8,
    durationMax: 10,
    goal: "choose_route",
    preferredDestination: "DAD",
  },
  {
    name: "phu-quoc-no-invent",
    brief:
      "From Melbourne, want Phu Quoc beaches for a week with a friend, standard budget.",
    originCity: "MEL",
    stylesInclude: "beach_relaxation",
    travellers: 2,
    durationMin: 6,
    durationMax: 8,
    goal: "discover_destination",
  },
  {
    name: "direct-only",
    brief:
      "Trip from Perth, solo, food culture, budget, direct only flights to Saigon for 5 days.",
    originCity: "PER",
    stylesInclude: "food_culture",
    travellers: 1,
    durationMin: 4,
    durationMax: 6,
    goal: "choose_route",
    preferredDestination: "SGN",
  },
  {
    name: "semi-structured-wizard",
    brief:
      "Trip from Sydney (SYD). 2 adults. Date flexibility: dates flexible within ±3 days. Travel style: Beach & relaxation. Budget band: Standard. Priority: Lowest hassle.",
    originCity: "SYD",
    stylesInclude: "beach_relaxation",
    travellers: 2,
    durationMin: 6,
    durationMax: 8,
    goal: "discover_destination",
  },
];

function corePass(caseDef: CoreExpectation): {
  pass: boolean;
  fields: Record<string, boolean>;
} {
  const { intent } = parseBriefHeuristic(caseDef.brief, { now: FIXED_NOW });
  const fields = {
    originCity: intent.originCity === caseDef.originCity,
    travelStyles: intent.travelStyles.includes(
      caseDef.stylesInclude as never,
    ),
    travellers: intent.travellers === caseDef.travellers,
    tripDurationDays:
      intent.tripDurationDays >= caseDef.durationMin &&
      intent.tripDurationDays <= caseDef.durationMax,
    goal: intent.goal === caseDef.goal,
    preferredDestination:
      (intent.preferredDestination ?? undefined) ===
      caseDef.preferredDestination,
  };
  return {
    pass: Object.values(fields).every(Boolean),
    fields,
  };
}

describe("parseBriefHeuristic accuracy", () => {
  it("reports per-brief and per-field accuracy >= 90%", () => {
    let briefPasses = 0;
    const fieldTotals: Record<string, { hit: number; total: number }> = {};

    for (const caseDef of CASES) {
      const { pass, fields } = corePass(caseDef);
      if (pass) briefPasses += 1;
      for (const [key, ok] of Object.entries(fields)) {
        fieldTotals[key] ??= { hit: 0, total: 0 };
        fieldTotals[key].total += 1;
        if (ok) fieldTotals[key].hit += 1;
      }
    }

    const perBrief = briefPasses / CASES.length;
    const fieldHits = Object.values(fieldTotals).reduce((n, v) => n + v.hit, 0);
    const fieldCount = Object.values(fieldTotals).reduce(
      (n, v) => n + v.total,
      0,
    );
    const perField = fieldHits / fieldCount;

    assert.ok(
      perBrief >= 0.9,
      `per-brief ${perBrief} (${briefPasses}/${CASES.length})`,
    );
    assert.ok(perField >= 0.9, `per-field ${perField}`);
  });

  it("Olivia: mid-November duration 9, maxStops 1, date invariant", () => {
    const { intent } = parseBriefHeuristic(OLIVIA_BRIEF, { now: FIXED_NOW });
    assert.equal(intent.tripDurationDays, 9);
    assert.equal(intent.constraints.maxStops, 1);
    assert.equal(intent.dateWindow.start, "2026-11-15");
    assert.equal(
      daysBetweenUtc(intent.dateWindow.start, intent.dateWindow.end),
      intent.tripDurationDays,
    );
  });

  it("defaults missing origin to SYD and records missingFields", () => {
    const { intent } = parseBriefHeuristic(
      "Beach holiday for 2 adults, 7 days, budget standard, lowest hassle.",
      { now: FIXED_NOW },
    );
    assert.equal(intent.originCity, "SYD");
    assert.ok(intent.missingFields.includes("originCity"));
  });

  it("sets maxStops 0 for direct only", () => {
    const { intent } = parseBriefHeuristic(
      "From Perth, solo, food culture, budget, direct only to Saigon for 5 days.",
      { now: FIXED_NOW },
    );
    assert.equal(intent.constraints.maxStops, 0);
    assert.equal(intent.preferredDestination, "SGN");
  });

  it("infers DAD from Hoi An when no airport code is named", () => {
    const { intent } = parseBriefHeuristic(
      "From Sydney, 2 adults, 9 days in November. Hoi An lanterns and beach — not Hanoi.",
      { now: FIXED_NOW },
    );
    assert.equal(intent.preferredDestination, "DAD");
    assert.equal(intent.goal, "choose_route");
  });

  it("gateway comparison leaves preferredDestination unset (Olivia 3-gateway)", () => {
    const { intent, destinationSource } = parseBriefHeuristic(
      "Trip from Sydney (SYD). 2 adults. 9 days in mid-November. Hanoi or Saigon? Beach and food trip, low hassle. Budget band: Standard. Priority: Lowest hassle.",
      { now: FIXED_NOW },
    );
    assert.equal(destinationSource, "compare");
    assert.equal(intent.goal, "discover_destination");
    assert.equal(intent.preferredDestination, undefined);
    assert.ok(!intent.missingFields.includes("preferredDestination"));
  });
});

describe("parseTripIntent brief path", () => {
  it("parses Olivia brief", async () => {
    const result = await parseTripIntent({
      mode: "brief",
      briefText: OLIVIA_BRIEF,
      originCity: "SYD",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.originCity, "SYD");
      assert.ok(result.intent.travelStyles.includes("beach_relaxation"));
    }
  });

  it("returns EMPTY_INPUT for blank brief", async () => {
    const result = await parseTripIntent({ mode: "brief", briefText: "  " });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, "EMPTY_INPUT");
  });
});
