import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { RecommendRequest, TripIntent } from "../../../../shared/types.js";
import { parseBriefHeuristic } from "./briefHeuristic.js";
import {
  classifyDiscoveryMode,
  isGatewayComparison,
  type DiscoveryMode,
} from "./discoveryMode.js";

const FIXTURES_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures",
);
const FIXED_NOW = new Date("2026-09-11T00:00:00.000Z");

interface DiscoveryFixture {
  request: RecommendRequest;
  expectedIntent: TripIntent;
  expectedDiscoveryMode: DiscoveryMode;
}

function loadBrief(name: string): DiscoveryFixture {
  const path = join(FIXTURES_ROOT, "briefs", name);
  return JSON.parse(readFileSync(path, "utf8")) as DiscoveryFixture;
}

describe("classifyDiscoveryMode (TDD-v2 §VIII)", () => {
  it("Nguyens Cà Mau fixture → discovery", () => {
    const fixture = loadBrief("nguyens-discovery.json");
    const { intent, destinationSource } = parseBriefHeuristic(
      fixture.request.briefText ?? "",
      { now: FIXED_NOW, originCity: fixture.request.originCity },
    );
    assert.equal(destinationSource, "locality");
    assert.equal(intent.preferredDestination, "SGN");
    assert.equal(
      classifyDiscoveryMode(intent, fixture.request.briefText),
      "discovery",
    );
    assert.equal(fixture.expectedDiscoveryMode, "discovery");
  });

  it("Olivia compare fixture → discovery and no preferredDestination", () => {
    const fixture = loadBrief("olivia-discovery.json");
    const { intent, destinationSource } = parseBriefHeuristic(
      fixture.request.briefText ?? "",
      { now: FIXED_NOW, originCity: fixture.request.originCity },
    );
    assert.equal(destinationSource, "compare");
    assert.equal(intent.goal, "discover_destination");
    assert.equal(intent.preferredDestination, undefined);
    assert.equal(
      classifyDiscoveryMode(intent, fixture.request.briefText),
      "discovery",
    );
  });

  it("James SYD→SGN fixed date + fare → route_known", () => {
    const fixture = loadBrief("james-route-known.json");
    const { intent } = parseBriefHeuristic(fixture.request.briefText ?? "", {
      now: FIXED_NOW,
      originCity: fixture.request.originCity,
    });
    assert.equal(intent.preferredDestination, "SGN");
    assert.equal(
      classifyDiscoveryMode(intent, fixture.request.briefText),
      "route_known",
    );
  });

  it("locality without IATA (Huế / Mekong) → discovery", () => {
    const cases = [
      "From Melbourne, 2 adults, 7 days, Hue imperial citadel and food, standard budget, lowest hassle.",
      "From Sydney, 2 adults, 10 days, Mekong delta boat trip with family, standard budget, best for family.",
    ];
    for (const brief of cases) {
      const { intent } = parseBriefHeuristic(brief, { now: FIXED_NOW });
      assert.equal(
        classifyDiscoveryMode(intent, brief),
        "discovery",
        brief,
      );
    }
  });

  it("price ask on known route → route_known", () => {
    const brief =
      "What's the fare SYD to SGN on 2026-11-15? 1 adult, budget, lowest hassle.";
    const { intent } = parseBriefHeuristic(brief, { now: FIXED_NOW });
    assert.equal(classifyDiscoveryMode(intent, brief), "route_known");
  });

  it("Phase 1 Olivia vibe brief → discovery", () => {
    const brief =
      "Trip from Sydney (SYD). 2 adults. Dates: 8–10 days in mid-November. Trip vibe: Beach-and-food trip with a friend — low hassle, few connections. Budget band: Standard. Priority: Lowest hassle.";
    const { intent } = parseBriefHeuristic(brief, { now: FIXED_NOW });
    assert.equal(classifyDiscoveryMode(intent, brief), "discovery");
  });

  it("Phase 1 VFR Hanoi without ISO date → discovery", () => {
    const brief =
      "Trip from Melbourne (MEL). 4 adults. Dates: Visiting family in Hanoi, ±3 days flexible. Trip vibe: Family visit with kids — one stop max, prefer direct if possible. Budget band: Standard. Priority: Best for family. Need stroller-friendly airports where possible.";
    const { intent } = parseBriefHeuristic(brief, { now: FIXED_NOW });
    assert.equal(intent.preferredDestination, "HAN");
    assert.equal(classifyDiscoveryMode(intent, brief), "discovery");
  });

  it("quiz / empty brief with discover_destination → discovery", () => {
    const intent: TripIntent = {
      originCity: "SYD",
      travelStyles: ["beach_relaxation"],
      budgetBand: "standard",
      travellers: 2,
      priority: "lowest_hassle",
      dateWindow: {
        start: "2026-09-11",
        end: "2026-09-18",
        flexibility: "flexible_±3",
      },
      tripDurationDays: 7,
      goal: "discover_destination",
      constraints: { maxStops: 1 },
      rawSummary: "quiz",
      parseConfidence: 1,
      missingFields: [],
    };
    assert.equal(classifyDiscoveryMode(intent), "discovery");
    assert.equal(classifyDiscoveryMode(intent, "  "), "discovery");
  });
});

describe("isGatewayComparison", () => {
  it("detects or / vs / either between two gateways", () => {
    assert.equal(isGatewayComparison("Hanoi or Saigon?"), true);
    assert.equal(isGatewayComparison("Hanoi vs Saigon for food"), true);
    assert.equal(isGatewayComparison("either Hanoi or Da Nang"), true);
  });

  it("ignores negated second gateway (Hoi An not Hanoi)", () => {
    assert.equal(
      isGatewayComparison("Hoi An lanterns and beach — not Hanoi."),
      false,
    );
  });
});
