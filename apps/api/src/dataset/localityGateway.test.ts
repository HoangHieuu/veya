import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseBriefHeuristic } from "../intent/briefHeuristic.js";
import { inferGatewayFromLocalities, loadLocalityGateway } from "./localityGateway.js";

describe("locality-gateway dataset", () => {
  it("maps provinces across all three gateways", () => {
    const data = loadLocalityGateway();
    assert.ok(data.localities.length >= 40);
    assert.equal(inferGatewayFromLocalities("visit relatives in Bac Giang", data), "HAN");
    assert.equal(inferGatewayFromLocalities("family in Can Tho", data), "SGN");
    assert.equal(inferGatewayFromLocalities("visit families in Cà Mau", data), "SGN");
    assert.equal(inferGatewayFromLocalities("trip to Hue and Hoi An", data), "DAD");
    assert.equal(inferGatewayFromLocalities("visiting family in the north", data), "HAN");
    assert.equal(inferGatewayFromLocalities("Mekong delta food trip", data), "SGN");
  });

  it("parses VFR briefs to choose_route via locality inference", () => {
    const cases = [
      {
        brief:
          "Trip from Sydney (SYD). 2 adults. Trip vibe: visit relatives in Bac Giang. Travel style: Visiting family / friends. Budget band: Standard. Priority: Best for family.",
        dest: "HAN" as const,
      },
      {
        brief:
          "Trip from Melbourne (MEL). 3 adults. Trip vibe: visiting cousins in Can Tho. Travel style: Visiting family / friends. Budget band: Budget. Priority: Lowest hassle.",
        dest: "SGN" as const,
      },
    ];
    for (const { brief, dest } of cases) {
      const { intent } = parseBriefHeuristic(brief);
      assert.equal(intent.goal, "choose_route");
      assert.equal(intent.preferredDestination, dest);
    }
  });
});
