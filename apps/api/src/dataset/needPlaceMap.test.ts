import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TripIntent } from "../../../../shared/types.js";
import {
  blendIntentMatch,
  buildNeedProfile,
  inferGatewayFromText,
  loadNeedPlaceMap,
  rankExperienceHighlights,
  resetNeedPlaceMapCacheForTests,
} from "./needPlaceMap.js";
import { loadExperienceHighlights } from "./experiences.js";
import { scoreRoute } from "../scoring/engine.js";

const OLIVIA_INTENT: TripIntent = {
  originCity: "SYD",
  travelStyles: ["beach_relaxation", "food_culture"],
  budgetBand: "standard",
  travellers: 2,
  priority: "lowest_hassle",
  dateWindow: {
    start: "2026-11-15",
    end: "2026-11-24",
    flexibility: "flexible_±3",
  },
  tripDurationDays: 9,
  goal: "discover_destination",
  constraints: { maxStops: 1 },
  rawSummary:
    "Trip from Sydney (SYD). 2 adults. Beach-and-food trip with a friend — low hassle.",
  parseConfidence: 0.9,
  missingFields: [],
};

describe("need-place map", () => {
  it("loads curated map from data/", () => {
    resetNeedPlaceMapCacheForTests();
    const map = loadNeedPlaceMap();
    assert.equal(map.version, "1.0.0");
    assert.ok(map.places.length >= 10);
  });

  it("infers DAD gateway from Hoi An in brief text", () => {
    const map = loadNeedPlaceMap();
    assert.equal(inferGatewayFromText("Week in Hoi An lanterns and beach", map), "DAD");
  });

  it("ranks beach-forward spots ahead for beach-heavy intent", () => {
    const map = loadNeedPlaceMap();
    const beachIntent: TripIntent = {
      ...OLIVIA_INTENT,
      travelStyles: ["beach_relaxation"],
      rawSummary: "Beach holiday from Sydney — sand and calm water.",
    };
    const profile = buildNeedProfile(beachIntent, map);
    const ranked = rankExperienceHighlights(loadExperienceHighlights("DAD"), profile);
    assert.equal(ranked[0]?.id, "dad-mykhe");
  });

  it("does not change style-only intentMatch scores", () => {
    const map = loadNeedPlaceMap();
    const profile = buildNeedProfile(OLIVIA_INTENT, map);
    assert.equal(profile.hasExplicitPlaceSignals, false);
    assert.equal(blendIntentMatch(50, profile, "HAN"), 50);
  });

  it("boosts DAD intentMatch when brief names Hoi An", () => {
    const map = loadNeedPlaceMap();
    const intent: TripIntent = {
      ...OLIVIA_INTENT,
      rawSummary: "Sydney to Vietnam — Hoi An food and beach, avoid Hanoi",
    };
    const profile = buildNeedProfile(intent, map);
    assert.ok(profile.hasExplicitPlaceSignals);
    assert.ok(profile.gatewayAffinity.DAD > 0);
    assert.ok(profile.gatewayAffinity.HAN < 0);
    const blended = blendIntentMatch(50, profile, "DAD");
    assert.ok(blended > 50);
  });

  it("keeps Olivia regression order without place names in brief", () => {
    const dad = scoreRoute(OLIVIA_INTENT, {
      id: "SYD-DAD-one_stop",
      originCity: "SYD",
      originAirport: "SYD",
      destinationCity: "DAD",
      destinationAirport: "DAD",
      destinationName: "Da Nang",
      connectionType: "one_stop",
      viaHub: "SGN",
      typicalDurationHours: 12,
      seasonalityNotes: "test",
      gettingAround: "test",
      tripArchetypes: ["beach_relaxation", "food_culture"],
      indicativeFareBand: "premium",
      bestMonths: [2, 3, 4, 5, 6, 7, 8],
      backgroundImage: {
        url: "/assets/da-nang-beach.jpg",
        archetype: "beach_relaxation",
        source: "test",
        owner: "test",
        licenseNote: "test",
      },
      dataConfidence: "illustrative",
      sourceDocument: "test",
      sourceOwner: "test",
    });
    assert.equal(dad.score.intentMatch, 100);
  });
});
